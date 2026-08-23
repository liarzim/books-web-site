import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/members";

// Hand-rolled signed session cookie (no JWT library needed): a base64url
// JSON payload plus an HMAC-SHA256 signature over that payload, using a
// server-only secret. Same security property as a JWT HS256 token, just
// without the JWT wire format -- fine here since we're both the issuer
// and the only verifier.

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export interface AdminSession {
  email: string;
  /**
   * The role this session was issued with, decided at sign-in time from
   * content/members.json. A role change made later in the admin UI takes
   * effect the next time that person signs in (their existing session
   * keeps the old role until then).
   */
  role: Role;
}

interface SessionPayload {
  email: string;
  role: Role;
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET environment variable.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(email: string, role: Role): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload: SessionPayload = { email, role, exp };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as SessionPayload;

    if (typeof payload.email !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.role !== "admin" && payload.role !== "editor") {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return { email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

/** For Server Components and Route Handlers: the current admin session, or null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * The exact "/api/admin/auth/callback" URL to send Google, on both the
 * initial authorize request and the token exchange -- Google requires the
 * two to match byte-for-byte. Deriving this from `request.url` is NOT
 * safe on Vercel: every deployment gets its own unique preview URL (e.g.
 * "books-web-site-<hash>-<team>.vercel.app") in addition to the stable
 * production one, and only whichever URL(s) are registered in Google
 * Cloud Console will work -- visiting via any other URL fails with
 * "Error 400: redirect_uri_mismatch". SITE_URL pins this to one fixed,
 * known origin (your production domain) regardless of which URL someone
 * actually browsed to. Falls back to request.url when SITE_URL isn't
 * set, so local dev keeps working without extra config.
 */
export function getAuthCallbackUrl(request: NextRequest): string {
  const configuredOrigin = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  const origin = configuredOrigin || new URL(request.url).origin;
  return `${origin}/api/admin/auth/callback`;
}
