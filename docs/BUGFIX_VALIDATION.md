# Bug fixes and deployment checklist

The code changes address the 40 findings in the chat audit. They have not been deployed to the live Firebase project or hosting provider.

## Implemented

- Private posts, stories, media, albums, custom audiences, close friends, blocks, and inactive accounts are checked at the data boundary. Private user email documents are owner/admin only; directory responses omit email.
- Cross-user writes for follows, requests, likes, comments/replies, story views/reactions, messaging, and album collaboration run in authenticated server transactions or batches. Repeat actions do not double-count.
- Username reservations change atomically. Users cannot edit status, counts, or another user's reservation.
- DM membership is checked for every read/write. Recent messages load first with older-history loading, read watermarks, unread totals, and unsend previews.
- Feed pagination preserves all consumed records and includes more than thirty followed accounts. Explore/profile lists use the same audience checks. Approved followers can see private profiles.
- Registration initialization is create-only and uses the same automatic approval policy on client and trigger.
- Moderator permissions are enforced by callables and rules. Admin actions no longer silently fall back after authorization failures. Reports moderate their target before closing. Deletion is validated, retryable, and uses the asset's actual Cloudinary account and delivery type.
- Timed suspensions restore automatically. Story expiry/cleanup paginates instead of silently stopping at a fixed batch size.
- New content uploads use authenticated Cloudinary delivery. Authorized, expiring download URLs handle images, videos, and thumbnails. Personal secrets are encrypted in a server-only collection with AES-256-GCM; disconnecting keeps credentials for previously uploaded media.
- Notification producers honor preferences; notifications cannot be spoofed or marked read by another recipient.
- Sharing and notification links target the relevant content. Replies render. Story uploads occur once, video progression follows playback, and partial post uploads have a retry path.
- Authenticated pages/media are excluded from service-worker caching; cache versions are stamped on every build. Legacy bearer cookies are removed and are no longer trusted by middleware.
- TypeScript/lint configuration is repaired. Composite indexes are supplied. Custom audiences, close-friends editing, album media selection, and unread badges have working UI paths.

## Local verification

```powershell
npm run typecheck
npm run lint
npm run build
npm --prefix functions run build
$env:JAVA_BINARY = 'C:/Program Files/Java/jdk-22/bin/java.exe' # or your Java 21+ installation
npm run test:integration
```

The integration runner uses isolated local Auth/Firestore emulators and the `demo-framefolk` project. It does not connect to production. It requires Java, Firebase CLI's Auth emulator package, and the cached Firestore emulator JAR. Override `FIREBASE_TOOLS_PATH` or `FIRESTORE_EMULATOR_JAR` if installed elsewhere. Loopback connections must be permitted.

27 emulator integration checks passed. The suite covers authorization failures and successful transactions, privacy, blocking, pagination, counts/idempotency, messaging, collaboration, notifications, credential encryption, upload signing, and moderator permissions. Browser checks verified login, sending a local demo message, and creating/opening an album.

## Required before live rollout

1. **Rotate the exposed central Cloudinary API secret.** A real secret was present in tracked `.env.production`; its current value has been removed from that file, but Git history still contains it. Set the replacement in secure hosting/Functions environment configuration. Never commit replacement credentials.
2. **Configure Firebase Admin credentials on the Next.js server.** This checkout has neither `FIREBASE_SERVICE_ACCOUNT_JSON` nor local Application Default Credentials configured. Use a server-side service account or the hosting platform's managed service identity with access to this Firebase project. The transaction APIs deliberately fail closed without these credentials.
3. **Use a full Next.js server host.** Run `npm run build` / `npm start` or use Vercel/Firebase App Hosting. `.next` is not a static website and must not be deployed as a Firebase Hosting `public` directory. Firebase CLI configuration here manages rules, indexes, and Functions only.
4. **Deploy backend and frontend together.** Build/deploy Functions and Firestore rules/indexes to the intended project, wait for indexes to finish building, then deploy the Next.js application. Old clients that attempt the former direct writes will be rejected by the new rules; a maintenance window or staged rollout is appropriate.
5. **Keep encryption keys consistent.** Set `CLOUDINARY_CREDENTIAL_KEY` to the same stable, high-entropy secret in Next.js and Functions. If unset, the code uses the central Cloudinary API secret as its encryption key; rotating that fallback requires re-encrypting existing personal credentials. Previously saved placeholder-only connections must be reconnected.
6. **Migrate legacy media.** New authenticated uploads do not retroactively protect previously public Cloudinary URLs. After credentials are configured, review `node scripts/migrate-media-privacy.mjs` (dry run), then explicitly run it with `--apply`. It converts legacy post/story assets to authenticated delivery and requests CDN invalidation. It is restartable and leaves profile images public. CDN invalidation takes time; files already downloaded cannot be recalled.
7. **Verify real provider operations.** Test upload/playback/thumbnail generation, personal-account connect/disconnect, email verification/reset, scheduled jobs, and approved Cloudinary deletion against the deployed environment. Local tests validate signing and authorization but do not upload/delete real Cloudinary assets or send email.

Existing inconsistent follower/counter records created by the old partial-write paths may require a data reconciliation. These fixes prevent new partial writes; they do not silently rewrite production history.

Cloudinary protocol references: [access control](https://cloudinary.com/documentation/control_access_to_media), [upload and rename APIs](https://cloudinary.com/documentation/image_upload_api_reference).
