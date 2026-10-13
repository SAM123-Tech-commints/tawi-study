import { createPublicKey, createVerify } from "crypto";

/* ------------------------------------------------------------------ *
 *  Google ID-token verification.
 *
 *  The "Continue with Google" button hands us a signed JWT. The old
 *  approach relied solely on Google's `tokeninfo` endpoint, which is
 *  heavily rate-limited and occasionally returns 4xx for perfectly
 *  valid tokens — making sign-in look "broken". Here we verify the
 *  RS256 signature locally against Google's published JWKS (cached),
 *  and fall back to `tokeninfo` only if that path has a problem.
 * ------------------------------------------------------------------ */

export interface GoogleClaims {
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
  exp?: number;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

const g = globalThis as typeof globalThis & {
  __tawiJwks?: { keys: Jwk[]; at: number };
};

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function fetchJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (g.__tawiJwks && now - g.__tawiJwks.at < 60 * 60 * 1000) return g.__tawiJwks.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const data = await res.json();
  const keys: Jwk[] = Array.isArray(data?.keys) ? data.keys : [];
  g.__tawiJwks = { keys, at: now };
  return keys;
}

/** Verify the JWT's RS256 signature against Google's JWKS and validate the
 *  standard claims. Returns the payload on success, or null. */
async function verifyWithJwks(idToken: string, clientId: string): Promise<GoogleClaims | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  let payload: GoogleClaims;
  try {
    header = JSON.parse(b64url(parts[0]).toString("utf8"));
    payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const keys = await fetchJwks();
  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) return null;

  const pem = createPublicKey({
    key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
    format: "jwk",
  }).export({ type: "spki", format: "pem" });

  const ok = createVerify("RSA-SHA256")
    .update(`${parts[0]}.${parts[1]}`)
    .verify(pem, b64url(parts[2]));
  if (!ok) return null;

  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return null;
  if (payload.aud !== clientId) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now - 60) return null;
  return payload;
}

/** Legacy verification endpoint — used only if local JWKS verification fails
 *  (e.g. a Google key rotation race or an unsupported token shape). */
async function verifyWithTokenInfo(idToken: string): Promise<GoogleClaims | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const claims = (await res.json()) as GoogleClaims;
    return claims?.email ? claims : null;
  } catch {
    return null;
  }
}

/** Returns the verified Google claims for an ID token issued to `clientId`. */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleClaims | null> {
  try {
    const local = await verifyWithJwks(idToken, clientId);
    if (local) return local;
  } catch {
    /* fall through to tokeninfo */
  }
  const viaTokenInfo = await verifyWithTokenInfo(idToken);
  if (viaTokenInfo && viaTokenInfo.aud === clientId) return viaTokenInfo;
  return null;
}
