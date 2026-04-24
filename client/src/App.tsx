import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme";
import { OnboardingProvider } from "@/contexts/onboarding";
import { Show, useUser } from "@clerk/react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import CompletedPage from "@/pages/CompletedPage";
import TrashPage from "@/pages/TrashPage";

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
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <OnboardingProvider>
            <Toaster />
            <AuthRouter />
          </OnboardingProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
