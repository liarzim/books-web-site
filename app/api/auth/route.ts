import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const STATE_COOKIE = "decap_oauth_state";

/**
 * Step 1 of Decap CMS's GitHub OAuth flow: the admin UI opens this route
 * in a popup, we redirect straight to GitHub's consent screen. See
 * app/api/callback/route.ts for step 2.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;

  if (!clientId) {
    return new NextResponse(
      "Missing GITHUB_OAUTH_CLIENT_ID environment variable.",
      { status: 500 },
    );
  }

  // CSRF protection: verified against the cookie when GitHub redirects back.
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/callback", request.url).toString();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo,user");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes: just long enough to complete the redirect round trip
    path: "/",
  });

  return response;
}
