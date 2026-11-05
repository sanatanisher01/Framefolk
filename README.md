# FRAMEFOLK

> Every frame has a story.

FRAMEFOLK is a premium photo and video sharing social network — an installable Progressive Web App combining Instagram-style social mechanics with a high-quality photography community experience and an admin-moderated private membership model.

---

## Current Phase

**Phase 1 — Foundation: Complete**

Project scaffold, design system, branding, application shell, landing page, auth page shells, all route stubs, PWA manifest, Firestore rules and indexes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui primitives |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Media | Cloudinary (signed uploads + authenticated delivery) |
| PWA | Web App Manifest + Service Worker |
| Notifications | Firebase Cloud Messaging |
| Hosting | Vercel (Next.js) |

---

## Getting Started

### 1. Install dependencies

```bash
cd framefolk
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the required values — see the comments in `.env.example` for where to find each one.

**Required for Phase 2 (auth + database):**
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web app config (Firebase Console → Project Settings)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Service account key (Firebase Console → Project Settings → Service Accounts)

**Required for Phase 3 (media):**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary Console → Dashboard

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
framefolk/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Register, Forgot Password, Onboarding
│   │   ├── (social)/        # Home, Explore, Upload, Stories, Messages, etc.
│   │   ├── @[username]/     # User profile pages
│   │   └── admin/           # Admin dashboard
│   ├── components/
│   │   ├── ui/              # Button, Input, Avatar, Badge, Card, etc.
│   │   ├── layout/          # Sidebar, BottomNav, MobileHeader, LandingPage
│   │   ├── feed/            # Post cards, feed list
│   │   ├── profile/         # Profile header, photo grid
│   │   ├── upload/          # Upload composer
│   │   ├── stories/         # Story viewer/creator
│   │   ├── messaging/       # Chat UI
│   │   ├── albums/          # Album management
│   │   └── admin/           # Admin dashboard components
│   ├── lib/
│   │   ├── firebase/        # Firebase SDK initialisation
│   │   ├── cloudinary/      # Cloudinary helpers
│   │   ├── auth/            # Auth context + session
│   │   ├── permissions/     # Role/permission checks
│   │   └── validations/     # Zod schemas
│   ├── hooks/               # useMediaQuery, useDebounce, useLocalStorage, useToast
│   ├── services/            # Business logic services
│   ├── types/               # TypeScript type definitions
│   └── utils/               # cn, format, validators
├── functions/               # Firebase Cloud Functions (Phase 2+)
├── docs/                    # Architecture, requirements, schema, security docs
├── public/
│   ├── icons/               # PWA icons (SVG)
│   ├── favicon.svg
│   └── manifest.json
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Composite indexes
├── firebase.json            # Firebase CLI configuration
└── .env.example             # Required environment variables (copy to .env.local)
```

---

## Implementation Phases

| Phase | Name | Status |
|---|---|---|
| 0 | Specification & Documentation | ✅ Complete |
| 1 | Foundation (scaffold, design, shell, landing) | ✅ Complete |
| 2 | Firebase Auth, Registration Approval, Profiles | ⏳ Next |
| 3 | Cloudinary Integration, Signed Uploads | 🔒 Pending |
| 4 | Home Feed, Posts, Likes, Comments, Follow | 🔒 Pending |
| 5 | Stories, Direct Messaging | 🔒 Pending |
| 6 | Admin Dashboard, Moderation, Deletion Workflow | 🔒 Pending |
| 7 | Albums, Collaborative Memories | 🔒 Pending |
| 8 | PWA, Push Notifications, Production Deploy | 🔒 Pending |

---

## Design System

| Token | Value |
|---|---|
| Primary background | `#101114` |
| Secondary background | `#17181D` |
| Card background | `#202126` |
| Accent | `#FF765E` |
| Primary text | `#F4F0E8` |
| Secondary text | `#A5A3AA` |
| Border | `#303137` |
| Font (body) | Inter |
| Font (display) | Manrope |

---

## Security Notes

- All privileged operations run in Firebase Cloud Functions — never from the client.
- Firestore security rules are the authoritative access control layer.
- Cloudinary API secrets are server-side only; signatures are generated in Cloud Functions.
- Private media uses short-lived signed Cloudinary URLs — never exposed public_id links.
- Admin roles are enforced via Firebase custom claims, not Firestore fields.
- User Cloudinary credentials (Mode B) are stored in Firebase Secret Manager only.

See `docs/SECURITY.md` for the full security architecture.

---

## Available Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run type-check   # TypeScript type check only (tsc --noEmit)
```

---

## Configuration Required Before Phase 2

You will need to provide these before starting Phase 2:

1. **Firebase project** — create at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable: Authentication (Email/Password + Google), Firestore, Functions, Storage, Cloud Messaging
   - Copy web app config to `.env.local`
   - Download service account key → set `FIREBASE_SERVICE_ACCOUNT_JSON`

2. **Cloudinary account** — create at [cloudinary.com](https://cloudinary.com) (needed for Phase 3)
   - Copy Cloud Name, API Key, API Secret to `.env.local`
   - Create an upload preset named `framefolk_uploads`

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Security](docs/SECURITY.md)
- [Cloudinary Integration](docs/CLOUDINARY.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Implementation Status](docs/IMPLEMENTATION_STATUS.md)
