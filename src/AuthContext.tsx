// src/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole =
  | "control_room_admin"
  | "police_team"
  | "medical_team"
  | "fire_team"
  | "rescue_team"
  | "general_team";

export interface AuthUser {
  username:    string;
  displayName: string;
  email:       string;
  role:        UserRole;
  sys_id:      string;
}

interface AuthContextType {
  user:    AuthUser | null;
  loading: boolean;
  login:   (username: string, password: string) => Promise<void>;
  logout:  () => void;
}

// ─── Username → Role (no API call needed) ─────────────────────────────────────
const USERNAME_ROLE_MAP: Record<string, UserRole> = {
  control_room: "control_room_admin",
  police_team:        "police_team",
  medical_team:       "medical_team",
  fire_team:          "fire_team",
  rescue_team:        "rescue_team",
  general_team:       "general_team",
};

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  control_room_admin: "/dashboard/control-room",
  police_team:        "/dashboard/police",
  medical_team:       "/dashboard/medical",
  fire_team:          "/dashboard/fire",
  rescue_team:        "/dashboard/rescue",
  general_team:       "/dashboard/general",
};

export const ROLE_CATEGORY: Partial<Record<UserRole, string>> = {
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
    const SN_INSTANCE = import.meta.env.VITE_SN_INSTANCE;
    if (!SN_INSTANCE) throw new Error("VITE_SN_INSTANCE is not configured.");

    // ── Step 1: Check username has a valid role BEFORE calling API ──────────
    const assignedRole = USERNAME_ROLE_MAP[username];
    if (!assignedRole) throw new Error("No valid role assigned. Contact admin.");

    const auth = "Basic " + btoa(`${username}:${password}`);

    // ── Step 2: Validate credentials against ServiceNow ─────────────────────
    const userRes = await fetch(
      `${SN_INSTANCE}/api/now/table/sys_user?sysparm_query=user_name=${encodeURIComponent(username)}&sysparm_fields=sys_id,user_name,first_name,last_name,email&sysparm_limit=1`,
      { headers: { Accept: "application/json", Authorization: auth } }
    );

    if (userRes.status === 401) throw new Error("Invalid username or password.");
    if (!userRes.ok)            throw new Error(`Login error: HTTP ${userRes.status}`);

    const userJson   = await userRes.json();
    const userRecord = userJson?.result?.[0];
    if (!userRecord)            throw new Error("User not found.");

    // ── Step 3: Store session (no role API call needed!) ─────────────────────
    const authUser: AuthUser = {
      username:    userRecord.user_name,
      displayName: `${userRecord.first_name} ${userRecord.last_name}`.trim(),
      email:       userRecord.email,
      role:        assignedRole,
      sys_id:      userRecord.sys_id,
    };

    localStorage.setItem("auth_user",  JSON.stringify(authUser));
    localStorage.setItem("auth_token", btoa(`${username}:${password}`));
    setUser(authUser);
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