import { nanoid } from "nanoid";

const USER_ID_KEY = "ftf-anonymous-user-id";

export function getAnonymousUserId(): string {
  // Check if user ID exists in localStorage
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    // Generate new anonymous user ID
    userId = `anon-${nanoid()}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  
  return userId;
}

export function getAuthHeaders(): Record<string, string> {
  return {
    "X-User-ID": getAnonymousUserId(),
  };
}
