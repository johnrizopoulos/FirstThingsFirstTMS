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

  // Validate issuer — must be a Clerk FAPI URL (https://...)
  if (!payload.iss || !payload.iss.startsWith("https://")) {
    throw new Error("Invalid issuer");
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

function extractToken(req: Request): string | undefined {
  // Try Authorization: Bearer <token>
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  // Fall back to __session cookie (set by @clerk/react in same-origin prod environments)
  const cookies = req.headers.cookie ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "__session") return rest.join("=");
  }

  return undefined;
}

export function setupClerkMiddleware(_app: Express) {
  // No-op: auth is handled per-request in isAuthenticated
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });

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
