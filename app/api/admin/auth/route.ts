import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCallbackUrl } from "@/lib/adminAuth";

export const runtime = "nodejs";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE = "admin_oauth_state";

/** Step 1: send the browser to Google's consent screen. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new NextResponse("Missing GOOGLE_OAUTH_CLIENT_ID environment variable.", {
      status: 500,
    });
  }

  // The state cookie set below is only readable by whatever origin actually
  // served this response -- but Google's redirect back always lands on
  // SITE_URL's origin (see getAuthCallbackUrl). If someone opens /admin via
  // any OTHER URL (a Vercel preview link, "www." vs bare domain, a stale
  // bookmark, http instead of https, ...) and clicks sign-in from there,
  // the cookie gets written for that other origin, Google's callback comes
  // back to SITE_URL's origin instead, the browser doesn't send a
  // different-origin cookie, and the callback fails with "Invalid or
  // missing OAuth state" -- not a one-off glitch, but guaranteed every time
  // sign-in starts from a non-canonical URL. Recognizing that failure mode
  // and telling people "always use the stable URL" (as the README does)
  // only helps if they remember to; redirecting to the canonical origin
  // *before* setting anything makes the whole class of mismatch
  // structurally impossible instead of relying on that.
  const configuredOrigin = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configuredOrigin) {
    const currentUrl = new URL(request.url);
    if (currentUrl.origin !== configuredOrigin) {
      const canonicalUrl = new URL(currentUrl.pathname + currentUrl.search, configuredOrigin);
      return NextResponse.redirect(canonicalUrl);
    }
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = getAuthCallbackUrl(request);

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
