import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express, { type Express, type Request } from "express";

import runApp from "./app";

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  try {
    console.log("Starting production server...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("PORT:", process.env.PORT || "5000 (default)");
    
    // Check critical environment variables
    if (!process.env.DATABASE_URL) {
      console.error("ERROR: DATABASE_URL environment variable is not set");
      process.exit(1);
    }
    
    if (!process.env.SESSION_SECRET) {
      console.error("ERROR: SESSION_SECRET environment variable is not set");
      process.exit(1);
    }
    
    // REPL_ID is not available in Autoscale deployments, only check in development
    // It will be used by auth setup if available
    
    console.log("Environment variables validated");
    console.log("Database URL configured:", process.env.DATABASE_URL ? "✓" : "✗");
    console.log("Session secret configured:", process.env.SESSION_SECRET ? "✓" : "✗");
    console.log("REPL_ID configured:", process.env.REPL_ID ? "✓" : "✗ (optional in production)");
    
    await runApp(serveStatic);
    console.log("Production server started successfully");
  } catch (error) {
    console.error("FATAL ERROR during server startup:");
    console.error(error);
    process.exit(1);
  }
})();
