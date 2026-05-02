import { useMemo } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/contexts/theme";
import { OnboardingProvider } from "@/contexts/onboarding";
import { ClerkProvider, Show, useUser } from "@clerk/react";
import { ui as clerkUi } from "@clerk/ui";
import { buildClerkAppearance } from "@/lib/clerkAppearance";
import OfflineBanner from "@/components/OfflineBanner";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import CompletedPage from "@/pages/CompletedPage";
import TrashPage from "@/pages/TrashPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const appearance = useMemo(() => buildClerkAppearance(theme), [theme]);

  // The auth-modal backdrop is now a pure-CSS layer keyed off --background /
  // --primary (see `.ftf-clerk-backdrop` in client/src/index.css), so it tracks
  // the active theme automatically without any per-theme JS plumbing.

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      ui={clerkUi}
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}

function AuthRouter() {
  const { isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background text-primary font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="w-4 h-4 bg-primary animate-blink mx-auto mb-4" />
          <p className="text-lg">SYSTEM_LOADING...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" nest component={SignUpPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route>
        <>
          <Show when="signed-out">
            <LandingPage />
          </Show>
          <Show when="signed-in">
            <Switch>
              <Route path="/" component={FocusPage} />
              <Route path="/list" component={ListPage} />
              <Route path="/board" component={BoardPage} />
              <Route path="/completed" component={CompletedPage} />
              <Route path="/trash" component={TrashPage} />
              <Route path="/tutorial" component={OnboardingPage} />
              <Route component={NotFound} />
            </Switch>
          </Show>
        </>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ClerkWithTheme>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <OnboardingProvider>
              <OfflineBanner />
              <Toaster />
              <AuthRouter />
            </OnboardingProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkWithTheme>
    </ThemeProvider>
  );
}

export default App;
