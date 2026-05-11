// src/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole =
  | "control_room"
  | "police_team"
  | "medical_team"
  | "fire_team"
  | "rescue_team"
  | "general_team"
  | "super_admin";

export interface AuthUser {
  username:     string;
  displayName:  string;
  role:         UserRole;
  sys_id:       string;
  districtId:   string;
  districtName: string;
  phone:        string;
}

interface AuthContextType {
  user:    AuthUser | null;
  loading: boolean;
  login:   (username: string, password: string) => Promise<void>;
  logout:  () => void;
}

// ─── Hardcoded team users (no ServiceNow password needed) ─────────────────────
const TEAM_USERS: Record<string, { role: UserRole; displayName: string; password: string }> = {
  control_room: { role: "control_room", displayName: "Control Room", password: "Admin@123" },
  police_team:  { role: "police_team",  displayName: "Police Team",  password: "Admin@123" },
  medical_team: { role: "medical_team", displayName: "Medical Team", password: "Admin@123" },
  fire_team:    { role: "fire_team",    displayName: "Fire Team",    password: "Admin@123" },
  rescue_team:  { role: "rescue_team",  displayName: "Rescue Team",  password: "Admin@123" },
  general_team: { role: "general_team", displayName: "General Team", password: "Admin@123" },
};

// ─── ServiceNow Choice value → UserRole ──────────────────────────────────────
const SN_ROLE_MAP: Record<string, UserRole> = {
  "100": "super_admin",
  "200": "police_team",
  "300": "fire_team",
  "400": "control_room",
  "500": "rescue_team",
  "600": "medical_team",
  "super_admin":  "super_admin",
  "police_team":  "police_team",
  "fire_team":    "fire_team",
  "control_room": "control_room",
  "rescue_team":  "rescue_team",
  "medical_team": "medical_team",
  "general_team": "general_team",
};

// ─── Role → Dashboard route ───────────────────────────────────────────────────
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  control_room: "/dashboard/control-room",
  police_team:  "/dashboard/police",
  medical_team: "/dashboard/medical",
  fire_team:    "/dashboard/fire",
  rescue_team:  "/dashboard/rescue",
  general_team: "/dashboard/general",
  super_admin:  "/dashboard/control-room",
};

// ─── Role → Incident category filter ─────────────────────────────────────────
export const ROLE_CATEGORY: Partial<Record<UserRole, string>> = {
  police_team:  "police",
  medical_team: "medical",
  fire_team:    "fire",
  rescue_team:  "rescue",
  general_team: "others",
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem("auth_user"); }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // ── Hardcoded team users (backward compatible, no proxy needed) ──────────
    // These are the generic role logins — NOT district-specific
    const TEAM_USERS_LOCAL: Record<string, { role: UserRole; displayName: string; password: string }> = {
      control_room: { role: "control_room", displayName: "Control Room", password: "Admin@123" },
      police_team:  { role: "police_team",  displayName: "Police Team",  password: "Admin@123" },
      medical_team: { role: "medical_team", displayName: "Medical Team", password: "Admin@123" },
      fire_team:    { role: "fire_team",    displayName: "Fire Team",    password: "Admin@123" },
      rescue_team:  { role: "rescue_team",  displayName: "Rescue Team",  password: "Admin@123" },
      general_team: { role: "general_team", displayName: "General Team", password: "Admin@123" },
    };

    const teamUser = TEAM_USERS_LOCAL[username];
    if (teamUser) {
      if (password !== teamUser.password) throw new Error("Invalid username or password.");
      const authUser: AuthUser = {
        username,
        displayName:  teamUser.displayName,
        role:         teamUser.role,
        sys_id:       username,
        districtId:   "ALL",
        districtName: "All Districts",
        phone:        "",
      };
      localStorage.setItem("auth_user", JSON.stringify(authUser));
      setUser(authUser);
      return;
    }

    // ── District / super_admin users — authenticated via server proxy ────────
    // Credentials never leave the server — no VITE_ vars used here
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000";

    const res = await fetch(`${BACKEND_URL}/api/sn/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed. Please try again.");

    localStorage.setItem("auth_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};