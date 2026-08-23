import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

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

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/admin/auth/callback", request.url).toString();

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
