import { useState, useEffect } from "react";

type Role = "control" | "police" | "team" | null;

const STORAGE_KEY = "urh_auth";

interface AuthState {
  username: string | null;
  role: Role;
  teamCategory?: string | null;
}

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { username: null, role: null };
    } catch { return { username: null, role: null }; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const login = (username: string, role: Role, teamCategory?: string) => {
    const next = { username, role, teamCategory: teamCategory ?? null };
    setAuth(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const logout = () => {
    setAuth({ username: null, role: null });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return {
    username: auth.username,
    role: auth.role,
    teamCategory: auth.teamCategory ?? null,
    isAuthenticated: !!auth.username && !!auth.role,
    login,
    logout,
    setTeamCategory: (c: string) => {
      setAuth(a => {
        const next = { ...a, teamCategory: c };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    },
  } as const;
};

export type { Role };
