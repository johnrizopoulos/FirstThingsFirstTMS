import { useUser } from "@clerk/react";

export function useAuth() {
  const { isLoaded, isSignedIn, user } = useUser();

  return {
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          name: user.fullName || user.firstName || "",
        }
      : null,
    isLoading: !isLoaded,
    isAuthenticated: isSignedIn ?? false,
  };
}
