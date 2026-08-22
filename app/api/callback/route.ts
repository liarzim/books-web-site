import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const STATE_COOKIE = "decap_oauth_state";

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Step 2 of Decap CMS's GitHub OAuth flow. GitHub redirects the popup here
 * with a `code`; we exchange it server-side for an access token (so the
 * client secret never reaches the browser), then hand the token back to
 * the CMS window via the postMessage handshake Decap's "custom backend"
 * docs specify: https://decapcms.org/docs/custom-backend/
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return new NextResponse("Invalid or missing OAuth state.", { status: 400 });
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      "Missing GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET environment variables.",
      { status: 500 },
    );
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: new URL("/api/callback", request.url).toString(),
    }),
  });

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;

  if (!tokenData.access_token) {
    return new NextResponse(
      `GitHub OAuth error: ${tokenData.error_description ?? tokenData.error ?? "unknown error"}`,
      { status: 400 },
    );
  }

  // The popup first waits for a ping from its opener (the CMS window),
  // then replies with the token -- this two-way handshake is what Decap's
  // GitHub backend expects and avoids a race where the message is sent
  // before the opener is listening for it.
  const message = `authorization:github:success:${JSON.stringify({
    token: tokenData.access_token,
    provider: "github",
  })}`;
  const messageLiteral = JSON.stringify(message);

  const html = `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        function receiveMessage(event) {
          window.opener.postMessage(${messageLiteral}, event.origin);
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
  </body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
