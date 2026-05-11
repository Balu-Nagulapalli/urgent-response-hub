import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

// ── Pages ────────────────────────────────────────────────────────────────────
import Home           from "./pages/Home";
import ReportIncident from "./pages/ReportIncident";
import Status         from "./pages/Status";
import NotFound       from "./pages/NotFound";

// ── Auth ─────────────────────────────────────────────────────────────────────
import { AuthProvider }   from "./AuthContext";
import ProtectedRoute     from "./components/ProtectedRoute";
import AdminLogin         from "./pages/AdminLogin";
import TeamDashboard      from "./pages/TeamDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* ── Public ──────────────────────────────────────────── */}
            <Route path="/"       element={<Home />} />
            <Route path="/report" element={<ReportIncident />} />
            <Route path="/status" element={<Status />} />

            {/* ── Redirects ───────────────────────────────────────── */}
            <Route path="/admin"  element={<Navigate to="/admin/login" replace />} />
            <Route path="/login"  element={<Navigate to="/admin/login" replace />} />

            {/* ── Login ───────────────────────────────────────────── */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* ── Protected Dashboards ────────────────────────────── */}
            <Route path="/dashboard/control-room" element={
              <ProtectedRoute allowedRoles={["control_room", "super_admin"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/police" element={
              <ProtectedRoute allowedRoles={["police_team"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/medical" element={
              <ProtectedRoute allowedRoles={["medical_team"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/fire" element={
              <ProtectedRoute allowedRoles={["fire_team"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/rescue" element={
              <ProtectedRoute allowedRoles={["rescue_team"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/general" element={
              <ProtectedRoute allowedRoles={["general_team"]}>
                <TeamDashboard />
              </ProtectedRoute>
            } />

            {/* ── Catch all ───────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;