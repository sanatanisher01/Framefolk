import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { DocumentData } from "firebase-admin/firestore";

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requestUser(request: Request, allowInactive = false) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new RequestError("Sign in required.", 401);
  const decoded = await getAdminAuth().verifyIdToken(token, true).catch(() => {
    throw new RequestError("Your session expired. Please sign in again.", 401);
  });
  const db = getAdminDb();
  const ref = db.collection("users").doc(decoded.uid);
  let user = (await ref.get()).data();
  if (user?.status === "suspended" && user.suspensionExpiresAt?.toMillis() <= Date.now()) {
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.status === "suspended" && current.suspensionExpiresAt?.toMillis() <= Date.now()) {
        tx.update(ref, { status: "approved", suspensionExpiresAt: null });
      }
    });
    user = (await ref.get()).data();
  }
  if (!allowInactive && user?.status !== "approved") throw new RequestError("Account is not active.", 403);
  return { uid: decoded.uid, claims: decoded, user: user ?? {}, db };
}

export async function blocked(uid: string, other: string) {
  if (uid === other) return false;
  const db = getAdminDb();
  const docs = await db.getAll(db.doc(`blocks/${uid}_${other}`), db.doc(`blocks/${other}_${uid}`));
  return docs.some(d => d.exists);
}

export async function canView(uid: string, data: DocumentData, kind = "post"): Promise<boolean> {
  const owner = data.authorUid ?? data.ownerUid;
  if (!owner || data.isHidden || data.isDeleted || data.deleting) return false;
  if (kind === "story" && (data.isExpired || data.expiresAt?.toMillis() <= Date.now())) return false;
  if (data.scheduledFor?.toMillis() > Date.now()) return false;
  if (uid === owner) return true;
  if (await blocked(uid, owner)) return false;
  const db = getAdminDb();
  const ownerDoc = (await db.doc(`users/${owner}`).get()).data();
  if (ownerDoc?.status !== "approved") return false;
  const following = (await db.doc(`followers/${uid}/following/${owner}`).get()).exists;
  if (ownerDoc.isPrivate && !following) return false;
  switch (data.visibility) {
    case "public": return true;
    case "followers": return following;
    case "closeFriends": return (await db.doc(`closeFriends/${owner}/members/${uid}`).get()).exists;
    case "custom": return Array.isArray(data.customAudienceUids) && data.customAudienceUids.includes(uid);
    default: return false;
  }
}

export async function canViewAlbum(uid: string, albumId: string, data?: DocumentData) {
  const db = getAdminDb();
  const album = data ?? (await db.doc(`albums/${albumId}`).get()).data();
  if (!album || album.deleting || await blocked(uid, album.ownerUid)) return false;
  const member = (await db.doc(`albumMembers/${albumId}_${uid}`).get()).data();
  return album.ownerUid === uid || member?.status === "accepted" || canView(uid, album, "album");
}

export async function canViewMedia(uid: string, media: DocumentData) {
  const db = getAdminDb();
  if (await blocked(uid, media.ownerUid)) return false;
  if (media.albumId) {
    if (!await canViewAlbum(uid, media.albumId)) return false;
    if (media.postId) {
      const post = (await db.doc(`posts/${media.postId}`).get()).data();
      return !!post && !post.isHidden && !post.isDeleted;
    }
    return true;
  }
  if (media.postId) {
    const post = (await db.doc(`posts/${media.postId}`).get()).data();
    if (!post || !await canView(uid, post)) return false;
  } else if (media.storyId) {
    const story = (await db.doc(`stories/${media.storyId}`).get()).data();
    if (!story || !await canView(uid, story, "story")) return false;
  } else if (media.ownerUid !== uid && !await canView(uid, media)) return false;
  return true;
}

export function serialize(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return { $date: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}
