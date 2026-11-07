"use client";
/** Remove legacy bearer cookies; authorization uses Firebase ID tokens in headers. */
export function clearSessionCookie() {
 document.cookie = "ff_session=; path=/; max-age=0; SameSite=Strict";
}
