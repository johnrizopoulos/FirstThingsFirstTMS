import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";

// Exact Clerk FAPI issuer for this deployment, e.g. https://your-app.clerk.accounts.dev
// When set the JWT `iss` claim must match exactly. Strongly recommended in production.
const CLERK_ISSUER = (process.env.CLERK_ISSUER || "").trim();

// Comma-separated allowlist of frontend origins whose tokens/requests we trust,
// e.g. https://myapp.replit.app,https://myapp.com
// When empty, ALL cookie-backed requests are rejected (fail-closed CSRF protection).
const CLERK_AUTHORIZED_PARTIES: string[] = (process.env.CLERK_AUTHORIZED_PARTIES || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Emit configuration warnings at module load time so operators notice immediately.
// In production, missing CLERK_ISSUER is a fatal misconfiguration.
if (!CLERK_ISSUER) {
  if (IS_PRODUCTION) {
    throw new Error(
      "[auth] FATAL: CLERK_ISSUER must be set in production. " +
      "Set it to your Clerk FAPI URL (e.g. https://your-app.clerk.accounts.dev)."
    );
  }
  console.warn(
    "[auth] WARNING: CLERK_ISSUER is not set. " +
    "Set it to your Clerk FAPI URL (e.g. https://your-app.clerk.accounts.dev) " +
    "to enable exact issuer pinning. This will be a fatal error in production."
  );
}
if (CLERK_AUTHORIZED_PARTIES.length === 0) {
  console.warn(
    "[auth] WARNING: CLERK_AUTHORIZED_PARTIES is not set. " +
    "All cookie-backed API requests will be rejected. " +
    "Set it to the comma-separated list of allowed frontend origins."
  );
}

// JWKS cache — refresh once per hour
interface JwkKey {
  kid: string;
  alg: string;
  [key: string]: unknown;
}
let jwksCache: JwkKey[] | null = null;
let jwksCacheTime = 0;
const JWKS_TTL = 3_600_000;

async function fetchJwks(): Promise<JwkKey[]> {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_TTL) return jwksCache;

  const res = await fetch("https://api.clerk.com/v1/jwks", {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const json = await res.json() as { keys: JwkKey[] };
  jwksCache = json.keys;
  jwksCacheTime = Date.now();
  return jwksCache;
}

interface ClerkPayload {
  sub: string;
  exp: number;
  nbf?: number;
  iss?: string;
  azp?: string;
  [key: string]: unknown;
}

async function verifyClerkJwt(token: string): Promise<ClerkPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString()) as {
    kid: string;
    alg: string;
  };
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString()
  ) as ClerkPayload;

  const now = Math.floor(Date.now() / 1000);

  // Validate required claims
  if (!payload.sub) throw new Error("Missing sub claim");
  if (!payload.exp || now > payload.exp) throw new Error("Token expired");
  if (payload.nbf && now < payload.nbf) throw new Error("Token not yet valid");

  // Validate issuer.
  // When CLERK_ISSUER is configured: require an exact match (pin to this deployment's FAPI URL).
  // Otherwise: require at minimum an https:// scheme (Clerk always uses HTTPS for FAPI).
  if (!payload.iss) throw new Error("Missing iss claim");
  if (CLERK_ISSUER) {
    if (payload.iss !== CLERK_ISSUER) {
      throw new Error(`Untrusted issuer: ${payload.iss}`);
    }
  } else if (!payload.iss.startsWith("https://")) {
    throw new Error("Invalid issuer");
  }

  // Validate authorized party (azp) against the allowlist when one is configured.
  // Clerk sets azp to the frontend origin the token was issued for.
  // This is the control Clerk's own documentation calls out for subdomain cookie leakage.
  if (CLERK_AUTHORIZED_PARTIES.length > 0) {
    if (!payload.azp) throw new Error("Missing azp claim — token has no authorized party");
    if (!CLERK_AUTHORIZED_PARTIES.includes(payload.azp)) {
      throw new Error(`Unauthorized party: ${payload.azp}`);
    }
  }

  const keys = await fetchJwks();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("No matching JWK for kid: " + header.kid);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = Buffer.from(sigB64, "base64url");

  const valid = await globalThis.crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sig,
    data
  );
  if (!valid) throw new Error("Invalid JWT signature");

  return payload;
}

/**
 * Returns the request origin extracted from the Origin header, or derived from
 * the Referer header when Origin is absent (older browsers / some fetch polyfills).
 */
function requestOrigin(req: Request): string | undefined {
  const origin = req.headers["origin"];
  if (origin) return origin;

  const referer = req.headers["referer"];
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function extractToken(req: Request): { token: string; fromCookie: boolean } | undefined {
  // Try Authorization: Bearer <token>
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return { token: auth.slice(7), fromCookie: false };

  // Fall back to __session cookie (set by @clerk/react in same-origin prod environments)
  const cookies = req.headers.cookie ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "__session") return { token: rest.join("="), fromCookie: true };
  }

  return undefined;
}

export function setupClerkMiddleware(_app: Express) {
  // No-op: auth is handled per-request in isAuthenticated
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const extracted = extractToken(req);
  if (!extracted) return res.status(401).json({ message: "Unauthorized" });

  const { token, fromCookie } = extracted;

  // Cookie-backed requests carry no custom header that a cross-origin form/fetch cannot
  // trivially replicate, so we enforce an Origin check before touching the JWT.
  // Fail-closed: if CLERK_AUTHORIZED_PARTIES is not configured, cookie auth is disabled.
  if (fromCookie) {
    if (CLERK_AUTHORIZED_PARTIES.length === 0) {
      return res.status(403).json({
        message: "Forbidden: cookie-based auth is disabled until CLERK_AUTHORIZED_PARTIES is configured",
      });
    }
    const origin = requestOrigin(req);
    if (!origin || !CLERK_AUTHORIZED_PARTIES.includes(origin)) {
      return res.status(403).json({ message: "Forbidden: origin not allowed" });
    }
  }

  try {
    const payload = await verifyClerkJwt(token);
    const clerkUserId = payload.sub;

    let user = await storage.getUserByClerkId(clerkUserId);

    if (!user) {
      // Fetch user details from Clerk Admin API
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
      });
      if (!clerkRes.ok) throw new Error(`Clerk user fetch failed: ${clerkRes.status}`);

      const clerkUser = await clerkRes.json() as {
        email_addresses: Array<{ email_address: string }>;
        first_name: string | null;
        last_name: string | null;
      };

      const email =
        clerkUser.email_addresses[0]?.email_address || `${clerkUserId}@clerk.local`;
      const name =
        [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || email;

      user = await storage.upsertUserByClerkId(clerkUserId, email, name);
    }

    req.userId = user.id;
    next();
  } catch (err: unknown) {
    console.error("Auth error:", err instanceof Error ? err.message : err);
    res.status(401).json({ message: "Unauthorized" });
  }
}
