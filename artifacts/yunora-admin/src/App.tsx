import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppInit } from "@/hooks/use-app-init";
import { AuthGuard } from "@/components/auth-guard";
import { AppLayout } from "@/components/app-layout";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import HierarchyPage from "@/pages/hierarchy";
import GeneratePage from "@/pages/generate";
import QuestionsPage from "@/pages/questions";
import JobsPage from "@/pages/jobs";
import ProvidersPage from "@/pages/providers";
import PapersPage from "@/pages/papers";
import AnalyticsPage from "@/pages/analytics";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/hierarchy" component={HierarchyPage} />
          <Route path="/generate" component={GeneratePage} />
          <Route path="/questions" component={QuestionsPage} />
          <Route path="/jobs" component={JobsPage} />
          <Route path="/providers" component={ProvidersPage} />
          <Route path="/papers" component={PapersPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/:rest*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  // Initialize theme and API client token getter
  useAppInit();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
