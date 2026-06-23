import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuthStore } from "@/stores/authStore";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LinkScanner = lazy(() => import("./pages/LinkScanner"));
const EmailPhishingDetector = lazy(() => import("./pages/EmailPhishingDetector"));
const ThreatFeed = lazy(() => import("./pages/ThreatFeed"));
const ScanHistory = lazy(() => import("./pages/ScanHistory"));
const AnonymousReport = lazy(() => import("./pages/AnonymousReport"));
const ExtensionManager = lazy(() => import("./pages/ExtensionManager"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ModeratorPanel = lazy(() => import("./pages/ModeratorPanel"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

const App = () => {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Login: redirect to dashboard if already authenticated */}
              <Route
                path="/"
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
                }
              />

              {/* All other routes protected by AppLayout + ProtectedRoute */}
              <Route element={<AppLayout />}>
                {/* Shared routes - all authenticated users */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/scanner" element={<LinkScanner />} />
                  <Route path="/email-detector" element={<EmailPhishingDetector />} />
                  <Route path="/threat-feed" element={<ThreatFeed />} />
                  <Route path="/scan-history" element={<ScanHistory />} />
                  <Route path="/report" element={<AnonymousReport />} />
                  <Route path="/extension" element={<ExtensionManager />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>

                {/* Moderator+ routes */}
                <Route element={<ProtectedRoute role="moderator" />}>
                  <Route path="/moderator" element={<ModeratorPanel />} />
                </Route>

                {/* Admin-only routes */}
                <Route element={<ProtectedRoute role="admin" />}>
                  <Route path="/admin" element={<AdminPanel />} />
                </Route>

                {/* Role-agnostic fallback if someone with insufficient permissions visits a restricted route */}
                <Route
                  path="/unauthorized"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center">
                        <h2 className="font-display text-xl font-bold text-foreground">Access Denied</h2>
                        <p className="text-sm text-muted-foreground mt-2">You do not have permission to view this page.</p>
                        <a href="/dashboard" className="text-primary text-sm mt-4 inline-block">Go to Dashboard</a>
                      </div>
                    </div>
                  }
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
