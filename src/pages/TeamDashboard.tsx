import { useEffect, useState, useMemo } from "react";
import { useAuth, ROLE_CATEGORY, UserRole } from "../AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getIncidents, getIncidentActivity, updateIncident, ServiceNowActivityRecord, ServiceNowIncidentRecord } from "@/services/api";
import {
  RefreshCw, MapPin, Phone, Mail, Loader2, Activity,
  CheckCircle, Clock, LogOut, AlertTriangle, ShieldAlert,
  ChevronUp, ChevronDown,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface Incident {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  category: "medical" | "fire" | "rescue" | "police" | "others";
  state: "1" | "2" | "6" | "7";
  priority: "1" | "2" | "3" | "4";
  u_caller_email: string;
  u_caller_phone: string;
  u_full_address: string;
  u_gps_latitude: string;
  u_gps_longitude: string;
  opened_at: string;
  work_notes?: string;
}

interface Stats {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

interface ActivityEntry {
  sys_created_on: string;
  sys_created_by: string;
  value: string;
  element: "work_notes" | "comments";
}

// ─── Permissions ────────────────────────────────────────────────────────────
const canChangePriority = (role: UserRole): boolean =>
  role === "control_room" || role === "super_admin";

const canChangeState = (_role: UserRole): boolean => true; // all roles

const canAddNotes = (_role: UserRole): boolean => true; // all roles

// ─── Constants ─────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<UserRole, string> = {
  control_room: "bg-purple-700",
  police_team:        "bg-blue-700",
  medical_team:       "bg-red-700",
  fire_team:          "bg-amber-700",
  rescue_team:        "bg-orange-700",
  general_team:       "bg-gray-700",
  super_admin:        "bg-slate-900",
};

const ROLE_EMOJI: Record<UserRole, string> = {
  control_room: "🎛️",
  police_team:        "👮",
  medical_team:       "🏥",
  fire_team:          "🔥",
  rescue_team:        "🚨",
  general_team:       "👥",
  super_admin:        "",
};

const ROLE_NAME: Record<UserRole, string> = {
  control_room: "Control Room",
  police_team:        "Police Team",
  medical_team:       "Medical Team",
  fire_team:          "Fire Team",
  rescue_team:        "Rescue Team",
  general_team:       "General Team",
  super_admin:        "Super Admin",
};

const CATEGORY_EMOJI: Record<string, string> = {
  medical: "🏥", fire: "🔥", rescue: "🚨", police: "👮", others: "📝",
};

const STATE_LABEL: Record<string, string> = {
  "1": "New", "2": "In Progress", "6": "Resolved", "7": "Closed",
};

const STATE_COLOR: Record<string, string> = {
  "1": "bg-blue-100 text-blue-800",
  "2": "bg-yellow-100 text-yellow-800",
  "6": "bg-green-100 text-green-800",
  "7": "bg-gray-100 text-gray-800",
};

const PRIORITY_LABEL: Record<string, string> = {
  "1": "Critical", "2": "High", "3": "Medium", "4": "Low",
};

const PRIORITY_COLOR: Record<string, string> = {
  "1": "bg-red-100 text-red-800",
  "2": "bg-orange-100 text-orange-800",
  "3": "bg-yellow-100 text-yellow-800",
  "4": "bg-green-100 text-green-800",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const formatDate = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  // ServiceNow returns UTC without 'Z' — add it so JS parses correctly
  const utcStr = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata", // ✅ IST
  }).format(new Date(utcStr));
};

const buildQueryFilter = (role: UserRole, districtId?: string): string => {
  const category = ROLE_CATEGORY[role];

  // District filter — skip if super_admin or no district
  const districtFilter =
    districtId && districtId !== "ALL"
      ? `u_district.u_district_id=${districtId}^`
      : "";

  const baseFilter = "u_full_addressISNOTEMPTY^ORDERBYDESCopened_at";

  return category
    ? `${districtFilter}category=${category}^${baseFilter}`
    : `${districtFilter}${baseFilter}`;
};

const getStats = (incidents: Incident[]): Stats => ({
  total:      incidents.length,
  new:        incidents.filter((i) => i.state === "1").length,
  inProgress: incidents.filter((i) => i.state === "2").length,
  resolved:   incidents.filter((i) => i.state === "6" || i.state === "7").length,
  closed:     incidents.filter((i) => i.state === "7").length,
});


// ─── Component ─────────────────────────────────────────────────────────────
export default function TeamDashboard() {
  const { user, logout } = useAuth();
  const [incidents,       setIncidents]       = useState<Incident[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [selectedIncident,setSelectedIncident]= useState<Incident | null>(null);
  const [stateFilter,     setStateFilter]     = useState<string | null>(null);
  const [workNoteInput,   setWorkNoteInput]   = useState("");
  const [savingNote,      setSavingNote]      = useState(false);
  const [updatingState,   setUpdatingState]   = useState(false);
  const [updatingPriority,setUpdatingPriority]= useState(false);
  const [activity,        setActivity]        = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // ─ Fetch ────────────────────────────────────────────────────────────────
  const fetchIncidents = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const query = buildQueryFilter(user.role, user.districtId);
      const { data } = await getIncidents<ServiceNowIncidentRecord[]>({
        sysparm_query: query,
        sysparm_fields: "sys_id,number,short_description,description,category,state,priority,u_caller_email,u_caller_phone,u_full_address,u_gps_latitude,u_gps_longitude,opened_at,work_notes",
        sysparm_limit: 100,
      });
      setIncidents((data.result || []) as Incident[]);
      setActivity([]);
      setSelectedIncident(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async (sys_id: string) => {
    setActivityLoading(true);
    try {
      const { data: d } = await getIncidentActivity<ServiceNowActivityRecord[]>(sys_id);
      setActivity((d.result || []) as ActivityEntry[]);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const selectIncident = (inc: Incident | null) => {
    setSelectedIncident(inc);
    setActivity([]);
    if (inc) fetchActivity(inc.sys_id);
  };

  useEffect(() => { fetchIncidents(); }, [user]);

  const filteredIncidents = useMemo(() =>
    stateFilter ? incidents.filter((i) => i.state === stateFilter) : incidents,
    [incidents, stateFilter]
  );

  const stats = useMemo(() => getStats(incidents), [incidents]);

  // ─ Patch helper ─────────────────────────────────────────────────────────
  const patchIncident = async (sys_id: string, body: object) => {
    const { data } = await updateIncident(sys_id, body, user?.username);
    return data.result as Incident;
  };

  const updateLocal = (updated: Incident) => {
    setIncidents((prev) => prev.map((i) => i.sys_id === updated.sys_id ? updated : i));
    setSelectedIncident(updated);
    fetchActivity(updated.sys_id);
  };

  // ─ Change state ─────────────────────────────────────────────────────────
  const handleChangeState = async (newState: string) => {
    if (!selectedIncident || !user || !canChangeState(user.role)) return;
    setUpdatingState(true);
    try {
      const unsavedNote = workNoteInput.trim();

      // ── If there's an unsaved note, save it first ──────────────────────
      if (unsavedNote) {
        await patchIncident(selectedIncident.sys_id, { work_notes: unsavedNote });
        setWorkNoteInput("");
      }

      const body: Record<string, string> = { state: newState };

      // ServiceNow requires these fields when resolving (state=6)
      if (newState === "6") {
        body.close_code = "Solution provided";
        body.close_notes = unsavedNote || selectedIncident.work_notes || "Resolved by team";
      }

      updateLocal(await patchIncident(selectedIncident.sys_id, body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update state");
    }
    finally { setUpdatingState(false); }
  };

  // ─ Change priority (control_room only) ──────────────────────────────────
  const handleChangePriority = async (direction: "up" | "down") => {
    if (!selectedIncident || !user || !canChangePriority(user.role)) return;
    const current = parseInt(selectedIncident.priority);
    const next = direction === "up"
      ? Math.max(1, current - 1)
      : Math.min(4, current + 1);
    if (next === current) return;
    setUpdatingPriority(true);
    try { updateLocal(await patchIncident(selectedIncident.sys_id, { priority: String(next) })); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update priority"); }
    finally { setUpdatingPriority(false); }
  };

  // ─ Add work note ────────────────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!selectedIncident || !workNoteInput.trim() || !user || !canAddNotes(user.role)) return;
    setSavingNote(true);
    try {
      await updateIncident(selectedIncident.sys_id, { work_notes: workNoteInput }, user.username);

      const updated = {
        ...selectedIncident,
        work_notes: (selectedIncident.work_notes ? selectedIncident.work_notes + "\n" : "") + workNoteInput,
      };
      setSelectedIncident(updated);
      setIncidents((prev) => prev.map((i) => i.sys_id === updated.sys_id ? updated : i));
      setWorkNoteInput("");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to add note"); }
    finally { setSavingNote(false); }
  };

  // ─ State transition button ───────────────────────────────────────────────
  const getStateButton = () => {
    if (!selectedIncident || !user || !canChangeState(user.role)) return null;
    switch (selectedIncident.state) {
      case "1":
        return (
          <Button onClick={() => handleChangeState("2")} disabled={updatingState} className="w-full">
            {updatingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ▶ Start Progress
          </Button>
        );
      case "2":
        return (
          <div className="space-y-2">
            {!selectedIncident.work_notes && !workNoteInput.trim() && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ Add a work note before resolving
              </p>
            )}
            <Button
              onClick={() => handleChangeState("6")}
              disabled={updatingState || (!selectedIncident.work_notes && !workNoteInput.trim())}
              className="w-full"
            >
              {updatingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ✓ Mark as Resolved
            </Button>
          </div>
        );
      case "6":
        return (
          <p className="text-xs text-center py-2 bg-gray-50 rounded border text-gray-400">
            ✓ Resolved — click Close to finalize
          </p>
        );
      case "7":
        return (
          <p className="text-xs text-center py-2 bg-green-50 rounded border text-green-600 font-medium">
            ✅ Incident Closed
          </p>
        );
    }
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* NAVBAR */}
      <nav className={`${ROLE_COLORS[user.role]} text-white px-6 py-4 shadow-md`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{ROLE_EMOJI[user.role]}</span>
            <div>
              <h1 className="text-xl font-bold leading-tight">{ROLE_NAME[user.role]}</h1>
              <p className="text-xs opacity-70">
                {user.districtName
                  ? `${user.districtName} · ${ROLE_NAME[user.role]}`
                  : ROLE_NAME[user.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Permission badges */}
            <div className="hidden sm:flex gap-2 text-xs">
              {canChangePriority(user.role) && (
                <span className="bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Priority Control
                </span>
              )}
              <span className="bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
                {user.districtName && (
                  <span className="opacity-70">{user.districtName} ·</span>
                )}
                {user.displayName}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchIncidents} disabled={loading}
              className="text-white hover:bg-white/20">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}
              className="text-white hover:bg-white/20">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* ERROR */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-6 mt-4 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-white border-b">
        <StatCard label="Total"       count={stats.total}      icon={<Activity />}    />
        <StatCard label="New"         count={stats.new}        icon={<Clock />}       />
        <StatCard label="In Progress" count={stats.inProgress} icon={<Loader2 />}     />
        <StatCard label="Resolved/Closed" count={stats.resolved} icon={<CheckCircle />} />
      </div>

      {/* FILTER TABS + CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b bg-white px-4 py-2 gap-2 overflow-x-auto whitespace-nowrap">
          {([null, "1", "2", "6", "7"] as (string | null)[]).map((val) => (
            <div key={val ?? "all"} className="flex-shrink-0">
              <FilterTab
                label={val ? STATE_LABEL[val] : "All"}
                active={stateFilter === val}
                onClick={() => setStateFilter(val)}
              />
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden gap-4 p-4">

          {/* INCIDENT LIST */}
          <div className="flex-1 bg-white rounded-lg shadow overflow-y-auto">
            {loading && incidents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <Clock className="h-10 w-10 opacity-30" />
                <p>No incidents found</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 px-4 pt-3 pb-1">
                  {filteredIncidents.length} of {incidents.length} incidents
                </p>
                {filteredIncidents.map((incident) => (
                  <div key={incident.sys_id}
                    onClick={() => selectIncident(incident)}
                    className={`border-b p-4 cursor-pointer transition-colors ${
                      selectedIncident?.sys_id === incident.sys_id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"
                    }`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-700">{incident.number}</div>
                        <div className="text-sm text-gray-600 line-clamp-2">{incident.short_description}</div>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 shrink-0">
                        {CATEGORY_EMOJI[incident.category]} {incident.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={PRIORITY_COLOR[incident.priority]}>{PRIORITY_LABEL[incident.priority]}</Badge>
                      <Badge className={STATE_COLOR[incident.state]}>{STATE_LABEL[incident.state]}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {incident.u_caller_email && (
                        <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{incident.u_caller_email}</div>
                      )}
                      {incident.u_full_address && (
                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{incident.u_full_address.split(",")[0]}</div>
                      )}
                      <div className="text-gray-400">{formatDate(incident.opened_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DETAIL PANEL */}
            {selectedIncident && (
            <div className="w-full sm:w-96 bg-white rounded-lg shadow overflow-y-auto flex flex-col">
              {/* Header */}
              <div className="p-5 border-b sticky top-0 bg-white z-10">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-bold font-mono">{selectedIncident.number}</h2>
                  <div className="flex items-center gap-2">
                    <a href={`${import.meta.env.VITE_SN_INSTANCE}/incident.do?sys_id=${selectedIncident.sys_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">↗ SN</a>
                    <button onClick={() => selectIncident(null)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{formatDate(selectedIncident.opened_at)}</p>
              </div>

              <div className="p-5 space-y-5 flex-1">

                {/* Status badges */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                      {CATEGORY_EMOJI[selectedIncident.category]} {selectedIncident.category}
                    </Badge>
                    <Badge className={STATE_COLOR[selectedIncident.state]}>
                      {STATE_LABEL[selectedIncident.state]}
                    </Badge>
                    <Badge className={PRIORITY_COLOR[selectedIncident.priority]}>
                      {PRIORITY_LABEL[selectedIncident.priority]}
                    </Badge>
                  </div>
                </div>

                {/* ── Priority control (control_room only) ── */}
                {user && canChangePriority(user.role) && (
                  <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                    <p className="text-xs font-semibold text-purple-700 uppercase mb-2 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Priority Control
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium px-2 py-1 rounded ${PRIORITY_COLOR[selectedIncident.priority]}`}>
                        {PRIORITY_LABEL[selectedIncident.priority]}
                      </span>
                      <div className="flex gap-1 ml-auto">
                        <Button size="sm" variant="outline" disabled={updatingPriority || selectedIncident.priority === "1"}
                          onClick={() => handleChangePriority("up")}
                          className="h-7 w-7 p-0 border-purple-300 hover:bg-purple-100">
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={updatingPriority || selectedIncident.priority === "4"}
                          onClick={() => handleChangePriority("down")}
                          className="h-7 w-7 p-0 border-purple-300 hover:bg-purple-100">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-purple-500 mt-1">1=Critical · 2=High · 3=Medium · 4=Low</p>
                  </div>
                )}

                {/* Caller */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Caller</p>
                  <div className="space-y-1 text-sm">
                    {selectedIncident.u_caller_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a href={`mailto:${selectedIncident.u_caller_email}`} className="text-blue-600 hover:underline">
                          {selectedIncident.u_caller_email}
                        </a>
                      </div>
                    )}
                    {selectedIncident.u_caller_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${selectedIncident.u_caller_phone}`} className="text-blue-600 hover:underline">
                          {selectedIncident.u_caller_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Location</p>
                  <div className="text-sm space-y-2">
                    {selectedIncident.u_full_address && (
                      <p className="text-gray-700">{selectedIncident.u_full_address}</p>
                    )}
                    {selectedIncident.u_gps_latitude && (
                      <div>
                        <p className="font-mono text-xs text-gray-400 mb-1">
                          {selectedIncident.u_gps_latitude}, {selectedIncident.u_gps_longitude}
                        </p>
                        <a href={`https://maps.google.com/?q=${selectedIncident.u_gps_latitude},${selectedIncident.u_gps_longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</p>
                  <div className="bg-gray-50 p-3 rounded text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono border">
                    {selectedIncident.description || selectedIncident.short_description || "—"}
                  </div>
                </div>

                {/* Work notes */}
                {user && canAddNotes(user.role) && 
                 selectedIncident.state !== "6" && 
                 selectedIncident.state !== "7" && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Work Notes</p>
                    {selectedIncident.work_notes && (
                      <div className="bg-gray-50 p-3 rounded text-xs text-gray-700 whitespace-pre-wrap max-h-24 overflow-y-auto font-mono border mb-3">
                        {selectedIncident.work_notes}
                      </div>
                    )}
                    <textarea
                      value={workNoteInput}
                      onChange={(e) => setWorkNoteInput(e.target.value)}
                      placeholder="Add a work note..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                    <Button onClick={handleAddNote} disabled={savingNote || !workNoteInput.trim()}
                      className="w-full mt-2" size="sm">
                      {savingNote && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Add Note
                    </Button>
                  </div>
                )}

                {/* Activity Timeline */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" />
                    Activity History
                  </p>

                  {activityLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading history...
                    </div>
                  ) : activity.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No activity yet</p>
                  ) : (
                    <div className="space-y-3">
                      {activity.map((entry, idx) => (
                        <div key={idx} className="flex gap-3">
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            {entry.sys_created_by.charAt(0).toUpperCase()}
                          </div>
                          {/* Content */}
                          <div className="flex-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">
                                {entry.sys_created_by.replace(/_/g, " ")}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                entry.element === "work_notes"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}>
                                {entry.element === "work_notes" ? "Work Note" : "Comment"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{entry.value}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(entry.sys_created_on)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* State transition */}
                {user && canChangeState(user.role) && (
                  <div className="pt-2 border-t">
                    {getStateButton()}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────
function StatCard({ label, count, icon }: { label: string; count: number; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm font-medium">{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{count}</div>
    </div>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center flex-shrink-0 px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md ${
        active ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900"
      }`}>
      {label}
    </button>
  );
}