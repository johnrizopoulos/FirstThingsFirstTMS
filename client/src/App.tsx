import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/theme";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import CompletedPage from "@/pages/CompletedPage";
import TrashPage from "@/pages/TrashPage";

function Router() {
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
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={FocusPage} />
          <Route path="/list" component={ListPage} />
          <Route path="/board" component={BoardPage} />
          <Route path="/completed" component={CompletedPage} />
          <Route path="/trash" component={TrashPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
