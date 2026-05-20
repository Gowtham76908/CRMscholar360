import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Leads from "./pages/Leads";
import Integrations from "./pages/Integrations";
import IntegrationHub from "./pages/IntegrationHub";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Departments from "./pages/Departments";
import DepartmentDetails from "./pages/DepartmentDetails";
import Messages from "./pages/Messages";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Leaderboard from "./pages/Leaderboard";
import SearchLeads from "./pages/SearchLeads";
import LinkedInLeads from "./pages/LinkedInLeads";
import Kanban from "./pages/Kanban";
import Sprints from "./pages/Sprints";
import SprintAnalytics from "./pages/SprintAnalytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetail from "./pages/TaskDetail";
import LeadDetail from "./pages/LeadDetail";
import InvoiceBilling from "./pages/InvoiceBilling";
import SalestrailCalls from "./pages/SalestrailCalls";
import Automations from "./pages/Automations";
import Inbox from "./pages/Inbox";
import WhatsAppCampaigns from "./pages/WhatsAppCampaigns";
import WhatsAppCampaignDetail from "./pages/WhatsAppCampaignDetail";
import WhatsAppAutoReplies from "./pages/WhatsAppAutoReplies";
import Duplicates from "./pages/Duplicates";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
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
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login"            element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route element={<ErrorBoundary><AppLayout /></ErrorBoundary>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/search-leads" element={<SearchLeads />} />
            <Route path="/linkedin-leads" element={<LinkedInLeads />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/sprints" element={<Sprints />} />
            <Route path="/sprint-analytics/:id" element={<SprintAnalytics />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/team" element={<Team />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/integrations" element={<IntegrationHub />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/departments/:id" element={<DepartmentDetails />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leave" element={<Leave />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/invoices" element={<InvoiceBilling />} />
            <Route path="/salestrail" element={<SalestrailCalls />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/whatsapp/campaigns" element={<WhatsAppCampaigns />} />
            <Route path="/whatsapp/campaigns/:id" element={<WhatsAppCampaignDetail />} />
            <Route path="/whatsapp/auto-replies" element={<WhatsAppAutoReplies />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
