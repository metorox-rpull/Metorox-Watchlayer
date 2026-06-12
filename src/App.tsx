import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./pages/app/_components/app-layout.tsx";
import Dashboard from "./pages/app/dashboard/page.tsx";
import SitesPage from "./pages/app/sites/page.tsx";
import NewSitePage from "./pages/app/sites/new/page.tsx";
import SiteDetailPage from "./pages/app/sites/siteId/page.tsx";
import IncidentsPage from "./pages/app/incidents/page.tsx";
import MonitorsPage from "./pages/app/monitors/page.tsx";
import ReportsPage from "./pages/app/reports/page.tsx";
import SettingsPage from "./pages/app/settings/page.tsx";
import OnboardingPage from "./pages/app/onboarding/page.tsx";
import AcceptInvitePage from "./pages/app/invite/page.tsx";

import MonitorDetailPage from "./pages/app/monitors/monitorId/page.tsx";

import IncidentDetailPage from "./pages/app/incidents/incidentId/page.tsx";
import StatusPage from "./pages/status/page.tsx";
import ClientReportPage from "./pages/report/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/status/:slug" element={<StatusPage />} />
          <Route path="/report/:token" element={<ClientReportPage />} />

          {/* Onboarding — outside app shell */}
          <Route path="/app/onboarding" element={<OnboardingPage />} />

          {/* App shell — workspace-scoped routes */}
          <Route path="/app" element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sites" element={<SitesPage />} />
            <Route path="sites/new" element={<NewSitePage />} />
            <Route path="sites/:siteId" element={<SiteDetailPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="monitors" element={<MonitorsPage />} />
            <Route path="monitors/:monitorId" element={<MonitorDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
