import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw,
  MapPin, Phone, Mail, Filter, ChevronDown,
  ArrowLeft, Loader2, Activity, Users, Flame, ShieldAlert,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth, ROLE_CATEGORY } from "@/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SNIncident {
  sys_id:            string;
  number:            string;
  short_description: string;
  description:       string;
  category:          string;
  state:             string;
  priority:          string;
  u_caller_email:    string;
  u_caller_phone:    string;
  u_full_address:    string;
  u_gps_latitude:    string;
  u_gps_longitude:   string;
  opened_at:         string;
  caller_id:         { display_value: string } | string;
}

type FilterState = "all" | "1" | "2" | "6";
type CategoryFilter = "all" | "medical" | "rescue" | "fire" | "police" | "others";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  medical: { label: "Medical",  emoji: "🏥", color: "bg-red-100 text-red-700 border-red-200" },
  rescue:  { label: "Rescue",   emoji: "🚨", color: "bg-orange-100 text-orange-700 border-orange-200" },
  fire:    { label: "Fire",     emoji: "🔥", color: "bg-amber-100 text-amber-700 border-amber-200" },
  police:  { label: "Police",   emoji: "👮", color: "bg-blue-100 text-blue-700 border-blue-200" },
  others:  { label: "Others",   emoji: "📝", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const STATE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  "1": { label: "New",         color: "bg-amber-100 text-amber-800",  dot: "bg-amber-500" },
  "2": { label: "In Progress", color: "bg-blue-100 text-blue-800",    dot: "bg-blue-500"  },
  "3": { label: "On Hold",     color: "bg-purple-100 text-purple-800",dot: "bg-purple-500"},
  "6": { label: "Resolved",    color: "bg-green-100 text-green-800",  dot: "bg-green-500" },
  "7": { label: "Closed",      color: "bg-gray-100 text-gray-700",    dot: "bg-gray-400"  },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  "1": { label: "Critical", color: "bg-red-100 text-red-800"    },
  "2": { label: "High",     color: "bg-orange-100 text-orange-800" },
  "3": { label: "Medium",   color: "bg-yellow-100 text-yellow-800" },
  "4": { label: "Low",      color: "bg-green-100 text-green-800" },
};

const SN_INSTANCE = () => import.meta.env.VITE_SN_INSTANCE as string;
const SN_AUTH     = () => "Basic " + btoa(`${import.meta.env.VITE_SN_USERNAME}:${import.meta.env.VITE_SN_PASSWORD}`);

const FIELDS = [
  "sys_id","number","short_description","description","category",
  "state","priority","u_caller_email","u_caller_phone",
  "u_full_address","u_gps_latitude","u_gps_longitude",
  "opened_at","caller_id",
].join(",");

// ─── Component ────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [incidents,   setIncidents]   = useState<SNIncident[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [source,      setSource]      = useState<"app" | "all">("app");
  const [error,       setError]       = useState("");
  const [selected,    setSelected]    = useState<SNIncident | null>(null);
  const [stateFilter, setStateFilter] = useState<FilterState>("all");
  const [catFilter,   setCatFilter]   = useState<CategoryFilter>("all");
  const auth = useAuth();
  const userCategoryFilter = auth.user ? (ROLE_CATEGORY[auth.user.role] ?? null) : null;
  const [viewRole,     setViewRole]    = useState<"control" | "police" | "team">("control");
  const [teamCategory, setTeamCategory] = useState<CategoryFilter>("fire");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // If not authenticated, redirect to login
  if (!auth.user) return <Navigate to="/admin/login" replace />;

  // ── Fetch all incidents from ServiceNow ─────────────────────────────────

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Build query — by default we only fetch incidents created from our React app
      // but when `source` is "all" we fetch every incident.
      const query = source === "app"
        ? `u_full_addressISNOTEMPTY^ORDERBYDESCopened_at`
        : `ORDERBYDESCopened_at`;

      const res = await fetch(
        `${SN_INSTANCE()}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_fields=${FIELDS}&sysparm_limit=50&sysparm_display_value=true`,
        { headers: { Accept: "application/json", Authorization: SN_AUTH() } }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

      const json = await res.json();
      setIncidents(json?.result ?? []);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? "Failed to load incidents.");
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  // ── Filtered list ───────────────────────────────────────────────────────

  const filtered = incidents.filter((inc) => {
    const stateOk = stateFilter === "all" || inc.state === stateFilter;
    const catOk   = catFilter   === "all" || inc.category === catFilter;
    const userCat = auth.user ? (ROLE_CATEGORY[auth.user.role] ?? null) : null;
    const roleOk  = userCat ? inc.category === userCat : true;
    return stateOk && catOk && roleOk;
  });

  // ── Stats ───────────────────────────────────────────────────────────────

  const stats = {
    total:    incidents.length,
    critical: incidents.filter((i) => i.priority === "1").length,
    active:   incidents.filter((i) => i.state === "2").length,
    resolved: incidents.filter((i) => i.state === "6" || i.state === "7").length,
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const formatTime = (str: string) => {
    if (!str) return "—";
    const d = new Date(str);
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  const callerName = (inc: SNIncident) =>
    typeof inc.caller_id === "object"
      ? inc.caller_id?.display_value ?? "—"
      : inc.caller_id ?? "—";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="py-6 md:py-10">
        <div className="container max-w-7xl">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link to="/">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2">
                    <ArrowLeft className="h-4 w-4" /> Home
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-primary" />
                Incident Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Live data from ServiceNow PDI · Last refreshed {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchIncidents} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Link to="/report">
                <Button className="gap-2">
                  <AlertTriangle className="h-4 w-4" /> New Report
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Incidents", value: stats.total,    icon: Activity,   color: "text-blue-600",  bg: "bg-blue-50"  },
              { label: "Critical",        value: stats.critical, icon: Flame,      color: "text-red-600",   bg: "bg-red-50"   },
              { label: "In Progress",     value: stats.active,   icon: Users,      color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Resolved",        value: stats.resolved, icon: CheckCircle,color: "text-green-600", bg: "bg-green-50" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            {/* Data source toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Source:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSource("app")}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${source === "app"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  App Reports
                </button>
                <button
                  onClick={() => setSource("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${source === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  All Incidents
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Filter:</span>
            </div>

            {/* State filter */}
            <div className="flex gap-1 flex-wrap">
              {([
                ["all", "All States"],
                ["1",   "New"],
                ["2",   "In Progress"],
                ["3",   "On Hold"],
                ["6",   "Resolved"],
                ["7",   "Closed"],
              ] as [FilterState, string][]).map(([val, lbl]) => (
                <button key={val}
                  onClick={() => setStateFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${stateFilter === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  {lbl}
                </button>
              ))}
            </div>

            <div className="w-px bg-border hidden sm:block" />

            {/* Category filter */}
            <div className="flex gap-1 flex-wrap">
              {([
                ["all",     "All Types"],
                ["medical", "🏥 Medical"],
                ["rescue",  "🚨 Rescue"],
                ["fire",    "🔥 Fire"],
                ["police",  "👮 Police"],
                ["others",  "📝 Others"],
              ] as [CategoryFilter, string][]).map(([val, lbl]) => (
                <button key={val}
                  onClick={() => setCatFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${catFilter === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {/* View role selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">View as:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setViewRole("control")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${viewRole === "control"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                Control Room
              </button>
              <button
                onClick={() => setViewRole("police")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${viewRole === "police"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                Police Team
              </button>
              <button
                onClick={() => setViewRole("team")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${viewRole === "team"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                Team View
              </button>
            </div>
          </div>

          {/* Team category selector (visible when Team View is selected) */}
          {viewRole === "team" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Team:</span>
              <div className="flex gap-1">
                {([
                  ["medical", "🏥 Medical"],
                  ["rescue",  "🚨 Rescue"],
                  ["fire",    "🔥 Fire"],
                  ["police",  "👮 Police"],
                  ["others",  "📝 Others"],
                ] as [CategoryFilter, string][]).map(([val, lbl]) => (
                  <button key={val}
                    onClick={() => setTeamCategory(val)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                      ${teamCategory === val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
              ⚠️ {error} — Check your CORS rule includes GET method and your .env credentials.
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Fetching incidents from ServiceNow…
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No incidents found</p>
              <p className="text-sm">Try changing filters or submit a new report</p>
            </div>
          )}

          {/* Main layout — table + detail panel */}
          {!loading && filtered.length > 0 && (
            <div className="flex gap-6 items-start">

              {/* Incident list */}
              <div className={`flex-1 min-w-0 space-y-3 ${selected ? "hidden lg:block" : ""}`}>
                <p className="text-sm text-muted-foreground mb-3">
                  Showing {filtered.length} of {incidents.length} incidents
                </p>
                {filtered.map((inc) => {
                  const cat   = EMERGENCY_LABELS[inc.category] ?? EMERGENCY_LABELS.others;
                  const state = STATE_CONFIG[inc.state]        ?? STATE_CONFIG["1"];
                  const prio  = PRIORITY_CONFIG[inc.priority]  ?? PRIORITY_CONFIG["3"];
                  const isSelected = selected?.sys_id === inc.sys_id;

                  return (
                    <div key={inc.sys_id}
                      onClick={() => setSelected(isSelected ? null : inc)}
                      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md
                        ${isSelected ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>

                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-foreground">{inc.number}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cat.color}`}>
                            {cat.emoji} {cat.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prio.color}`}>
                            {prio.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={`w-2 h-2 rounded-full ${state.dot}`} />
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${state.color}`}>
                            {state.label}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-foreground font-medium mb-2 line-clamp-1">
                        {inc.short_description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {inc.u_caller_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {inc.u_caller_email}
                          </span>
                        )}
                        {inc.u_caller_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {inc.u_caller_phone}
                          </span>
                        )}
                        {inc.u_full_address && (
                          <span className="flex items-center gap-1 truncate max-w-[260px]">
                            <MapPin className="h-3 w-3 shrink-0" /> {inc.u_full_address.split(",")[0]}
                          </span>
                        )}
                        <span className="ml-auto">{formatTime(inc.opened_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail panel */}
              {selected && (
                <div className="w-full lg:w-96 shrink-0 bg-card border border-border rounded-xl overflow-hidden sticky top-6">
                  {/* Panel header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                      <p className="font-mono font-bold text-foreground">{selected.number}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(selected.opened_at)}</p>
                    </div>
                    <button onClick={() => setSelected(null)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                      ✕
                    </button>
                  </div>

                  <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">

                    {/* Badges */}
                    <div className="flex gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium
                        ${(EMERGENCY_LABELS[selected.category] ?? EMERGENCY_LABELS.others).color}`}>
                        {(EMERGENCY_LABELS[selected.category] ?? EMERGENCY_LABELS.others).emoji}{" "}
                        {(EMERGENCY_LABELS[selected.category] ?? EMERGENCY_LABELS.others).label}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${(STATE_CONFIG[selected.state] ?? STATE_CONFIG["1"]).color}`}>
                        {(STATE_CONFIG[selected.state] ?? STATE_CONFIG["1"]).label}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${(PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG["3"]).color}`}>
                        {(PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG["3"]).label} Priority
                      </span>
                    </div>

                    {/* Caller */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Caller Info</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{selected.u_caller_email || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{selected.u_caller_phone || "—"}</span>
                        </div>
                        {callerName(selected) !== "—" && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{callerName(selected)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Location</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-foreground">{selected.u_full_address || "—"}</span>
                        </div>
                        {selected.u_gps_latitude && (
                          <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono">
                            GPS: {selected.u_gps_latitude}, {selected.u_gps_longitude}
                          </div>
                        )}
                        {selected.u_gps_latitude && (
                          <a
                            href={`https://www.google.com/maps?q=${selected.u_gps_latitude},${selected.u_gps_longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Open in Google Maps →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-lg p-3">
                        {selected.description || selected.short_description || "—"}
                      </p>
                    </div>

                    {/* Open in ServiceNow */}
                    <a
                      href={`${SN_INSTANCE()}/nav/ui/classic/params/target/incident.do%3Fsys_id%3D${selected.sys_id}`}
                      target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full gap-2 mt-2">
                        Open in ServiceNow ↗
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;