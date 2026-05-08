// src/pages/AdminLogin.tsx
// REPLACE your existing AdminLogin.tsx with this file

import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Loader2, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useAuth, ROLE_DASHBOARD } from "../AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const getLoginHint = (message: string) => {
  if (message.includes("VITE_SN_INSTANCE")) {
    return "Set VITE_SN_INSTANCE in your .env file to the correct ServiceNow base URL.";
  }

  if (message.includes("Invalid username or password")) {
    return "Check that the username matches the ServiceNow user_name field exactly, then re-enter the account password.";
  }

  if (message.includes("No valid role assigned")) {
    return "The account authenticated, but it does not have one of the supported roles in sys_user_has_role.";
  }

  if (message.includes("checking roles")) {
    return "ServiceNow accepted the password, but the role lookup failed. Verify the instance URL and API access.";
  }

  return "If the password is correct, the most common causes are a wrong username, wrong instance URL, or missing role assignment.";
};

const AdminLogin = () => {
  const navigate        = useNavigate();
  const { user, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Already logged in → go straight to dashboard
  if (user) return <Navigate to={ROLE_DASHBOARD[user.role]} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const u = JSON.parse(stored);
        navigate(ROLE_DASHBOARD[u.role as keyof typeof ROLE_DASHBOARD], { replace: true });
      }
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Quick-fill buttons for easy dev testing
  const TEAMS = [
    { id: "control_room", label: "🏛️ Control Room",  color: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
    { id: "police_team",  label: "👮 Police Team",   color: "bg-blue-100 text-blue-800 hover:bg-blue-200"     },
    { id: "medical_team", label: "🏥 Medical Team",  color: "bg-red-100 text-red-800 hover:bg-red-200"        },
    { id: "fire_team",    label: "🔥 Fire Team",     color: "bg-amber-100 text-amber-800 hover:bg-amber-200"  },
    { id: "rescue_team",  label: "🚨 Rescue Team",   color: "bg-orange-100 text-orange-800 hover:bg-orange-200"},
    { id: "general_team", label: "📝 General Team",  color: "bg-gray-100 text-gray-800 hover:bg-gray-200"     },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <ShieldAlert className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Response</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your team dashboard</p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-4">
          <form onSubmit={handleLogin} className="space-y-5">

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. medical_team"
                className="h-11"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-11 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="space-y-2">
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  ⚠️ {error}
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  <p className="font-semibold uppercase tracking-wide mb-1">Login debug</p>
                  <p>{getLoginHint(error)}</p>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</>
                : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Quick fill team buttons */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Quick Select Team
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEAMS.map((t) => (
              <button key={t.id} type="button"
                onClick={() => setUsername(t.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${t.color}`}>
                {t.label}
                <div className="font-mono font-normal opacity-70 mt-0.5">{t.id}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Click a team to auto-fill username
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;