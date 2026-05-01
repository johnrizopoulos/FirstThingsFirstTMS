import { type Server } from "node:http";

import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Trust proxy - required for secure cookies behind reverse proxy (production)
app.set("trust proxy", 1);

// Canonical host redirect.
// When CANONICAL_HOST is set, any request whose host header doesn't match is
// 308-redirected to https://<CANONICAL_HOST><url>. Used in production to force
// traffic from the .replit.app deployment URL (and any other secondary domain)
// onto the verified custom domain — this keeps cookie scope, Origin checks
// (CLERK_AUTHORIZED_PARTIES) and analytics consistent. Unset in development.
const CANONICAL_HOST = (process.env.CANONICAL_HOST || "").trim().toLowerCase();
if (CANONICAL_HOST) {
  // Validate format: must be a bare host (optionally with port). No scheme,
  // no path, no userinfo, no trailing dot. Bad values can cause redirect
  // loops or build malformed Location headers.
  const validHost = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/;
  if (!validHost.test(CANONICAL_HOST)) {
    throw new Error(
      `[app] FATAL: CANONICAL_HOST must be a bare host (e.g. "www.example.com" or "example.com:8080"), ` +
      `got "${process.env.CANONICAL_HOST}". Do not include scheme, path, or trailing slash.`
    );
  }
  app.use((req, res, next) => {
    const host = req.hostname.toLowerCase();
    // Skip loopback / health-check probes that target the container directly.
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return next();
    }
    if (host !== CANONICAL_HOST) {
      return res.redirect(308, `https://${CANONICAL_HOST}${req.originalUrl}`);
    }
    next();
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  try {
    log("Initializing server routes and middleware...");
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly run the final setup after setting up all the other routes so
    // the catch-all route doesn't interfere with the other routes
    log("Running application setup...");
    await setup(app, server);
    log("Application setup completed");

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    log(`Starting server on 0.0.0.0:${port}...`);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server is now listening on port ${port}`);
      log(`Server ready to accept connections on 0.0.0.0:${port}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`ERROR: Port ${port} is already in use`);
      } else {
        log(`ERROR: Server error - ${error.message}`);
      }
      console.error(error);
      process.exit(1);
    });

  } catch (error) {
    log(`FATAL ERROR during server initialization`);
    console.error(error);
    process.exit(1);
  }
}
