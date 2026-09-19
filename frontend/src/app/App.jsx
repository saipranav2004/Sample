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
const IdentitiesPage = lazy(() => import('../features/identities/IdentitiesPage'));
const CredentialsPage = lazy(() => import('../features/credentials/CredentialsPage'));
const SecretsPage = lazy(() => import('../features/secrets/SecretsPage'));
const FindingsPage = lazy(() => import('../features/exposure/FindingsPage'));
const DismissedPage = lazy(() => import('../features/exposure/DismissedPage'));
const ActivityPage = lazy(() => import('../features/activity/ActivityPage'));
const ScansPage = lazy(() => import('../features/scans/ScansPage'));
const MyResourcesPage = lazy(() => import('../features/account/MyResourcesPage'));
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
                  path="/secrets"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <SecretsPage />
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
                <Route
                  path="/scans"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ScansPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/my-resources"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <MyResourcesPage />
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
