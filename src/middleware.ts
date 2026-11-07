import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routing only. Authentication comes from Firebase Auth in the client shells;
// every data operation is independently authorized by the server or Firestore rules.
export function middleware(request: NextRequest) {
 if (request.nextUrl.pathname.startsWith("/@")) {
  const url = request.nextUrl.clone();
  url.pathname = "/" + url.pathname.slice(2);
  return NextResponse.rewrite(url);
 }
 return NextResponse.next();
}
export const config = { matcher: ["/@:path*"] };
