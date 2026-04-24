import { clerkMiddleware, getAuth, createClerkClient } from "@clerk/express";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function setupClerkMiddleware(app: Express) {
  app.use(clerkMiddleware());
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
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
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
}
