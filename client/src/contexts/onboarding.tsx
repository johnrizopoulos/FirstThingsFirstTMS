import React, { createContext, useContext, useEffect, useState } from "react";

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  markOnboardingComplete: () => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("onboarding_completed");
    setHasCompletedOnboarding(!!saved);
  }, []);

  const markOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setHasCompletedOnboarding(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem("onboarding_completed");
    setHasCompletedOnboarding(false);
  };

  return (
    <OnboardingContext.Provider value={{ hasCompletedOnboarding, markOnboardingComplete, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
