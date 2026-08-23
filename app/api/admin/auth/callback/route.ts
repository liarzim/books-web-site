import { createPublicKey, createVerify } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/adminAuth";
import { findMemberRole } from "@/lib/members";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const STATE_COOKIE = "admin_oauth_state";

interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
}

/**
 * Verifies a Google ID token (a JWT) by hand: checks the RS256 signature
 * against Google's published JWKS using Node's built-in crypto (no JWT
 * library dependency), then checks issuer/audience/expiry. Throws on any
 * failure -- callers should treat that as "reject the sign-in".
 */
async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleIdTokenPayload> {
  const [headerB64, payloadB64, signatureB64] = idToken.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("Malformed ID token.");
  }

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8")) as {
    kid: string;
  };
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf-8"),
  ) as GoogleIdTokenPayload;

  const certsResponse = await fetch(GOOGLE_CERTS_URL);
  if (!certsResponse.ok) {
    throw new Error("Failed to fetch Google's signing keys.");
  }
  const { keys } = (await certsResponse.json()) as { keys: GoogleJwk[] };
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("No matching Google signing key for this token.");
  }

  // Cast via the function's own parameter type rather than naming Node's
  // JWK type directly -- avoids depending on the exact type export name.
  // Routed through `unknown` first: Node's real JsonWebKey type carries a
  // string index signature that our plain GoogleJwk interface doesn't, so
  // TypeScript's strict type-checker (as opposed to a loose `tsc --noEmit`
  // without the real @types/node resolved) rejects a direct cast as
  // "insufficient overlap" -- unknown-mediated casts sidestep that check.
  const publicKey = createPublicKey({
    key: jwk,
    format: "jwk",
  } as unknown as Parameters<typeof createPublicKey>[0]);

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(publicKey, Buffer.from(signatureB64, "base64url"));
  if (!signatureValid) {
    throw new Error("Invalid ID token signature.");
  }

  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("Unexpected token issuer.");
  }
  if (payload.aud !== clientId) {
    throw new Error("Unexpected token audience.");
  }
  if (payload.exp * 1000 < Date.now()) {
    throw new Error("Expired ID token.");
  }

  return payload;
}

/** Step 2: Google redirects back here with a code; exchange it, verify the
 * identity it proves, check the allowlist, and issue our own session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return new NextResponse("Invalid or missing OAuth state.", { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET environment variables.",
      { status: 500 },
    );
  }

  const redirectUri = new URL("/api/admin/auth/callback", request.url).toString();

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenData.id_token) {
    return new NextResponse(
      `Google OAuth error: ${tokenData.error_description ?? tokenData.error ?? "unknown error"}`,
      { status: 400 },
    );
  }

  let payload: GoogleIdTokenPayload;
  try {
    payload = await verifyGoogleIdToken(tokenData.id_token, clientId);
  } catch (error) {
    return new NextResponse(
      `Could not verify Google sign-in: ${error instanceof Error ? error.message : "unknown error"}`,
      { status: 400 },
    );
  }

  if (!payload.email || !payload.email_verified) {
    return new NextResponse("Your Google account has no verified email address.", {
      status: 403,
    });
  }

  const role = findMemberRole(payload.email);
  if (!role) {
    return new NextResponse(
      `${payload.email} is not on the member list. Ask an admin to add it in /admin/members.`,
      { status: 403 },
    );
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(payload.email, role), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
