import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import AppLayout from "./layouts/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";

// ── Eager: tiny pages needed before auth resolves ────────────────────────────
import LandingPage    from "./pages/LandingPage";
import Login          from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";
import NotFound       from "./pages/NotFound";

// ── Lazy: all protected pages ────────────────────────────────────────────────
const Dashboard              = lazy(() => import("./pages/Dashboard"));
const Team                   = lazy(() => import("./pages/Team"));
const Tasks                  = lazy(() => import("./pages/Tasks"));
const TaskDetail             = lazy(() => import("./pages/TaskDetail"));
const Leads                  = lazy(() => import("./pages/Leads"));
const LeadDetail             = lazy(() => import("./pages/LeadDetail"));
const LeadJourney            = lazy(() => import("./pages/LeadJourney"));
const Kanban                 = lazy(() => import("./pages/Kanban"));
const Deals                  = lazy(() => import("./pages/Deals"));
const DealPipeline           = lazy(() => import("./pages/DealPipeline"));
const DealDetail             = lazy(() => import("./pages/DealDetail"));
const Sprints                = lazy(() => import("./pages/Sprints"));
const SprintAnalytics        = lazy(() => import("./pages/SprintAnalytics"));
const SearchLeads            = lazy(() => import("./pages/SearchLeads"));
const LinkedInLeads          = lazy(() => import("./pages/LinkedInLeads"));
const IntegrationHub         = lazy(() => import("./pages/IntegrationHub"));
const Settings               = lazy(() => import("./pages/Settings"));
const Reports                = lazy(() => import("./pages/Reports"));
const AssistantUsage         = lazy(() => import("./pages/AssistantUsage"));
const DepartmentQueue        = lazy(() => import("./pages/DepartmentQueue"));
const DepartmentBoard        = lazy(() => import("./pages/DepartmentBoard"));
const DepartmentStaffing     = lazy(() => import("./pages/DepartmentStaffing"));
const Messages               = lazy(() => import("./pages/Messages"));
const Attendance             = lazy(() => import("./pages/Attendance"));
const Leave                  = lazy(() => import("./pages/Leave"));
const Leaderboard            = lazy(() => import("./pages/Leaderboard"));
const InvoiceBilling         = lazy(() => import("./pages/InvoiceBilling"));
const FasterqCalls           = lazy(() => import("./pages/FasterqCalls"));
const Automations            = lazy(() => import("./pages/Automations"));
const Inbox                  = lazy(() => import("./pages/Inbox"));
const WhatsAppCampaigns      = lazy(() => import("./pages/WhatsAppCampaigns"));
const WhatsAppCampaignDetail = lazy(() => import("./pages/WhatsAppCampaignDetail"));
const WhatsAppAutoReplies    = lazy(() => import("./pages/WhatsAppAutoReplies"));
const Duplicates             = lazy(() => import("./pages/Duplicates"));
const TeamManagement         = lazy(() => import("./pages/TeamManagement"));
const TeamPerformance        = lazy(() => import("./pages/TeamPerformance"));
const EmployeeReport         = lazy(() => import("./pages/EmployeeReport"));
const RevenueReport          = lazy(() => import("./pages/RevenueReport"));

// ── Fallback spinner ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/"                element={<LandingPage />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Protected routes */}
            <Route element={<ErrorBoundary><ChatProvider><AppLayout /></ChatProvider></ErrorBoundary>}>
              <Route path="/dashboard"                element={<Dashboard />} />
              <Route path="/search-leads"             element={<SearchLeads />} />
              <Route path="/linkedin-leads"           element={<LinkedInLeads />} />
              <Route path="/kanban"                   element={<Kanban />} />
              <Route path="/sprints"                  element={<Sprints />} />
              <Route path="/sprint-analytics/:id"     element={<SprintAnalytics />} />
              <Route path="/leads"                    element={<Leads />} />
              <Route path="/deals"                    element={<Deals />} />
              <Route path="/deals/pipeline"           element={<DealPipeline />} />
              <Route path="/deals/:id"                element={<DealDetail />} />
              <Route path="/leads/:id"                element={<LeadDetail />} />
              <Route path="/leads/:id/journey"        element={<LeadJourney />} />
              <Route path="/team"                     element={<Team />} />
              <Route path="/inbox"                    element={<Inbox />} />
              <Route path="/tasks"                    element={<Tasks />} />
              <Route path="/tasks/:id"                element={<TaskDetail />} />
              <Route path="/integrations"             element={<IntegrationHub />} />
              <Route path="/reports"                  element={<Reports />} />
              <Route path="/ai-usage"                 element={<AssistantUsage />} />
              <Route path="/department-queue"         element={<DepartmentQueue />} />
              <Route path="/department-board"         element={<DepartmentBoard />} />
              <Route path="/department-staffing"      element={<DepartmentStaffing />} />
              <Route path="/messages"                 element={<Messages />} />
              <Route path="/attendance"               element={<Attendance />} />
              <Route path="/leave"                    element={<Leave />} />
              <Route path="/leaderboard"              element={<Leaderboard />} />
              <Route path="/settings"                 element={<Settings />} />
              <Route path="/invoices"                 element={<InvoiceBilling />} />
              <Route path="/fasterq"                  element={<FasterqCalls />} />
              <Route path="/automations"              element={<Automations />} />
              <Route path="/whatsapp/campaigns"       element={<WhatsAppCampaigns />} />
              <Route path="/whatsapp/campaigns/:id"   element={<WhatsAppCampaignDetail />} />
              <Route path="/whatsapp/auto-replies"    element={<WhatsAppAutoReplies />} />
              <Route path="/duplicates"               element={<Duplicates />} />
              <Route path="/team-management"          element={<TeamManagement />} />
              <Route path="/team-performance"         element={<TeamPerformance />} />
              <Route path="/employee-report/:id"      element={<EmployeeReport />} />
              <Route path="/revenue-report"           element={<RevenueReport />} />
              <Route path="*"                         element={<NotFound />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
