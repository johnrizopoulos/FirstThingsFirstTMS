import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/store";
import NotFound from "@/pages/not-found";

import FocusPage from "@/pages/FocusPage";
import ListPage from "@/pages/ListPage";
import BoardPage from "@/pages/BoardPage";
import TrashPage from "@/pages/TrashPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={FocusPage} />
      <Route path="/list" component={ListPage} />
      <Route path="/board" component={BoardPage} />
      <Route path="/trash" component={TrashPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Router />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
