import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme";
import { OnboardingProvider } from "@/contexts/onboarding";
import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/OnboardingPage";
import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import CompletedPage from "@/pages/CompletedPage";
import TrashPage from "@/pages/TrashPage";

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <OnboardingProvider>
            <Toaster />
            <Switch>
              <Route path="/" component={FocusPage} />
              <Route path="/list" component={ListPage} />
              <Route path="/board" component={BoardPage} />
              <Route path="/completed" component={CompletedPage} />
              <Route path="/trash" component={TrashPage} />
              <Route path="/tutorial" component={OnboardingPage} />
              <Route component={NotFound} />
            </Switch>
          </OnboardingProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
