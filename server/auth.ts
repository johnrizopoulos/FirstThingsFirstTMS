import { createClerkClient } from "@clerk/backend";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

export function setupClerkMiddleware(_app: Express) {
  // No-op: Clerk auth is verified per-request in isAuthenticated
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    // Convert Express request to Web Fetch Request for Clerk SDK
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const requestUrl = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val) {
        if (Array.isArray(val)) {
          val.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    const webRequest = new Request(requestUrl, { headers });
    const requestState = await clerk.authenticateRequest(webRequest);

    if (!requestState.isSignedIn) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const clerkUserId = requestState.toAuth().userId;

    if (!clerkUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let user = await storage.getUserByClerkId(clerkUserId);

    if (!user) {
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email =
        clerkUser.emailAddresses[0]?.emailAddress || `${clerkUserId}@clerk.local`;
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;
      user = await storage.upsertUserByClerkId(clerkUserId, email, name);
    }

    req.userId = user.id;
    next();
  } catch (err: unknown) {
    console.error("Auth error:", err instanceof Error ? err.message : err);
    res.status(401).json({ message: "Unauthorized" });
  }
}
