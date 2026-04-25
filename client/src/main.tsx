import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  // @ts-expect-error VITE_CLERK_PUBLISHABLE_KEY is set in .env.local; Clerk reads it from import.meta.env
  <ClerkProvider afterSignOutUrl="/">
    <App />
  </ClerkProvider>
);
