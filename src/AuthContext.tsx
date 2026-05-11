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
    // ── ALL authentication goes through backend proxy ────────────────────────
    // Both team users (District = empty) and district users (District = populated)
    // are stored in u_ers_users table and validated server-side
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