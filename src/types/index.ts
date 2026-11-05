/**
 * FRAMEFOLK — Core TypeScript Types
 *
 * These are the primary data types used across the application.
 * They mirror the Firestore schema defined in docs/DATABASE_SCHEMA.md.
 */

// ─────────────────────────────────────────────
// ENUMS / UNIONS
// ─────────────────────────────────────────────

export type AccountStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "suspended";

export type UserRole = "superAdmin" | "moderator" | "user";

export type StorageProvider = "central" | "personal";

export type PostVisibility =
  | "public"
  | "followers"
  | "closeFriends"
  | "private"
  | "custom";

export type PostType = "photo" | "video" | "multi";

export type ResourceType = "image" | "video" | "raw";

export type StoryType = "photo" | "video" | "text";

export type MessageType = "text" | "image" | "video";

export type AlbumType = "personal" | "collaborative";

export type AlbumRole = "owner" | "contributor" | "viewer";

export type ReportReason =
  | "spam"
  | "nudity"
  | "harassment"
  | "misinformation"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";

export type DeletionRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "failed";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "followRequest"
  | "storyReply"
  | "message"
  | "albumInvite"
  | "adminAction"
  | "deletionUpdate";

export type AuditAction =
  | "accountApproved"
  | "accountRejected"
  | "accountBlocked"
  | "accountUnblocked"
  | "accountSuspended"
  | "accountRestored"
  | "roleAssigned"
  | "permissionChanged"
  | "deletionApproved"
  | "deletionRejected"
  | "contentHidden"
  | "contentRestored"
  | "contentRemoved"
  | "reportActioned"
  | "reportDismissed";

export type CloudinaryConnectionStatus = "connected" | "disconnected" | "error";

export type FollowRequestStatus = "pending" | "accepted" | "rejected";

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

// ─────────────────────────────────────────────
// USER & PROFILE
// ─────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  bio: string;
  profilePhotoUrl: string;
  profilePhotoPublicId: string;
  coverPhotoUrl: string;
  coverPhotoPublicId: string;
  status: AccountStatus;
  isPrivate: boolean;
  isEmailVerified: boolean;
  storageProvider: StorageProvider;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  theme: string;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
}

export interface Profile {
  uid: string;
  website: string;
  location: string;
  pronouns: string;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  highlightOrder: string[];
  featuredPostIds: string[];
  closeFriendCount: number;
  updatedAt: Date;
}

/** Lightweight user reference used in denormalized fields */
export interface UserRef {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string;
}

// ─────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────

export interface Post {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoUrl: string;
  type: PostType;
  caption: string;
  hashtags: string[];
  mentions: string[];
  mediaIds: string[];
  coverMediaId: string;
  visibility: PostVisibility;
  customAudienceUids: string[];
  location: PostLocation | null;
  likesCount: number;
  commentsCount: number;
  isHidden: boolean;
  isPinned: boolean;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostLocation {
  name: string;
  lat?: number;
  lng?: number;
}

export interface Comment {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorPhotoUrl: string;
  text: string;
  mentions: string[];
  likesCount: number;
  repliesCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// MEDIA
// ─────────────────────────────────────────────

export interface Media {
  id: string;
  ownerUid: string;
  postId: string | null;
  storyId: string | null;
  albumId: string | null;
  storageProvider: StorageProvider;
  cloudinaryAccountId: string;
  cloudinaryPublicId: string;
  assetId: string;
  resourceType: ResourceType;
  format: string;
  width: number;
  height: number;
  duration: number | null;
  bytes: number;
  visibility: PostVisibility;
  isPrivate: boolean;
  thumbnailPublicId: string | null;
  altText: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// STORIES
// ─────────────────────────────────────────────

export interface Story {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorPhotoUrl: string;
  type: StoryType;
  mediaId: string | null;
  textContent: string | null;
  textStyle: StoryTextStyle | null;
  caption: string | null;
  visibility: PostVisibility;
  customAudienceUids: string[];
  viewsCount: number;
  reactionsCount: number;
  expiresAt: Date;
  isExpired: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryTextStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
  background: string;
}

export interface StoryView {
  id: string;
  storyId: string;
  viewerUid: string;
  reaction: string | null;
  reply: string | null;
  viewedAt: Date;
}

export interface StoryHighlight {
  id: string;
  ownerUid: string;
  title: string;
  coverMediaId: string;
  storyIds: string[];
  visibility: PostVisibility;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// MESSAGING
// ─────────────────────────────────────────────

export interface Conversation {
  id: string;
  participants: [string, string];
  lastMessage: LastMessage | null;
  lastMessageAt: Date | null;
  unreadCounts: Record<string, number>;
  createdAt: Date;
}

export interface LastMessage {
  text: string;
  senderUid: string;
  sentAt: Date;
  type: MessageType;
}

export interface Message {
  id: string;
  senderUid: string;
  type: MessageType;
  text: string | null;
  mediaId: string | null;
  isRead: boolean;
  readAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// ALBUMS
// ─────────────────────────────────────────────

export interface Album {
  id: string;
  ownerUid: string;
  title: string;
  description: string;
  coverMediaId: string | null;
  mediaCount: number;
  type: AlbumType;
  visibility: PostVisibility;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumMember {
  id: string;
  albumId: string;
  uid: string;
  role: AlbumRole;
  invitedBy: string;
  status: "pending" | "accepted" | "rejected";
  joinedAt: Date | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// SOCIAL
// ─────────────────────────────────────────────

export interface Notification {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderUsername: string;
  senderPhotoUrl: string;
  type: NotificationType;
  entityType: "post" | "comment" | "story" | "album" | "user";
  entityId: string;
  text: string;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface FollowRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: FollowRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  reporterUid: string;
  entityType: "post" | "story" | "user" | "comment";
  entityId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────

export interface DeletionRequest {
  id: string;
  requesterUid: string;
  entityType: "post" | "story" | "media";
  entityId: string;
  mediaIds: string[];
  reason: string;
  status: DeletionRequestStatus;
  adminUid: string | null;
  adminNote: string | null;
  cloudinaryJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPermissions {
  uid: string;
  canApproveRegistrations: boolean;
  canRejectRegistrations: boolean;
  canBlockAccounts: boolean;
  canApproveDeleteRequests: boolean;
  canHideContent: boolean;
  canViewReports: boolean;
  canViewAuditLogs: boolean;
  grantedBy: string;
  grantedAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorRole: UserRole;
  action: AuditAction;
  targetUid: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// CLOUDINARY
// ─────────────────────────────────────────────

export interface CloudinaryConnection {
  id: string;
  ownerUid: string;
  cloudName: string;
  status: CloudinaryConnectionStatus;
  secretRef: string;
  usageBytes: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadSignature {
  signature: string;
  apiKey: string;
  cloudName: string;
  timestamp: number;
  folder: string;
  eager?: string;
}

// ─────────────────────────────────────────────
// UI / COMPONENT HELPERS
// ─────────────────────────────────────────────

/** Generic async state shape */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Pagination cursor for Firestore */
export interface PaginationState {
  hasMore: boolean;
  loading: boolean;
  cursor: unknown | null;
}

/** Upload progress state */
export interface UploadProgress {
  file: File;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  result?: { publicId: string; secureUrl: string; assetId: string };
}
