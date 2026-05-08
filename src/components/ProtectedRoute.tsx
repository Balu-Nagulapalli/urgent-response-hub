// src/components/ProtectedRoute.tsx

import { Navigate } from "react-router-dom";
import { useAuth, UserRole, ROLE_DASHBOARD } from "../AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children:      React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in → go to login page
  if (!user) return <Navigate to="/admin/login" replace />;

  // Wrong role → redirect to their own dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;