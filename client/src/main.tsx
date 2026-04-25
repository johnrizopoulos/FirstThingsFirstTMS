import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

// VITE_CLERK_PUBLISHABLE_KEY is set in .env.local; Vite exposes it at
// import.meta.env.VITE_CLERK_PUBLISHABLE_KEY at build time.
// Passing it explicitly here satisfies the required TypeScript prop while
// reading from the environment (no hardcoded key).
createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
    afterSignOutUrl="/"
  >
    <App />
  </ClerkProvider>
);
