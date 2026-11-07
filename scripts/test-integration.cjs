/* Runs only against the local Firebase emulators. Never uses production data. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
process.env.FIREBASE_PROJECT_ID = "demo-framefolk";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-framefolk";
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "";
process.env.CLOUDINARY_API_SECRET = "emulator-test-secret";
process.env.CLOUDINARY_API_KEY = "123456";
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Start the Firestore and Auth emulators first.");
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "../src", name.slice(2));
  return resolve.call(this, name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { getAdminDb, getAdminAuth } = require("../src/lib/firebase/admin.ts");
const { POST } = require("../src/app/api/platform/route.ts");
const { POST: signedUrl } = require("../src/app/api/cloudinary/signed-url/route.ts");
const { POST: signUpload } = require("../src/app/api/cloudinary/sign/route.ts");
const { encryptSecret, decryptSecret } = require("../src/lib/server/cloudinary.ts");
const { initializeApp, deleteApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, terminate } = require("firebase/firestore");
const { Timestamp } = require("firebase-admin/firestore");
const db = getAdminDb(), adminAuth = getAdminAuth();
const clients = [];
let passed = 0;
async function check(name, callback) { await callback(); passed++; console.log(`PASS ${name}`); }
async function denied(promise) { await assert.rejects(promise, error => error.code === "permission-denied"); }
async function user(uid, privateAccount = false) {
  await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "Password123", emailVerified: true });
  await db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid, status: "approved", isPrivate: privateAccount,
    followersCount: 0, followingCount: 0, postsCount: 0, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), onboardingComplete: true });
  await db.doc(`usernames/${uid}`).set({uid});
  const app = initializeApp({ projectId: "demo-framefolk", apiKey: "fake-api-key", authDomain: "localhost" }, uid);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, `${uid}@example.test`, "Password123");
  const client = getFirestore(app); const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(client, host, Number(port));
  const value = { uid, app, auth, db: client, token: await auth.currentUser.getIdToken() }; clients.push(value); return value;
}
async function api(user, action, payload = {}, status = 200) {
  const response = await POST(new Request("http://localhost/api/platform", { method: "POST", headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) }));
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
}
async function seedPost(id, authorUid, visibility = "public", extra = {}) {
  await db.doc(`posts/${id}`).set({ authorUid, authorUsername: authorUid, type: "photo", caption: id, visibility, customAudienceUids: [], mediaIds: [],
    isHidden: false, likesCount: 0, commentsCount: 0, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...extra });
}
async function main() {
 const alice = await user("alice"), bob = await user("bob"), eve = await user("eve"), privateUser = await user("privateuser", true);
 await seedPost("public", "alice"); await seedPost("private", "alice", "private"); await seedPost("private-account", "privateuser");
 await check("public reads work; private and private-account reads are denied", async () => {
  assert((await getDoc(doc(bob.db, "posts/public"))).exists());
  await denied(getDoc(doc(bob.db, "posts/private"))); await denied(getDoc(doc(bob.db, "posts/private-account")));
 });
 await check("users cannot edit their account status or steal usernames", async () => {
  await denied(updateDoc(doc(bob.db, "users/bob"), { status: "approved", postsCount: 999 }));
  await api(alice, "claimUsername", { username: "alice.photo" });
  await denied(deleteDoc(doc(bob.db, "usernames/alice.photo")));
  await api(bob, "claimUsername", { username: "alice.photo" }, 409);
 });
 await check("follow is atomic and idempotent; unfollow restores counts", async () => {
  await Promise.all([api(bob,"follow",{targetUid:"alice"}),api(bob,"follow",{targetUid:"alice"})]);
  assert.equal((await db.doc("users/alice").get()).data().followersCount,1);
  assert((await db.doc("followers/alice/followers/bob").get()).exists);
  await api(bob,"unfollow",{targetUid:"alice"}); await api(bob,"unfollow",{targetUid:"alice"});
  assert.equal((await db.doc("users/alice").get()).data().followersCount,0);
 });
 await check("private follow acceptance grants access and cannot be forged", async () => {
  await api(bob,"follow",{targetUid:"privateuser"});
  await api(eve,"respondFollow",{requestId:"bob_privateuser",accept:true},403);
  await api(privateUser,"respondFollow",{requestId:"bob_privateuser",accept:true});
  await api(privateUser,"respondFollow",{requestId:"bob_privateuser",accept:true});
  assert.equal((await db.doc("users/privateuser").get()).data().followersCount,1);
  assert((await getDoc(doc(bob.db,"posts/private-account"))).exists());
 });
 await check("likes are atomic and idempotent", async () => {
  await Promise.all([api(bob,"like",{postId:"public"}),api(bob,"like",{postId:"public"})]);
  assert.equal((await db.doc("posts/public").get()).data().likesCount,1);
  await api(bob,"unlike",{postId:"public"}); await api(bob,"unlike",{postId:"public"});
  assert.equal((await db.doc("posts/public").get()).data().likesCount,0);
 });
 let commentId;
 await check("comments, replies, and deletion maintain counters", async () => {
  commentId = await api(bob,"comment",{postId:"public",text:"Hello"});
  await api(alice,"reply",{postId:"public",commentId,text:"Thanks"});
  assert.equal((await db.doc(`posts/public/comments/${commentId}`).get()).data().repliesCount,1);
  assert.equal((await getDocs(collection(bob.db,`posts/public/comments/${commentId}/replies`))).size,1);
  await api(eve,"deleteComment",{postId:"public",commentId},403);
  await api(bob,"deleteComment",{postId:"public",commentId}); await api(bob,"deleteComment",{postId:"public",commentId});
  assert.equal((await db.doc("posts/public").get()).data().commentsCount,0);
 });
 await check("notification preferences suppress new notifications; spoofing denied", async () => {
  await setDoc(doc(alice.db,"notificationPrefs/alice"),{likes:false});
  const before = (await db.collection("notifications").where("recipientUid","==","alice").get()).size;
  await api(bob,"like",{postId:"public"});
  assert.equal((await db.collection("notifications").where("recipientUid","==","alice").get()).size,before);
  await denied(setDoc(doc(bob.db,"notifications/forged"),{recipientUid:"alice",senderUid:"alice",type:"adminAction"}));
 });
 let conv;
 await check("new conversations work; nonparticipants cannot read or inject DMs", async () => {
  conv = await api(alice,"conversation",{targetUid:"bob"});
  await api(alice,"sendMessage",{conversationId:conv,text:"Secret"});
  assert.equal((await getDocs(collection(bob.db,`conversations/${conv}/messages`))).size,1);
  await denied(getDocs(collection(eve.db,`conversations/${conv}/messages`)));
  await denied(setDoc(doc(eve.db,`conversations/${conv}/messages/forged`),{senderUid:"eve",text:"attack"}));
  await api(eve,"sendMessage",{conversationId:conv,text:"attack"},403);
 });
 await check("read watermarks and unsend update conversation metadata", async () => {
  await api(bob,"readMessages",{conversationId:conv});
  let state=(await db.doc(`conversations/${conv}`).get()).data(); assert.equal(state.unreadCounts.bob,0); assert(state.lastReadAt.bob);
  await api(alice,"unsend",{conversationId:conv,messageId:state.lastMessage.id});
  assert.equal((await db.doc(`conversations/${conv}`).get()).data().lastMessage.text,"Message unsent");
 });
 await check("story views and reactions count each viewer once", async () => {
  await db.doc("stories/story").set({authorUid:"alice",visibility:"public",isExpired:false,isDeleted:false,expiresAt:Timestamp.fromMillis(Date.now()+3600000),viewsCount:0,reactionsCount:0});
  await api(bob,"viewStory",{storyId:"story"}); await api(bob,"viewStory",{storyId:"story"});
  await api(bob,"reactStory",{storyId:"story",reaction:"heart"}); await api(bob,"reactStory",{storyId:"story",reaction:"wow"});
  const state=(await db.doc("stories/story").get()).data(); assert.equal(state.viewsCount,1);assert.equal(state.reactionsCount,1);
 });
 await check("pagination returns every visible post exactly once", async () => {
  for(let i=0;i<35;i++)await seedPost(`page-${i}`,"alice","public",{isHidden:i%4===0,createdAt:Timestamp.fromMillis(10000+i)});
  let cursor=null,ids=[];do{const page=await api(bob,"posts",{authorUid:"alice",pageSize:7,cursor});ids.push(...page.posts.map(p=>p.id));cursor=page.cursor;}while(cursor);
  const expected=(await db.collection("posts").where("authorUid","==","alice").get()).docs.filter(d=>!d.data().isHidden&&d.data().visibility==="public").map(d=>d.id).sort();
  assert.deepEqual([...ids].sort(),expected);assert.equal(new Set(ids).size,ids.length);
 });
 await check("album invitations cannot be forged; acceptance is atomic", async () => {
  await db.doc("albums/album").set({ownerUid:"alice",type:"collaborative",visibility:"private",mediaCount:0,memberCount:1,updatedAt:Timestamp.now()});
  await denied(setDoc(doc(eve.db,"albumMembers/album_eve"),{albumId:"album",uid:"eve",role:"owner",status:"accepted"}));
  await api(eve,"albumInvite",{albumId:"album",targetUid:"bob",role:"contributor"},403);
  await api(alice,"albumInvite",{albumId:"album",targetUid:"bob",role:"contributor"});
  await api(bob,"albumRespond",{albumId:"album",accept:true});await api(bob,"albumRespond",{albumId:"album",accept:true});
  assert.equal((await db.doc("albums/album").get()).data().memberCount,2);
  assert((await api(bob,"albums")).some(a=>a.id==="album"));
 });
 await check("contributors can share their own media with album members without double counting", async () => {
  await seedPost("bobs-private-photo", "bob", "private");
  await db.doc("media/contributed").set({ownerUid:"bob",postId:"bobs-private-photo",albumId:null,cloudinaryPublicId:"framefolk/users/bob/posts/contributed",createdAt:Timestamp.now()});
  await api(bob,"albumMedia",{albumId:"album",mediaId:"contributed"});
  await api(bob,"albumMedia",{albumId:"album",mediaId:"contributed"});
  assert.equal((await db.doc("albums/album").get()).data().mediaCount,1);
  assert((await getDoc(doc(alice.db,"media/contributed"))).exists());
  await api(eve,"albumMedia",{albumId:"album",mediaId:"contributed"},403);
  await api(alice,"albumMedia",{albumId:"album",mediaId:"contributed",remove:true});
  assert.equal((await db.doc("albums/album").get()).data().mediaCount,0);
 });
 await check("album deletion unlinks media and removes all memberships", async () => {
  await db.doc("media/album-media").set({ownerUid:"bob",albumId:"album",cloudinaryPublicId:"framefolk/users/bob/posts/test",createdAt:Timestamp.now()});
  await api(alice,"albumDelete",{albumId:"album"});
  assert(!(await db.doc("albums/album").get()).exists);assert.equal((await db.doc("media/album-media").get()).data().albumId,null);
  assert.equal((await db.collection("albumMembers").where("albumId","==","album").get()).size,0);
 });
 await check("block removes relationships and denies messages/content in both directions", async () => {
  await api(bob,"follow",{targetUid:"alice"});await api(alice,"follow",{targetUid:"bob"});await api(alice,"block",{targetUid:"bob"});
  await denied(getDoc(doc(bob.db,"posts/public")));await denied(getDocs(collection(bob.db,`conversations/${conv}/messages`)));
  await api(bob,"sendMessage",{conversationId:conv,text:"blocked"},403);await api(bob,"follow",{targetUid:"alice"},403);
  assert.equal((await db.doc("users/alice").get()).data().followersCount,0);
 });
 await check("suspended users cannot bypass rules or server authorization", async () => {
  await db.doc("users/eve").update({status:"suspended"});
  await denied(getDoc(doc(eve.db,"posts/private-account")));await api(eve,"posts",{},403);
  await denied(updateDoc(doc(eve.db,"users/eve"),{status:"approved"}));
 });
 await check("expired suspensions restore on authenticated requests", async () => {
  await db.doc("users/eve").update({suspensionExpiresAt:Timestamp.fromMillis(Date.now()-1000)});
  await api(eve,"posts",{});assert.equal((await db.doc("users/eve").get()).data().status,"approved");
 });
 await check("encrypted credentials are bound to their owner", async () => {
  const encrypted=encryptSecret("personal-secret","alice");assert.equal(decryptSecret(encrypted,"alice"),"personal-secret");
  assert.throws(()=>decryptSecret(encrypted,"bob"));
 });
 await check("delivery URLs authorize audience and use expiring download signatures", async () => {
  await db.doc("media/private-media").set({ownerUid:"alice",postId:"private",visibility:"private",cloudinaryPublicId:"framefolk/users/alice/posts/test",resourceType:"image",format:"jpg",deliveryType:"authenticated",cloudinaryAccountId:"central"});
  const call=async user=>signedUrl(new Request("http://localhost/api/cloudinary/signed-url",{method:"POST",headers:{Authorization:`Bearer ${user.token}`,"Content-Type":"application/json"},body:JSON.stringify({mediaId:"private-media"})}));
  assert.equal((await call(eve)).status,403);
  const response=await call(alice);assert.equal(response.status,200);const {url}=await response.json();assert(url.includes("/image/download?"));assert(url.includes("type=authenticated"));assert(url.includes("expires_at="));
 });
 await check("custom and close-friends audiences are enforced by server and rules", async () => {
  await seedPost("custom", "privateuser", "custom", { customAudienceUids: ["eve"] });
  // Account privacy also applies to explicitly selected audiences.
  await denied(getDoc(doc(eve.db, "posts/custom")));
  await db.doc("users/privateuser").update({ isPrivate: false });
  assert((await getDoc(doc(eve.db,"posts/custom"))).exists());
  await denied(getDoc(doc(alice.db,"posts/custom")));
  await seedPost("close", "privateuser", "closeFriends");
  await denied(getDoc(doc(eve.db,"posts/close")));
  await setDoc(doc(privateUser.db,"closeFriends/privateuser/members/eve"), { uid: "eve" });
  assert((await getDoc(doc(eve.db,"posts/close"))).exists());
 });
 await check("the public directory exposes no private account email documents", async () => {
  await denied(getDoc(doc(bob.db,"users/privateuser")));
  const profile=await api(bob,"user",{targetUid:"privateuser"});assert.equal(profile.uid,"privateuser");assert.equal(profile.email,undefined);
  const suggestions=await api(privateUser,"suggestedUsers",{count:30});assert(suggestions.every(u=>u.username));
 });
 await check("feed includes accounts beyond the first thirty", async () => {
  const batch=db.batch();
  for(let i=0;i<31;i++){batch.set(db.doc(`users/followed${i}`),{status:"approved",isPrivate:false});batch.set(db.doc(`followers/eve/following/followed${i}`),{targetUid:`followed${i}`});}
  await batch.commit();await seedPost("thirty-first", "followed30");
  const page=await api(eve,"posts",{mode:"feed",pageSize:100});assert(page.posts.some(p=>p.id==="thirty-first"));
 });
 await check("owners can create albums and initial owner membership atomically", async () => {
  const batch=writeBatch(privateUser.db);
  batch.set(doc(privateUser.db,"albums/new-album"),{ownerUid:"privateuser",visibility:"private",type:"collaborative",title:"Test album",mediaCount:0,memberCount:1,createdAt:new Date(),updatedAt:new Date()});
  batch.set(doc(privateUser.db,"albumMembers/new-album_privateuser"),{albumId:"new-album",uid:"privateuser",role:"owner",status:"accepted"});
  await batch.commit();assert((await getDoc(doc(privateUser.db,"albums/new-album"))).exists());
 });
 await check("expired and hidden stories/posts never leak through lists", async () => {
  await db.doc("stories/expired").set({authorUid:"eve",visibility:"public",isExpired:false,isDeleted:false,expiresAt:Timestamp.fromMillis(Date.now()-86400000)});
  const stories=await api(eve,"stories");assert(!stories.some(s=>s.id==="expired"));
  await denied(getDoc(doc(eve.db,"stories/expired")));
  await seedPost("future","eve","public",{scheduledFor:Timestamp.fromMillis(Date.now()+3600000)});
  await denied(getDoc(doc(eve.db,"posts/future")));
  assert(!(await api(eve,"posts",{authorUid:"eve"})).posts.some(p=>p.id==="future"));
 });
 await check("new upload signatures use authenticated delivery and personal credentials", async () => {
  await db.doc("cloudinarySecrets/eve").set({cloudName:"personal-cloud",apiKey:"654321",encrypted:encryptSecret("personal-api-secret","eve")});
  await db.doc("cloudinaryConnections/eve").set({ownerUid:"eve",status:"connected"});
  await db.doc("users/eve").update({storageProvider:"personal"});
  const response=await signUpload(new Request("http://localhost/api/cloudinary/sign",{method:"POST",headers:{Authorization:`Bearer ${eve.token}`,"Content-Type":"application/json"},body:JSON.stringify({context:"post",resourceType:"image"})}));
  assert.equal(response.status,200);const params=await response.json();assert.equal(params.type,"authenticated");assert.equal(params.cloudName,"personal-cloud");assert.equal(params.accountId,"eve");
  await denied(getDoc(doc(eve.db,"cloudinarySecrets/eve")));
 });
 await check("new posts and their media/counts are committed together", async () => {
  const id=await api(eve,"createPost",{caption:"A #photo",visibility:"private",mediaResults:[{publicId:"framefolk/users/eve/posts/new",assetId:"asset",resourceType:"image",format:"jpg",width:100,height:100,bytes:100,accountId:"eve",cloudName:"personal-cloud",deliveryType:"authenticated"}]});
  const post=(await db.doc(`posts/${id}`).get()).data();assert.equal(post.mediaIds.length,1);assert.equal((await db.doc(`media/${post.mediaIds[0]}`).get()).data().cloudinaryAccountId,"eve");
  assert.equal((await db.doc("users/eve").get()).data().postsCount,1);
  await denied(getDoc(doc(alice.db,`posts/${id}`)));
 });
 await check("moderator permissions and notification ownership are enforced in callables", async () => {
  const functionsAdmin=require("../functions/node_modules/firebase-admin");
  functionsAdmin.initializeApp({projectId:"demo-framefolk"});
  const {requirePermission}=require("../functions/src/lib/security.ts");
  const {markNotificationsRead}=require("../functions/src/notifications/sendNotification.ts");
  await adminAuth.setCustomUserClaims("eve",{role:"moderator"});
  const context={auth:{uid:"eve",token:{role:"moderator"}}};
  await assert.rejects(requirePermission(context,"canBlockAccounts"));
  await db.doc("permissions/eve").set({canBlockAccounts:true});
  assert.equal((await requirePermission(context,"canBlockAccounts")).uid,"eve");
  await eve.auth.currentUser.getIdToken(true);
  await db.doc("auditLogs/permission-test").set({action:"test"});
  await denied(getDoc(doc(eve.db,"auditLogs/permission-test")));
  await db.doc("permissions/eve").update({canViewAuditLogs:true});
  assert((await getDoc(doc(eve.db,"auditLogs/permission-test"))).exists());
  await db.doc("notifications/alices-notification").set({recipientUid:"alice",isRead:false});
  await assert.rejects(markNotificationsRead.run({notificationIds:["alices-notification"]},context),error=>error.code==="permission-denied");
  assert.equal((await db.doc("notifications/alices-notification").get()).data().isRead,false);
  await functionsAdmin.firestore().terminate();
 });
 console.log(`\n${passed} integration checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 await Promise.all(clients.map(async c=>{await terminate(c.db);await deleteApp(c.app);}));
 await db.terminate();
});
