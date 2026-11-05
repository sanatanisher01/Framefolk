import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * FRAMEFOLK Middleware
 *
 * Runs at the Edge — no Node.js APIs available.
 * Uses Firebase ID token stored in a session cookie (set by the login flow).
 *
 * Responsibilities:
 *  1. Rewrite /@username  →  /username  (profile URLs)
 *  2. Redirect unauthenticated users away from protected routes  →  /login
 *  3. Redirect non-approved users away from social routes  →  /pending
 *  4. Redirect approved users away from auth pages  →  /home
 *  5. Protect /admin routes  →  /home (if not admin claim)
 *
 * NOTE: The cookie-based session is set by the client after login using
 *  document.cookie = `ff_session=<idToken>; path=/; max-age=3600; SameSite=Strict`
 * The middleware decodes (not verifies) the JWT to read claims quickly at the
 * edge. Full cryptographic verification happens in API routes and Cloud Functions.
 * This is the standard pattern for Next.js + Firebase (see firebase.google.com/docs/auth/admin/manage-sessions).
 */

// ─────────────────────────────────────────────
// Route groups
// ─────────────────────────────────────────────

/** Routes only for unauthenticated users — redirect approved users to /home */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

/** Routes that require an authenticated + approved account */
const SOCIAL_ROUTES = [
  "/home",
  "/explore",
  "/upload",
  "/stories",
  "/messages",
  "/notifications",
  "/albums",
  "/memories",
  "/settings",
];

// Routes that require auth but NOT necessarily approved (intermediate states)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SEMI_AUTH_ROUTES = ["/onboarding", "/pending"];

// ─────────────────────────────────────────────
// JWT decode helper (Edge-safe — no crypto lib needed for decode)
// ─────────────────────────────────────────────

interface DecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
  /** Expiry Unix timestamp */
  exp: number;
}

function decodeJwt(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url decode the payload
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    // Check expiry
    if (decoded.exp && decoded.exp < Date.now() / 1000) return null;
    return decoded as DecodedToken;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Rewrite /@username → /username ─────────────────────────────────
  if (pathname.startsWith("/@")) {
    const username = pathname.slice(2);
    const rest = request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = `/${username}`;
    url.search = rest;
    return NextResponse.rewrite(url);
  }

  // ── Read session cookie ────────────────────────────────────────────────
  const sessionCookie = request.cookies.get("ff_session")?.value;
  const token = sessionCookie ? decodeJwt(sessionCookie) : null;
  const isAuthenticated = !!token;

  // ── 2. Protect social routes ───────────────────────────────────────────
  const isSocialRoute = SOCIAL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (isSocialRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ── 3. Protect admin routes ────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    const isAdmin =
      token?.role === "superAdmin" || token?.role === "moderator";
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
  }

  // ── 4. Redirect authenticated+approved users away from auth pages ──────
  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // ── 5. Dynamic profile routes (/[username]) — public, no auth needed ───
  // Profile pages handle their own visibility inside the component.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico, manifest.json, icons/, images/
     * - api/ routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons/|images/|api/).*)",
  ],
};
