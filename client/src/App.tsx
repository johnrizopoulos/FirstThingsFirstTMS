import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme";
import { OnboardingProvider } from "@/contexts/onboarding";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import SignInPage from "@/pages/SignInPage";
import OnboardingPage from "@/pages/OnboardingPage";
import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import CompletedPage from "@/pages/CompletedPage";
import TrashPage from "@/pages/TrashPage";

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
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
      {!isAuthenticated ? [
        <Route key="landing" path="/" component={LandingPage} />,
        <Route key="login" path="/login" component={LoginPage} />,
        <Route key="signin" path="/signin" component={SignInPage} />,
        <Route key="fallback" path="*"><Redirect to="/" /></Route>
      ] : [
        <Route key="focus" path="/" component={FocusPage} />,
        <Route key="login-redirect" path="/login"><Redirect to="/" /></Route>,
        <Route key="signin-redirect" path="/signin"><Redirect to="/" /></Route>,
        <Route key="list" path="/list" component={ListPage} />,
        <Route key="board" path="/board" component={BoardPage} />,
        <Route key="completed" path="/completed" component={CompletedPage} />,
        <Route key="trash" path="/trash" component={TrashPage} />,
        <Route key="tutorial" path="/tutorial" component={OnboardingPage} />,
        <Route key="notfound" component={NotFound} />
      ]}
    </Switch>
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
