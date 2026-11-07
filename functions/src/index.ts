/**
 * FRAMEFOLK — Cloud Functions entry point
 * Exports all functions by category.
 */

// Auth triggers & callables
export * from "./auth/onUserCreate";
export * from "./auth/approveAccount";
export * from "./auth/rejectAccount";
export * from "./auth/setRole";

// Admin callables
export * from "./admin/blockAccount";
export * from "./admin/unblockAccount";
export * from "./admin/suspendAccount";

// Notifications
export * from "./notifications/sendNotification";

// Cloudinary — Phase 3
export * from "./cloudinary/deleteAsset";
export * from "./cloudinary/generateUploadSignature";

// Stories — Phase 5
export * from "./stories/expireStories";

// Moderation — Phase 6
export * from "./moderation/handleReport";
export * from "./moderation/processDeletionRequest";

export * from "./admin/restoreSuspensions";
