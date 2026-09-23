import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { ScanProvider } from './ScanContext';
import { RequireAuth } from './RequireAuth';
import { ToastProvider } from '../ui/Toast';
import { AppShell } from '../shell/AppShell';
import { RouteFallback } from '../shell/RouteFallback';
import LoginPage from '../features/auth/LoginPage';

/* Routes are split per screen. The charting library only ships with the
   screens that draw charts, so first paint after sign-in stays small. */
const PosturePage = lazy(() => import('../features/posture/PosturePage'));
const AlertsPage = lazy(() => import('../features/alerts/AlertsPage'));
const IdentitiesPage = lazy(() => import('../features/identities/IdentitiesPage'));
const CredentialsPage = lazy(() => import('../features/credentials/CredentialsPage'));
const FindingsPage = lazy(() => import('../features/exposure/FindingsPage'));
const DismissedPage = lazy(() => import('../features/exposure/DismissedPage'));
const ActivityPage = lazy(() => import('../features/activity/ActivityPage'));
// Out of this build - see the note in `shell/navigation.js`.
// const ScansPage = lazy(() => import('../features/scans/ScansPage'));
const AccessGraphPage = lazy(() => import('../features/access/AccessGraphPage'));
const AccessDetailPage = lazy(() => import('../features/access/AccessDetailPage'));
const GenomePage = lazy(() => import('../features/genome/GenomePage'));
const GenomeDetailPage = lazy(() => import('../features/genome/GenomeDetailPage'));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'));
const ReportViewPage = lazy(() => import('../features/reports/ReportViewPage'));
const IntegrationsPage = lazy(() => import('../features/integrations/IntegrationsPage'));
const NotFoundPage = lazy(() => import('../features/NotFoundPage'));

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <ScanProvider>
                      <AppShell />
                    </ScanProvider>
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/posture" replace />} />
                <Route
                  path="/posture"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <PosturePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <AlertsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/identities"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <IdentitiesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/credentials"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <CredentialsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exposure"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <FindingsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exposure/dismissed"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <DismissedPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/activity"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ActivityPage />
                    </Suspense>
                  }
                />
                {/* <Route
                  path="/scans"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ScansPage />
                    </Suspense>
                  }
                /> */}
                <Route
                  path="/access-graph"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <AccessGraphPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/access-graph/:id"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <AccessDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/genome"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <GenomePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/genome/:id"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <GenomeDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ReportsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/reports/:id"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ReportViewPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/integrations"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <IntegrationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <NotFoundPage />
                    </Suspense>
                  }
                />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
