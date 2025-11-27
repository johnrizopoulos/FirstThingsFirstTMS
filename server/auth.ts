import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function setupSession(app: Express) {
  // Require SESSION_SECRET in production
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET environment variable must be set in production");
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(
    session({
      name: "ftf.sid",
      secret: sessionSecret || "dev-secret-DO-NOT-USE-IN-PRODUCTION",
      store: sessionStore,
      resave: true,  // Force session save even if not modified
      saveUninitialized: true,  // Save new sessions
      cookie: {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionTtl,
      },
    })
  );
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any).userId;
  
  console.log("Auth check:", {
    sessionId: req.sessionID,
    userId: userId,
    hasSession: !!req.session,
    cookies: req.headers.cookie
  });
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  req.userId = userId;
  next();
}

// Login endpoint
export async function handleLogin(req: Request, res: Response) {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: "Email and name are required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Upsert user (create or update by email)
    const user = await storage.upsertUserByEmail({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      consentTimestamp: new Date(),
      consentPurpose: "customer_outreach",
      consentSource: "web_login",
    });

    // Store user ID in session
    (req.session as any).userId = user.id;
    
    // Touch the session to mark it as modified
    req.session.touch();
    
    console.log("Login successful - session will be saved:", {
      sessionId: req.sessionID,
      userId: (req.session as any).userId
    });
    
    // Let express-session handle the Set-Cookie automatically
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
}

// Logout endpoint
export function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie("ftf.sid");
    res.json({ success: true });
  });
}

// Get current user endpoint
export async function getCurrentUser(req: Request, res: Response) {
  try {
    console.log("getCurrentUser - session check:", {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      cookies: req.headers.cookie,
      userId: (req.session as any).userId
    });
    
    const userId = (req.session as any).userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
}
