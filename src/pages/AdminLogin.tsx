// src/pages/AdminLogin.tsx
// REPLACE your existing AdminLogin.tsx with this file

import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth, ROLE_DASHBOARD } from "../AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// (Login hint helper removed — debug info hidden from UI)

/* ─────────────── Inline SVG Illustrations ─────────────── */

const HeroIllustration = () => (
  <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Sky gradient background */}
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="100%" stopColor="#1e3a5f" />
      </linearGradient>
      <linearGradient id="buildingGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>
      <linearGradient id="glowRed" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
        <stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="heliGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Sky */}
    <rect width="420" height="320" fill="url(#skyGrad)" />

    {/* Stars */}
    {[
      [30,20],[80,15],[150,8],[200,25],[270,12],[340,18],[390,30],
      [60,50],[120,40],[190,55],[310,45],[380,60],[20,70],[410,75],
    ].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r="1" fill="white" opacity={0.4 + (i % 3)*0.2} />
    ))}

    {/* Moon */}
    <circle cx="370" cy="40" r="18" fill="#e2e8f0" opacity="0.9" />
    <circle cx="378" cy="35" r="14" fill="#1e3a5f" />

    {/* Red alert glow on horizon */}
    <ellipse cx="210" cy="220" rx="200" ry="30" fill="url(#glowRed)" />

    {/* City skyline – background buildings */}
    <rect x="0" y="180" width="40" height="140" fill="#1e3a8a" opacity="0.8" />
    <rect x="15" y="160" width="10" height="20" fill="#1e3a8a" opacity="0.8" />
    <rect x="38" y="170" width="30" height="150" fill="#1f2937" opacity="0.7" />
    <rect x="65" y="150" width="25" height="170" fill="#1e3a8a" opacity="0.9" />
    <rect x="340" y="175" width="35" height="145" fill="#1e3a8a" opacity="0.8" />
    <rect x="370" y="155" width="20" height="165" fill="#1f2937" opacity="0.7" />
    <rect x="385" y="140" width="35" height="180" fill="#1e3a8a" opacity="0.9" />

    {/* Main HQ building (center) */}
    <rect x="150" y="100" width="120" height="220" fill="url(#buildingGrad)" />
    {/* HQ windows */}
    {[0,1,2,3,4,5].map(row => (
      [0,1,2,3].map(col => {
        const lit = (row + col) % 3 !== 2;
        return (
          <rect key={`${row}-${col}`}
            x={162 + col*27} y={115 + row*28} width="16" height="18"
            fill={lit ? "#fbbf24" : "#1e293b"}
            opacity={lit ? 0.9 : 0.5}
          />
        );
      })
    ))}
    {/* HQ sign glow */}
    <rect x="170" y="105" width="80" height="8" fill="#ef4444" opacity="0.8" filter="url(#glow)" />
    <text x="210" y="113" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold" letterSpacing="1">CONTROL ROOM</text>

    {/* Antenna on HQ */}
    <line x1="210" y1="100" x2="210" y2="70" stroke="#94a3b8" strokeWidth="2" />
    <circle cx="210" cy="68" r="4" fill="#ef4444" filter="url(#glow)" />
    <circle cx="210" cy="68" r="8" fill="#ef4444" opacity="0.2" />

    {/* Left police car */}
    <g transform="translate(50,255)">
      <rect x="0" y="8" width="50" height="20" rx="4" fill="#1d4ed8" />
      <rect x="5" y="2" width="40" height="14" rx="3" fill="#2563eb" />
      <circle cx="10" cy="30" r="6" fill="#1e293b" />
      <circle cx="10" cy="30" r="3" fill="#475569" />
      <circle cx="40" cy="30" r="6" fill="#1e293b" />
      <circle cx="40" cy="30" r="3" fill="#475569" />
      {/* Lights */}
      <rect x="8" y="0" width="8" height="4" rx="1" fill="#ef4444" filter="url(#glow)" />
      <rect x="34" y="0" width="8" height="4" rx="1" fill="#3b82f6" filter="url(#glow)" />
      <line x1="50" y1="18" x2="60" y2="18" stroke="#fbbf24" strokeWidth="2" opacity="0.8" />
    </g>

    {/* Right ambulance */}
    <g transform="translate(305,252)">
      <rect x="0" y="8" width="55" height="22" rx="4" fill="#dc2626" />
      <rect x="5" y="2" width="35" height="14" rx="3" fill="#ef4444" />
      <rect x="42" y="4" width="13" height="12" rx="2" fill="#1d4ed8" />
      {/* Cross */}
      <rect x="18" y="12" width="14" height="4" fill="white" />
      <rect x="23" y="8" width="4" height="12" fill="white" />
      <circle cx="12" cy="32" r="6" fill="#1e293b" />
      <circle cx="12" cy="32" r="3" fill="#475569" />
      <circle cx="43" cy="32" r="6" fill="#1e293b" />
      <circle cx="43" cy="32" r="3" fill="#475569" />
      {/* Light bar */}
      <rect x="5" y="0" width="10" height="3" rx="1" fill="#ef4444" filter="url(#glow)" />
      <rect x="40" y="0" width="10" height="3" rx="1" fill="#ef4444" filter="url(#glow)" />
    </g>

    {/* Helicopter */}
    <g transform="translate(170,55)">
      {/* Rotor glow */}
      <ellipse cx="30" cy="8" rx="40" ry="4" fill="#fbbf24" opacity="0.1" />
      {/* Rotor blade */}
      <line x1="-10" y1="6" x2="70" y2="6" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="-5" x2="50" y2="17" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* Body */}
      <ellipse cx="30" cy="20" rx="22" ry="12" fill="#1e293b" />
      <rect x="10" y="14" width="28" height="14" rx="3" fill="#334155" />
      {/* Windows */}
      <rect x="14" y="16" width="10" height="8" rx="2" fill="#7dd3fc" opacity="0.8" />
      <rect x="26" y="16" width="10" height="8" rx="2" fill="#7dd3fc" opacity="0.8" />
      {/* Tail */}
      <line x1="38" y1="20" x2="62" y2="22" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="18" x2="60" y2="28" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      {/* Light */}
      <circle cx="8" cy="22" r="4" fill="#fbbf24" filter="url(#softGlow)" opacity="0.9" />
      {/* Search beam */}
      <polygon points="4,26 20,60 -12,60" fill="#fbbf24" opacity="0.08" />
    </g>

    {/* Ground / Road */}
    <rect x="0" y="275" width="420" height="45" fill="#1e63d6" />
    <line x1="0" y1="285" x2="420" y2="285" stroke="#334155" strokeWidth="1" />
    {/* Road markings */}
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={i*65} y="279" width="35" height="4" rx="2" fill="#fbbf24" opacity="0.5" />
    ))}

    {/* Radio waves from antenna */}
    {[12,20,28].map((r, i) => (
      <circle key={i} cx="210" cy="68" r={r} fill="none" stroke="#ef4444"
        strokeWidth="0.8" opacity={0.5 - i*0.15} />
    ))}

    {/* Alert sweep line */}
    <line x1="0" y1="220" x2="420" y2="220" stroke="#ef4444" strokeWidth="0.5" opacity="0.3" strokeDasharray="4 8" />
  </svg>
);

const TeamIcon = ({ id }: { id: string }) => {
  const icons: Record<string, JSX.Element> = {
    control_room: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8" cy="10" r="2" fill="currentColor" opacity="0.6"/>
        <rect x="11" y="8" width="7" height="1.5" rx="0.75" fill="currentColor" opacity="0.6"/>
        <rect x="11" y="11" width="4" height="1.5" rx="0.75" fill="currentColor" opacity="0.4"/>
        <path d="M8 19h8M10 17v2M14 17v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    police_team: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.5 8H21L16 12L18 18L12 14L6 18L8 12L3 8H9.5L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    medical_team: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    fire_team: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-2-1-4-2-5 0 0 0 3-2 4-1-2-2-4-1-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    rescue_team: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="3" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="15" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    general_team: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  };
  return icons[id] ?? null;
};

/* ─────────────── Main Component ─────────────── */

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

  const TEAMS = [
    { id: "control_room", label: "Control Room",  sub: "control_room",  accent: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.25)", hover: "rgba(124,58,237,0.15)" },
    { id: "police_team",  label: "Police Team",   sub: "police_team",   accent: "#2563eb", bg: "rgba(37,99,235,0.08)",  border: "rgba(37,99,235,0.25)",  hover: "rgba(37,99,235,0.15)"  },
    { id: "medical_team", label: "Medical Team",  sub: "medical_team",  accent: "#dc2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.25)",  hover: "rgba(220,38,38,0.15)"  },
    { id: "fire_team",    label: "Fire Team",     sub: "fire_team",     accent: "#d97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.25)",  hover: "rgba(217,119,6,0.15)"  },
    { id: "rescue_team",  label: "Rescue Team",   sub: "rescue_team",   accent: "#ea580c", bg: "rgba(234,88,12,0.08)",  border: "rgba(234,88,12,0.25)",  hover: "rgba(234,88,12,0.15)"  },
    { id: "general_team", label: "General Team",  sub: "general_team",  accent: "#475569", bg: "rgba(71,85,105,0.08)",  border: "rgba(71,85,105,0.25)",  hover: "rgba(71,85,105,0.15)"  },
  ];

  return (
    <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #fff7ed 50%, #f0f9ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Ambient background orbs */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: "350px", height: "350px",
          background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "15%",
          width: "200px", height: "200px",
          background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        {/* Grid overlay */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.03 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e6eef8" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div style={{
        width: "100%", maxWidth: "960px", position: "relative", zIndex: 1,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0",
        borderRadius: "24px", overflow: "hidden",
        boxShadow: "0 25px 80px rgba(15,23,42,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
      }}>

        {/* ── Left Panel: Illustration ── */}
        <div className="left-panel" style={{
          background: "linear-gradient(160deg, #ffffff 0%, #e6f7ff 60%, #ffffff 100%)",
          padding: "40px 32px",
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(31,41,55,0.06)",
          color: "#1f2937",
          position: "relative", overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}>
          {/* Top badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "100px", padding: "6px 14px", marginBottom: "28px",
            width: "fit-content",
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "#ef4444", animation: "pulse 2s infinite",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "11px", color: "#fca5a5", fontWeight: 600, letterSpacing: "0.08em" }}>
              LIVE RESPONSE SYSTEM
            </span>
          </div>

          <h2 style={{
            fontSize: "26px", fontWeight: 800, color: "white",
            lineHeight: 1.25, marginBottom: "8px", letterSpacing: "-0.02em",
          }}>
            Emergency Response<br />
            <span style={{ color: "#ef4444" }}>Command Center</span>
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "24px" }}>
            Unified coordination platform for all emergency response teams. Real-time dispatch, incident tracking, and inter-agency communication.
          </p>

          {/* Illustration */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center",
            borderRadius: "16px", overflow: "hidden",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            minHeight: "200px",
          }}>
            <HeroIllustration />
          </div>

          {/* Stats row */}
          <div className="stats-row" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px", marginTop: "20px",
          }}>
            {[
              { num: "6", label: "Response Teams" },
              { num: "24/7", label: "Monitoring" },
              { num: "Live", label: "Incident Feed" },
            ].map(({ num, label }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px", padding: "12px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "white" }}>{num}</div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", letterSpacing: "0.04em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel: Login Form ── */}
        <div className="login-panel" style={{
          background: "#ffffff",
          padding: "40px 36px",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
          color: "#0f172a",
          boxShadow: "0 6px 24px rgba(15,23,42,0.08)",
          borderRadius: "12px",
        }}>

          {/* Logo mark */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <div style={{
              width: "40px", height: "40px",
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
            }}>
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white" opacity="0.9"/>
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>ERS Portal</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Secure Access</div>
            </div>
          </div>

          <h1 style={{
            fontSize: "22px", fontWeight: 700, color: "#0f172a",
            marginBottom: "4px", letterSpacing: "-0.02em",
          }}>
            Sign in to your team
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "28px" }}>
            Enter your credentials to access your dashboard
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="username" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em" }}>
                USERNAME
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                  color: "#475569",
                }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </div>
                <input
                  id="username"
                  placeholder="e.g. medical_team"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  style={{
                    width: "100%", height: "44px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px", paddingLeft: "40px", paddingRight: "14px",
                    color: "#0f172a", fontSize: "14px",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={e => (e.target.style.borderColor = "#cbd5e1")}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="password" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em" }}>
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                  color: "#475569",
                }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{
                    width: "100%", height: "44px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px", paddingLeft: "40px", paddingRight: "44px",
                    color: "#0f172a", fontSize: "14px",
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={e => (e.target.style.borderColor = "#cbd5e1")}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#64748b", padding: 0, display: "flex",
                  }}>
                  {showPass
                    ? <EyeOff style={{ width: "16px", height: "16px" }} />
                    : <Eye    style={{ width: "16px", height: "16px" }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px", padding: "12px 14px",
                fontSize: "13px", color: "#fca5a5",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: "100%", height: "44px",
                background: loading
                  ? "rgba(239,68,68,0.5)"
                  : "linear-gradient(135deg, #ef4444, #b91c1c)",
                border: "none", borderRadius: "10px",
                color: "white", fontSize: "14px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: loading ? "none" : "0 4px 16px rgba(239,68,68,0.35)",
                transition: "all 0.2s",
                letterSpacing: "0.02em",
              }}>
              {loading ? (
                <><Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />Signing in…</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            margin: "22px 0",
          }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: "11px", color: "#334155", fontWeight: 600, letterSpacing: "0.06em" }}>QUICK SELECT TEAM</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Team grid */}
          <div className="team-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px",
          }}>
            {TEAMS.map((t) => (
              <button key={t.id} type="button"
                onClick={() => setUsername(t.id)}
                style={{
                  width: "100%",
                  background: username === t.id ? t.hover : t.bg,
                  border: `1px solid ${username === t.id ? t.accent : t.border}`,
                  borderRadius: "10px", padding: "10px 12px",
                  cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: "10px",
                  transition: "all 0.15s",
                  outline: username === t.id ? `2px solid ${t.accent}` : "none",
                  outlineOffset: "1px",
                }}>
                <div style={{ color: t.accent, flexShrink: 0 }}>
                  <TeamIcon id={t.id} />
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>{t.label}</div>
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "3px", fontFamily: "monospace" }}>{t.sub}</div>
                </div>
                {username === t.id && (
                  <div style={{ marginLeft: "auto", color: t.accent }}>
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          <p style={{ fontSize: "11px", color: "#334155", marginTop: "14px", textAlign: "center" }}>
            Click a team to auto-fill username
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #94a3b8; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #ffffff inset !important;
          -webkit-text-fill-color: #1f2937 !important;
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }

        /* Light theme base */
        body { background: #f8fafc; color: #1f2937; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        h1,h2,h3,h4 { color: #1f2937 }
        .login-panel label { color: #334155 !important; }
        .login-panel button[type="button"] svg { color: #64748b; }
        a { color: #0369a1 }

        /* Mobile-specific tweaks */
        @media (max-width: 700px) {
          .left-panel { display: none !important; }
          .login-panel { padding: 20px !important; }
          .team-grid { grid-template-columns: 1fr !important; }
          .stats-row { display: none !important; }
          h2 { font-size: 18px !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;