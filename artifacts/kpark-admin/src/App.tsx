import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppInit } from "@/hooks/use-app-init";
import { useAuthStore } from "@/hooks/use-auth";
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
import TranslatePage from "@/pages/translate";
import PlansPage from "@/pages/plans";
import StudentsPage from "@/pages/students";
import SettingsPage from "@/pages/settings";
import BrowserPage from "@/pages/browser";
import PdfExtractorPage from "@/pages/pdf-extractor";
import SubAdminsPage from "@/pages/sub-admins";
import ApprovalsPage from "@/pages/approvals";
import ActivityLogsPage from "@/pages/activity-logs";
import StudentAppPage from "@/pages/student-app";
import { StudentLayout } from "@/student/components/student-layout";
import StudentDashboard from "@/student/pages/StudentDashboard";
import StudentCurriculum from "@/student/pages/StudentCurriculum";
import StudentMockTests from "@/student/pages/StudentMockTests";
import StudentLandingPage from "@/student/pages/StudentLandingPage";
import StudentQuestionBank from "@/student/pages/StudentQuestionBank";

const queryClient = new QueryClient();



function ProtectedRoutes() {
  const user = useAuthStore(s => s.user);
  const isStudent = user?.role === 'student';

  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          {isStudent ? (
            <>
              <Route path="/dashboard" component={StudentDashboard} />
              <Route path="/curriculum" component={StudentCurriculum} />
              <Route path="/tests" component={StudentMockTests} />
              <Route path="/practice" component={StudentQuestionBank} />
              <Route path="/performance" component={StudentDashboard} />
              <Route path="/profile" component={StudentDashboard} />
              <Route path="/" component={() => <Redirect to="/dashboard" replace />} />
              <Route component={() => <Redirect to="/dashboard" replace />} />
            </>
          ) : (
            <>
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/approvals" component={ApprovalsPage} />
              <Route path="/sub-admins" component={SubAdminsPage} />
              <Route path="/activity-logs" component={ActivityLogsPage} />
              <Route path="/hierarchy" component={HierarchyPage} />
              <Route path="/generate" component={GeneratePage} />
              <Route path="/pdf-extractor" component={PdfExtractorPage} />
              <Route path="/questions" component={QuestionsPage} />
              <Route path="/jobs" component={JobsPage} />
              <Route path="/providers" component={ProvidersPage} />
              <Route path="/browser" component={BrowserPage} />
              <Route path="/papers" component={PapersPage} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/translate" component={TranslatePage} />
              <Route path="/plans" component={PlansPage} />
              <Route path="/students" component={StudentsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/" component={() => <Redirect to="/dashboard" replace />} />
              <Route component={NotFound} />
            </>
          )}
        </Switch>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={StudentLandingPage} />
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
