import { NextResponse } from "next/server";
import { FieldValue, FieldPath, type DocumentData, type Query } from "firebase-admin/firestore";
import { blocked, canView, canViewAlbum, requestUser, RequestError, serialize } from "@/lib/server/access";
import { isValidUsername } from "@/utils/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(data: Record<string, unknown>, key: string, max = 128) {
  const value = data[key];
  if (typeof value !== "string" || !value.trim() || value.length > max || (max === 128 && value.includes("/"))) {
    throw new RequestError(`Invalid ${key}.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const { uid, db, user } = await requestUser(request);
    const data: Record<string, unknown> = await request.json();
    const action = str(data, "action");
    const now = FieldValue.serverTimestamp();
    const mine = db.doc(`users/${uid}`);

    async function notify(recipientUid: string, type: string, entityType: string, entityId: string, text: string) {
      if (recipientUid === uid || await blocked(uid, recipientUid)) return;
      const preference: Record<string, string> = { like: "likes", comment: "comments", follow: "follows", followRequest: "followRequests", followAccepted: "follows", message: "messages", albumInvite: "albumInvites" };
      const prefs = (await db.doc(`notificationPrefs/${recipientUid}`).get()).data();
      if (prefs?.[preference[type]] === false) return;
      await db.collection("notifications").add({ recipientUid, senderUid: uid,
        senderUsername: user.username ?? "", senderPhotoUrl: user.profilePhotoUrl ?? "",
        type, entityType, entityId, text, isRead: false, readAt: null, createdAt: now });
    }
    async function safeNotify(...args: Parameters<typeof notify>) {
      await notify(...args).catch(error => console.error("Notification delivery failed", error));
    }
    async function postAccess(postId: string) {
      const ref = db.doc(`posts/${postId}`);
      const post = (await ref.get()).data();
      if (!post || !await canView(uid, post)) throw new RequestError("Post unavailable.", 403);
      return { ref, post };
    }

    if (action === "myMedia") {
      const page = await db.collection("media").where("ownerUid", "==", uid).orderBy("createdAt", "desc").limit(100).get();
      return NextResponse.json(serialize(page.docs.filter(d => d.data().postId && !d.data().albumId).map(d => ({ ...d.data(), id: d.id }))));
    } else if (action === "suggestedUsers" || action === "searchUsers") {
      const term = typeof data.search === "string" ? data.search.replace(/^@/, "").trim().toLowerCase() : "";
      let q = db.collection("users").where("status", "==", "approved").where("username", ">", "").orderBy("username").limit(100);
      if (term) q = db.collection("users").where("status", "==", "approved").where("username", ">=", term).where("username", "<=", term + "\uf8ff").orderBy("username").limit(100);
      const users = [];
      const following = action === "suggestedUsers" ? new Set((await db.collection(`followers/${uid}/following`).get()).docs.map(d => d.id)) : null;
      for (const d of (await q.get()).docs) {
        if (d.id === uid || following?.has(d.id) || await blocked(uid, d.id)) continue;
        const { email: _email, ...profile } = d.data();
        users.push({ ...profile, uid: d.id });
        if (users.length >= Math.min(30, Number(data.count) || 5)) break;
      }
      return NextResponse.json(serialize(users));
    } else if (action === "user") {
      const targetUid = str(data, "targetUid");
      if (await blocked(uid, targetUid)) return NextResponse.json(null);
      const profile = (await db.doc(`users/${targetUid}`).get()).data();
      if (!profile || (targetUid !== uid && profile.status !== "approved")) return NextResponse.json(null);
      const { email: _email, ...publicProfile } = profile;
      return NextResponse.json(serialize({ ...(targetUid === uid ? profile : publicProfile), uid: targetUid }));
    } else if (action === "conversations") {
      const snap = await db.collection("conversations").where("participants", "array-contains", uid).get();
      const conversations: DocumentData[] = [];
      for (const d of snap.docs) {
        const participants = d.data().participants as string[];
        const partner = participants.find(p => p !== uid);
        if (participants.length === 2 && partner && !await blocked(uid, partner)) conversations.push({ ...d.data(), id: d.id });
      }
      conversations.sort((a,b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0));
      return NextResponse.json(serialize(conversations));
    } else if (action === "createPost") {
      const visibility = str(data, "visibility");
      if (!["public", "followers", "closeFriends", "custom", "private"].includes(visibility)) throw new RequestError("Invalid audience.");
      const results = data.mediaResults as DocumentData[];
      if (!Array.isArray(results) || !results.length || results.length > 10) throw new RequestError("Select 1–10 files.");
      const caption = typeof data.caption === "string" ? data.caption.trim() : "";
      if (caption.length > 2200) throw new RequestError("Caption is too long.");
      const post = db.collection("posts").doc();
      const batch = db.batch();
      const mediaIds: string[] = [];
      for (const result of results) {
        if (typeof result.publicId !== "string" || !result.publicId.startsWith(`framefolk/users/${uid}/`) || !["image", "video"].includes(result.resourceType) || ![undefined, uid, "central"].includes(result.accountId)) throw new RequestError("Invalid uploaded media.");
        const media = db.collection("media").doc();
        mediaIds.push(media.id);
        batch.set(media, { id: media.id, ownerUid: uid, postId: post.id, storyId: null, albumId: null,
          storageProvider: result.accountId === uid ? "personal" : "central", cloudinaryAccountId: result.accountId ?? "central",
          cloudName: result.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          deliveryType: result.deliveryType ?? "upload", cloudinaryPublicId: result.publicId, assetId: result.assetId,
          resourceType: result.resourceType, format: result.format, width: result.width ?? 0, height: result.height ?? 0,
          duration: result.duration ?? null, bytes: result.bytes ?? 0, visibility, isPrivate: result.deliveryType !== "upload",
          thumbnailPublicId: result.publicId, altText: "", createdAt: now, updatedAt: now });
      }
      batch.set(post, { id: post.id, authorUid: uid, authorUsername: user.username ?? "", authorDisplayName: user.displayName ?? "", authorPhotoUrl: user.profilePhotoUrl ?? "",
        type: results.length > 1 ? "multi" : results[0].resourceType === "video" ? "video" : "photo", caption, visibility,
        hashtags: Array.from(new Set((caption.match(/#[a-zA-Z0-9_]+/g) ?? []).map(v => v.slice(1).toLowerCase()))),
        mentions: Array.from(new Set((caption.match(/@[a-zA-Z0-9._]+/g) ?? []).map(v => v.slice(1).toLowerCase()))),
        mediaIds, coverMediaId: mediaIds[0], customAudienceUids: Array.isArray(data.customAudienceUids) ? data.customAudienceUids.filter(v => typeof v === "string") : [],
        location: data.location ?? null, likesCount: 0, commentsCount: 0, isHidden: false, isPinned: false,
        scheduledFor: null, publishedAt: now, createdAt: now, updatedAt: now });
      batch.update(mine, { postsCount: FieldValue.increment(1), updatedAt: now });
      await batch.commit();
      return NextResponse.json(post.id);
    } else if (action === "albumMediaPage") {
      const albumId = str(data, "albumId");
      if (!await canViewAlbum(uid, albumId)) throw new RequestError("Album unavailable.", 403);
      const snap = await db.collection("media").where("albumId", "==", albumId).orderBy("createdAt", "desc").get();
      return NextResponse.json(serialize(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    } else if (action === "claimUsername") {
      const username = str(data, "username", 30).toLowerCase();
      if (!isValidUsername(username)) throw new RequestError("Invalid username.");
      await db.runTransaction(async tx => {
        const [profile, reservation] = await Promise.all([tx.get(mine), tx.get(db.doc(`usernames/${username}`))]);
        if (reservation.exists && reservation.data()?.uid !== uid) throw new RequestError("USERNAME_TAKEN", 409);
        const old = profile.data()?.username;
        const oldRef = old && old !== username ? db.doc(`usernames/${old}`) : null;
        const oldSnap = oldRef ? await tx.get(oldRef) : null;
        tx.set(db.doc(`usernames/${username}`), { uid, createdAt: now });
        tx.update(mine, { username, updatedAt: now });
        if (oldRef && oldSnap?.data()?.uid === uid) tx.delete(oldRef);
      });
    } else if (action === "follow" || action === "unfollow") {
      const targetUid = str(data, "targetUid");
      if (targetUid === uid || await blocked(uid, targetUid)) throw new RequestError("This relationship is unavailable.", 403);
      const target = db.doc(`users/${targetUid}`);
      const edge = db.doc(`followers/${uid}/following/${targetUid}`);
      const reciprocal = db.doc(`followers/${targetUid}/followers/${uid}`);
      const req = db.doc(`followRequests/${uid}_${targetUid}`);
      const result = await db.runTransaction(async tx => {
        const [targetSnap, edgeSnap, requestSnap] = await Promise.all([tx.get(target), tx.get(edge), tx.get(req)]);
        if (!targetSnap.exists || targetSnap.data()?.status !== "approved") throw new RequestError("User unavailable.", 404);
        if (action === "unfollow") {
          if (requestSnap.exists) tx.delete(req);
          if (!edgeSnap.exists) return null;
          tx.delete(edge); tx.delete(reciprocal);
          tx.update(mine, { followingCount: FieldValue.increment(-1) });
          tx.update(target, { followersCount: FieldValue.increment(-1) });
          return null;
        }
        if (edgeSnap.exists) return null;
        if (targetSnap.data()?.isPrivate) {
          if (requestSnap.data()?.status === "pending") return null;
          tx.set(req, { fromUid: uid, toUid: targetUid, status: "pending", createdAt: now, updatedAt: now });
          return "followRequest";
        }
        tx.set(edge, { targetUid, createdAt: now }); tx.set(reciprocal, { sourceUid: uid, createdAt: now });
        tx.update(mine, { followingCount: FieldValue.increment(1) }); tx.update(target, { followersCount: FieldValue.increment(1) });
        return "follow";
      });
      if (result) await safeNotify(targetUid, result, "user", uid, result === "follow" ? `@${user.username} started following you.` : `@${user.username} requested to follow you.`);
    } else if (action === "respondFollow") {
      const ref = db.doc(`followRequests/${str(data, "requestId")}`);
      const fromUid = await db.runTransaction(async tx => {
        const req = (await tx.get(ref)).data();
        if (!req || req.toUid !== uid) throw new RequestError("Request unavailable.", 403);
        if (req.status !== "pending") return null;
        if (await blocked(uid, req.fromUid)) throw new RequestError("User blocked.", 403);
        const edge = db.doc(`followers/${req.fromUid}/following/${uid}`);
        const exists = (await tx.get(edge)).exists;
        tx.update(ref, { status: data.accept === true ? "accepted" : "rejected", updatedAt: now });
        if (data.accept !== true || exists) return null;
        tx.set(edge, { targetUid: uid, createdAt: now });
        tx.set(db.doc(`followers/${uid}/followers/${req.fromUid}`), { sourceUid: req.fromUid, createdAt: now });
        tx.update(mine, { followersCount: FieldValue.increment(1) });
        tx.update(db.doc(`users/${req.fromUid}`), { followingCount: FieldValue.increment(1) });
        return req.fromUid as string;
      });
      if (fromUid) await safeNotify(fromUid, "followAccepted", "user", uid, "Your follow request was accepted.");
    } else if (action === "block") {
      const targetUid = str(data, "targetUid");
      if (uid === targetUid) throw new RequestError("Cannot block yourself.");
      await db.runTransaction(async tx => {
        const a = db.doc(`followers/${uid}/following/${targetUid}`), b = db.doc(`followers/${targetUid}/following/${uid}`);
        const [as, bs, target] = await Promise.all([tx.get(a), tx.get(b), tx.get(db.doc(`users/${targetUid}`))]);
        if (!target.exists) throw new RequestError("User not found.", 404);
        tx.set(db.doc(`blocks/${uid}_${targetUid}`), { blockerUid: uid, blockedUid: targetUid, createdAt: now });
        tx.delete(a); tx.delete(b);
        tx.delete(db.doc(`followers/${targetUid}/followers/${uid}`)); tx.delete(db.doc(`followers/${uid}/followers/${targetUid}`));
        tx.delete(db.doc(`followRequests/${uid}_${targetUid}`)); tx.delete(db.doc(`followRequests/${targetUid}_${uid}`));
        if (as.exists) { tx.update(mine, { followingCount: FieldValue.increment(-1) }); tx.update(target.ref, { followersCount: FieldValue.increment(-1) }); }
        if (bs.exists) { tx.update(mine, { followersCount: FieldValue.increment(-1) }); tx.update(target.ref, { followingCount: FieldValue.increment(-1) }); }
      });
    } else if (action === "like" || action === "unlike") {
      const postId = str(data, "postId");
      const { ref, post } = await postAccess(postId);
      const changed = await db.runTransaction(async tx => {
        const like = ref.collection("likes").doc(uid);
        const [current, parent] = await Promise.all([tx.get(like), tx.get(ref)]);
        const wanted = action === "like";
        if (current.exists === wanted) return false;
        if (wanted) tx.set(like, { uid, createdAt: now }); else tx.delete(like);
        tx.update(ref, { likesCount: Math.max(0, (parent.data()?.likesCount ?? 0) + (wanted ? 1 : -1)) });
        return true;
      });
      if (changed && action === "like") await safeNotify(post.authorUid, "like", "post", postId, `@${user.username} liked your post.`);
    } else if (action === "likeComment") {
      const { ref } = await postAccess(str(data, "postId"));
      const comment = ref.collection("comments").doc(str(data, "commentId"));
      await db.runTransaction(async tx => {
        const like = comment.collection("likes").doc(uid);
        const [parent, existing] = await Promise.all([tx.get(comment), tx.get(like)]);
        if (!parent.exists || parent.data()?.isDeleted) throw new RequestError("Comment unavailable.", 404);
        if (existing.exists) return;
        tx.set(like, { uid, createdAt: now });
        tx.update(comment, { likesCount: FieldValue.increment(1) });
      });
    } else if (action === "comment" || action === "reply" || action === "deleteComment") {
      const postId = str(data, "postId");
      const { ref, post } = await postAccess(postId);
      const parent = action === "reply" ? ref.collection("comments").doc(str(data, "commentId")) : ref;
      const entry = action === "deleteComment" ? ref.collection("comments").doc(str(data, "commentId")) : parent.collection(action === "reply" ? "replies" : "comments").doc();
      const text = action !== "deleteComment" ? str(data, "text", 500) : "";
      await db.runTransaction(async tx => {
        const parentSnap = await tx.get(parent);
        const old = action === "deleteComment" ? await tx.get(entry) : null;
        if (!parentSnap.exists || parentSnap.data()?.isDeleted) throw new RequestError("Comment unavailable.", 404);
        if (action === "deleteComment") {
          if (old?.data()?.authorUid !== uid) throw new RequestError("Not your comment.", 403);
          if (old.data()?.isDeleted) return;
          tx.update(entry, { isDeleted: true, updatedAt: now });
        } else tx.set(entry, { authorUid: uid, authorUsername: user.username ?? "", authorPhotoUrl: user.profilePhotoUrl ?? "", text,
          mentions: [], likesCount: 0, repliesCount: 0, isDeleted: false, createdAt: now, updatedAt: now });
        const field = action === "reply" ? "repliesCount" : "commentsCount";
        tx.update(parent, { [field]: Math.max(0, (parentSnap.data()?.[field] ?? 0) + (action === "deleteComment" ? -1 : 1)) });
      });
      if (action !== "deleteComment") await safeNotify(post.authorUid, "comment", "post", postId, `@${user.username} commented: ${text.slice(0, 60)}`);
      return NextResponse.json(entry.id);
    } else if (action === "viewStory" || action === "reactStory") {
      const storyRef = db.doc(`stories/${str(data, "storyId")}`);
      const story = (await storyRef.get()).data();
      if (!story || !await canView(uid, story, "story")) throw new RequestError("Story unavailable.", 403);
      const reaction = action === "reactStory" ? str(data, "reaction", 16) : null;
      await db.runTransaction(async tx => {
        const view = db.doc(`storyViews/${storyRef.id}_${uid}`);
        const [old, parent] = await Promise.all([tx.get(view), tx.get(storyRef)]);
        tx.set(view, { storyId: storyRef.id, viewerUid: uid, viewedAt: old.data()?.viewedAt ?? now,
          reaction: reaction ?? old.data()?.reaction ?? null, reply: null }, { merge: true });
        tx.update(storyRef, { viewsCount: (parent.data()?.viewsCount ?? 0) + (old.exists ? 0 : 1),
          reactionsCount: (parent.data()?.reactionsCount ?? 0) + (reaction && !old.data()?.reaction ? 1 : 0) });
      });
    } else if (action === "conversation") {
      const targetUid = str(data, "targetUid");
      if (targetUid === uid || await blocked(uid, targetUid)) throw new RequestError("Conversation unavailable.", 403);
      const target = (await db.doc(`users/${targetUid}`).get()).data();
      if (target?.status !== "approved") throw new RequestError("User unavailable.", 404);
      const id = [uid, targetUid].sort().join("_");
      await db.runTransaction(async tx => {
        const ref = db.doc(`conversations/${id}`);
        if (!(await tx.get(ref)).exists) tx.set(ref, { id, participants: [uid, targetUid], lastMessage: null,
          lastMessageAt: now, unreadCounts: { [uid]: 0, [targetUid]: 0 }, createdAt: now });
      });
      return NextResponse.json(id);
    } else if (["sendMessage", "readMessages", "unsend"].includes(action)) {
      const conv = db.doc(`conversations/${str(data, "conversationId")}`);
      const snapshot = await conv.get();
      const participants = snapshot.data()?.participants as string[] | undefined;
      if (!participants?.includes(uid) || participants.length !== 2) throw new RequestError("Conversation unavailable.", 403);
      const targetUid = participants.find(p => p !== uid)!;
      if (await blocked(uid, targetUid)) throw new RequestError("Conversation unavailable.", 403);
      if (action === "sendMessage") {
        const text = str(data, "text", 2000);
        const msg = conv.collection("messages").doc();
        const batch = db.batch();
        batch.set(msg, { id: msg.id, senderUid: uid, type: "text", text, mediaId: null, isRead: false, readAt: null,
          isDeleted: false, deletedAt: null, createdAt: now, updatedAt: now });
        batch.update(conv, { lastMessage: { id: msg.id, text: text.slice(0, 100), senderUid: uid, sentAt: now, type: "text" },
          lastMessageAt: now, [`unreadCounts.${targetUid}`]: FieldValue.increment(1) });
        await batch.commit();
        await safeNotify(targetUid, "message", "conversation", conv.id, `@${user.username} sent you a message.`);
        return NextResponse.json(msg.id);
      }
      if (action === "readMessages") {
        // The cutoff prevents a concurrent incoming message from being cleared before it is seen.
        const cutoff = snapshot.data()?.lastMessageAt;
        if (cutoff) {
          await db.runTransaction(async tx => {
            const latest = (await tx.get(conv)).data();
            const unchanged = latest?.lastMessageAt?.isEqual(cutoff);
            tx.update(conv, { [`lastReadAt.${uid}`]: cutoff, ...(unchanged ? { [`unreadCounts.${uid}`]: 0 } : {}) });
          });
        }
      } else {
        const ref = conv.collection("messages").doc(str(data, "messageId"));
        await db.runTransaction(async tx => {
          const [message, current] = await Promise.all([tx.get(ref), tx.get(conv)]);
          if (message.data()?.senderUid !== uid) throw new RequestError("Not your message.", 403);
          tx.update(ref, { text: "", isDeleted: true, deletedAt: now, updatedAt: now });
          if (current.data()?.lastMessage?.id === ref.id) tx.update(conv, { "lastMessage.text": "Message unsent" });
        });
      }
    } else if (action === "albumInvite" || action === "albumRespond" || action === "albumDelete" || action === "albumMedia") {
      const ref = db.doc(`albums/${str(data, "albumId")}`);
      if (action === "albumInvite") {
        const targetUid = str(data, "targetUid"), role = str(data, "role");
        if (!["contributor", "viewer"].includes(role) || targetUid === uid || await blocked(uid, targetUid)) throw new RequestError("Invalid invitation.");
        const memberRef = db.doc(`albumMembers/${ref.id}_${targetUid}`);
        await db.runTransaction(async tx => {
          const [album, existing, target] = await Promise.all([tx.get(ref), tx.get(memberRef), tx.get(db.doc(`users/${targetUid}`))]);
          if (album.data()?.ownerUid !== uid || album.data()?.deleting || album.data()?.type !== "collaborative") throw new RequestError("Album owner required.", 403);
          if (target.data()?.status !== "approved") throw new RequestError("User unavailable.");
          if (existing.data()?.status === "accepted") return;
          tx.set(memberRef, { albumId: ref.id, uid: targetUid, role, invitedBy: uid, status: "pending", joinedAt: null, createdAt: now });
        });
        await safeNotify(targetUid, "albumInvite", "album", ref.id, `@${user.username} invited you to an album.`);
      } else if (action === "albumRespond") {
        await db.runTransaction(async tx => {
          const member = db.doc(`albumMembers/${ref.id}_${uid}`);
          const [invitation, album] = await Promise.all([tx.get(member), tx.get(ref)]);
          if (!album.exists || album.data()?.deleting || await blocked(uid, album.data()!.ownerUid)) throw new RequestError("Album unavailable.", 403);
          if (invitation.data()?.status !== "pending") return;
          tx.update(member, { status: data.accept === true ? "accepted" : "rejected", joinedAt: data.accept === true ? now : null });
          if (data.accept === true) tx.update(ref, { memberCount: FieldValue.increment(1), updatedAt: now });
        });
      } else if (action === "albumDelete") {
        await db.runTransaction(async tx => {
          const album = (await tx.get(ref)).data();
          if (!album || album.ownerUid !== uid) throw new RequestError("Album owner required.", 403);
          tx.update(ref, { deleting: true });
        });
        // Restartable cleanup; never truncates at a fixed document count.
        for (const collection of ["media", "albumMembers"]) {
          for (;;) {
            const page = await db.collection(collection).where("albumId", "==", ref.id).limit(400).get();
            if (page.empty) break;
            const batch = db.batch();
            page.docs.forEach(d => collection === "media" ? batch.update(d.ref, { albumId: null }) : batch.delete(d.ref));
            await batch.commit();
          }
        }
        await ref.delete();
      } else {
        const media = db.doc(`media/${str(data, "mediaId")}`);
        await db.runTransaction(async tx => {
          const [album, item, member] = await Promise.all([tx.get(ref), tx.get(media), tx.get(db.doc(`albumMembers/${ref.id}_${uid}`))]);
          const a = album.data(), m = item.data();
          if (!a || a.deleting || !m || (m.ownerUid !== uid && !(data.remove === true && a.ownerUid === uid)) || (a.ownerUid !== uid && !(member.data()?.status === "accepted" && member.data()?.role === "contributor"))) throw new RequestError("Contributor access required.", 403);
          if (data.remove === true) {
            if (m.albumId !== ref.id) return;
            tx.update(media, { albumId: null, updatedAt: now });
            tx.update(ref, { mediaCount: Math.max(0, (a.mediaCount ?? 0) - 1), ...(a.coverMediaId === media.id ? { coverMediaId: null } : {}), updatedAt: now });
          } else {
            if (m.albumId === ref.id) return;
            if (m.albumId) throw new RequestError("Remove the media from its current album first.");
            tx.update(media, { albumId: ref.id, updatedAt: now });
            tx.update(ref, { mediaCount: FieldValue.increment(1), ...(data.setCover === true || !a.coverMediaId ? { coverMediaId: media.id } : {}), updatedAt: now });
          }
        });
      }
    } else if (action === "albums") {
      const ownerUid = typeof data.ownerUid === "string" ? str(data, "ownerUid") : uid;
      const owned = await db.collection("albums").where("ownerUid", "==", ownerUid).get();
      const docs = new Map(owned.docs.map(d => [d.id, d]));
      if (ownerUid === uid) {
        const memberships = await db.collection("albumMembers").where("uid", "==", uid).where("status", "==", "accepted").get();
        for (const member of memberships.docs) {
          const album = await db.doc(`albums/${member.data().albumId}`).get();
          if (album.exists) docs.set(album.id, album as typeof owned.docs[number]);
        }
      }
      const albums: DocumentData[] = [];
      for (const d of docs.values()) if (await canViewAlbum(uid, d.id, d.data())) albums.push({ ...d.data(), id: d.id, title: d.data().title || "Untitled album", mediaCount: d.data().mediaCount ?? 0, createdAt: d.data().createdAt ?? d.createTime, updatedAt: d.data().updatedAt ?? d.createTime });
      albums.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      return NextResponse.json(serialize(albums));
    } else if (action === "posts") {
      const mode = data.mode;
      let q: Query = db.collection("posts");
      if (data.authorUid) q = q.where("authorUid", "==", str(data, "authorUid"));
      if (mode === "explore") q = q.where("visibility", "==", "public");
      q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
      if (data.cursor) {
        const cursor = await db.doc(`posts/${str(data, "cursor")}`).get();
        if (!cursor.exists) throw new RequestError("Pagination expired. Refresh the page.", 409);
        q = q.startAfter(cursor);
      }
      const following = mode === "feed" ? new Set([uid, ...(await db.collection(`followers/${uid}/following`).get()).docs.map(d => d.id)]) : null;
      const pageSize = Math.min(100, Math.max(1, Number(data.pageSize) || 12));
      const posts: DocumentData[] = [];
      let cursor: string | null = null, exhausted = false;
      for (let scanned = 0; scanned < 1000 && posts.length < pageSize; scanned += 100) {
        const page = await q.limit(100).get();
        if (page.empty) { exhausted = true; break; }
        let consumed = 0;
        for (const d of page.docs) {
          consumed++; cursor = d.id;
          const p = d.data();
          const search = typeof data.search === "string" ? data.search.toLowerCase().trim() : "";
          const matches = (!following || following.has(p.authorUid)) &&
            (!data.type || (data.type === "photo" ? ["photo", "multi"].includes(p.type) : p.type === data.type)) &&
            (!data.mention || p.mentions?.includes(data.mention)) &&
            (!search || (search.startsWith("#") ? p.hashtags?.includes(search.slice(1)) : search.startsWith("@") ? p.authorUsername === search.slice(1) : `${p.caption} ${p.authorUsername}`.toLowerCase().includes(search)));
          if (matches && await canView(uid, p)) posts.push({ ...p, id: d.id });
          if (posts.length === pageSize) break;
        }
        if (page.size < 100 && consumed === page.size) { exhausted = true; break; }
        q = q.startAfter(page.docs[consumed - 1]);
      }
      return NextResponse.json(serialize({ posts, cursor: exhausted ? null : cursor }));
    } else if (action === "stories") {
      let q: Query = db.collection("stories").where("expiresAt", ">", new Date()).orderBy("expiresAt");
      if (data.authorUid) q = q.where("authorUid", "==", str(data, "authorUid"));
      const stories: DocumentData[] = [];
      const snap = await q.get();
      for (const d of snap.docs) if (await canView(uid, d.data(), "story")) stories.push({ ...d.data(), id: d.id });
      return NextResponse.json(serialize(stories));
    } else throw new RequestError("Unknown action.");
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof RequestError)) console.error("Platform request failed", error);
    return NextResponse.json({ error: error instanceof RequestError ? error.message : "Request failed. Please try again." },
      { status: error instanceof RequestError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
