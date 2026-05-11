import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search, Clock, CheckCircle, AlertTriangle,
  ArrowLeft, MapPin, Phone, Mail, Loader2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIncidents, getIncidentActivity } from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentData {
  id:            string;
  sys_id?:       string;
  fullName:      string;
  email:         string;
  contactNumber: string;
  emergencyType: string;
  location:      string;
  latitude:      string;
  longitude:     string;
  description:   string;
  status:        "pending" | "active" | "resolved";
  priority:      "low" | "medium" | "high";
  submittedAt:   string;
}

interface ServiceNowIncidentRecord {
  number?: string;
  state?: string;
  sys_id?: string;
  u_caller_email?: string;
  u_caller_phone?: string;
  u_full_address?: string;
  u_gps_latitude?: string;
  u_gps_longitude?: string;
  category?: string;
  short_description?: string;
  description?: string;
  priority?: string;
  opened_at?: string;
}

interface ActivityEntry {
  value:          string;
  sys_created_by: string;
  sys_created_on: string;
  element:        "work_notes" | "comments";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_LABELS: Record<string, string> = {
  medical: "Medical Emergency",
  rescue:  "Rescue Operation",
  fire:    "Fire Assistance",
  police:  "Police Team",
  others:  "Others",
};

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  high:   { label: "High Priority",   className: "bg-red-100 text-red-700"     },
  medium: { label: "Medium Priority", className: "bg-amber-100 text-amber-700" },
  low:    { label: "Standard",        className: "bg-muted text-muted-foreground" },
};

const STATUS_CONFIG = {
  pending:  { label: "Request Received", icon: Clock,         color: "bg-amber-500" },
  active:   { label: "Help On The Way",  icon: AlertTriangle, color: "bg-blue-500"  },
  resolved: { label: "Resolved",         icon: CheckCircle,   color: "bg-green-500" },
};

// ─── Role mapping ─────────────────────────────────────────────────────────────
const SN_ROLE_MAP: Record<string, string> = {
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
};

const ROLE_DISPLAY_NAME: Record<string, string> = {
  "super_admin":  "Super Admin",
  "police_team":  "Police Team",
  "fire_team":    "Fire Team",
  "control_room": "Control Room",
  "rescue_team":  "Rescue Team",
  "medical_team": "Medical Team",
  "general_team": "General Team",
};

const DISTRICT_DISPLAY: Record<string, string> = {
  "eastgodavari":  "East Godavari",
  "kakinada":      "Kakinada",
  "westgodavari":  "West Godavari",
};

// ─── Username prefix to role mapping ───────────────────────────────────────────
const PREFIX_TO_ROLE: Record<string, string> = {
  "cr":      "Control Room",
  "police":  "Police",
  "medical": "Medical",
  "rescue":  "Rescue",
  "fire":    "Fire",
};

const formatRoleWithDistrict = (username: string, role: string): string => {
  // If super_admin, show "Super Admin (All Districts)"
  if (username === "super_admin") {
    return "Super Admin (All Districts)";
  }
  
  // For district-based roles like "police_eastgodavari", "medical_kakinada"
  const parts = username.toLowerCase().split("_");
  if (parts.length >= 2) {
    const prefix = parts[0];
    const districtSlug = parts.slice(1).join("_");
    const districtName = DISTRICT_DISPLAY[districtSlug] || districtSlug;
    const roleLabel = PREFIX_TO_ROLE[prefix] || "Team";
    return `${roleLabel} (${districtName})`;
  }
  
  // Fallback: return formatted username
  return formatTeamName(username);
};

const TIMELINE = [
  { key: "pending",  label: "Request Received", desc: "Your request has been logged in ServiceNow" },
  { key: "active",   label: "Help Dispatched",  desc: "Response team is on the way"                },
  { key: "resolved", label: "Resolved",          desc: "Assistance has been provided"               },
];

const formatDateIST = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  const parsed = dateStr.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateStr)
    ? new Date(dateStr)
    : new Date(`${dateStr}Z`);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(parsed);
};

const formatTeamName = (username: string): string => {
  if (!username) return "Team";
  return username.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Extract username from bracketed work note ───────────────────────────────
const extractUsernameFromNote = (noteValue: string): string | null => {
  const match = noteValue.match(/^\[([^\]]+)\]\s*/);
  return match ? match[1] : null;
};

// ─── ServiceNow state map ─────────────────────────────────────────────────────

const SN_STATE_MAP: Record<string, IncidentData["status"]> = {
  "1": "pending", "2": "active", "3": "active", "6": "resolved", "7": "resolved",
};

// ─── Component ────────────────────────────────────────────────────────────────

const Status = () => {
  const [searchParams]                      = useSearchParams();
  const [incidentId,      setIncidentId]    = useState(searchParams.get("id") ?? "");
  const [incident,        setIncident]      = useState<IncidentData | null>(null);
  const [updates,         setUpdates]       = useState<ActivityEntry[]>([]);
  const [isSearching,     setIsSearching]   = useState(false);
  const [notFound,        setNotFound]      = useState(false);
  const [isFetchingLive,  setIsFetchingLive]= useState(false);
  const [updatesLoading,  setUpdatesLoading]= useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) handleSearch(id);
  }, [searchParams]);

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = async (id?: string) => {
    const searchId = (id ?? incidentId).trim();
    if (!searchId) return;

    setIsSearching(true);
    setNotFound(false);
    setIncident(null);
    setUpdates([]);

    const stored = localStorage.getItem("lastIncident");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id === searchId) {
          setIncident(parsed as IncidentData);
          setIsSearching(false);
          if (parsed.sys_id) fetchActivity(parsed.sys_id);
          fetchLiveStatus(searchId, parsed.sys_id);
          return;
        }
      } catch { /* bad JSON */ }
    }

    const found = await fetchFromServiceNowWithFallback(searchId);
    if (!found) setNotFound(true);
    setIsSearching(false);
  };

  // ── Live status ─────────────────────────────────────────────────────────────

  const fetchLiveStatus = async (incNumber: string, sysId?: string) => {
    setIsFetchingLive(true);
    try {
      const query = sysId ? `sys_id=${sysId}` : `number=${incNumber}`;
      const { data } = await getIncidents({ sysparm_query: query, sysparm_fields: "number,state,sys_id", sysparm_limit: 1 });
      const record = data?.result?.[0] as ServiceNowIncidentRecord | undefined;
      if (!record) return;
      const liveStatus = SN_STATE_MAP[record.state ?? ""] ?? "pending";
      setIncident((prev) => prev ? { ...prev, status: liveStatus, sys_id: record.sys_id ?? prev.sys_id } : prev);
      if (record.sys_id) fetchActivity(record.sys_id);
      const stored = localStorage.getItem("lastIncident");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.setItem("lastIncident", JSON.stringify({ ...parsed, status: liveStatus, sys_id: record.sys_id ?? parsed.sys_id }));
        } catch { /* ignore */ }
      }
    } catch { /* silently fail */ }
    finally { setIsFetchingLive(false); }
  };

  // ── Fetch from ServiceNow ───────────────────────────────────────────────────

  const fetchFromServiceNow = async (incNumber: string): Promise<boolean> => {
    try {
      const { data } = await getIncidents({
        sysparm_query: `number=${incNumber}`,
        sysparm_fields: "number,state,sys_id,u_caller_email,u_caller_phone,u_full_address,u_gps_latitude,u_gps_longitude,category,short_description,description,priority,opened_at",
        sysparm_limit: 1,
      });
      const record = data?.result?.[0] as ServiceNowIncidentRecord | undefined;
      if (!record) return false;

      const liveStatus = SN_STATE_MAP[record.state ?? ""] ?? "pending";
      const snPriority = record.priority === "1" || record.priority === "2" ? "high"
                       : record.priority === "3" ? "medium" : "low";

      setIncident({
        id:            record.number,
        sys_id:        record.sys_id,
        fullName:      record.short_description ?? "—",
        email:         record.u_caller_email    ?? "—",
        contactNumber: record.u_caller_phone    ?? "—",
        emergencyType: record.category          ?? "others",
        location:      record.u_full_address    ?? "—",
        latitude:      record.u_gps_latitude    ?? "",
        longitude:     record.u_gps_longitude   ?? "",
        description:   record.description       ?? "",
        status:        liveStatus,
        priority:      snPriority,
        submittedAt:   record.opened_at         ?? new Date().toISOString(),
      });
      if (record.sys_id) fetchActivity(record.sys_id);
      return true;
    } catch { return false; }
  };
  
  // Fallback: sometimes user may paste a sys_id instead of the incident number
  // Try sys_id lookup if number lookup fails
  const fetchFromServiceNowWithFallback = async (incNumber: string): Promise<boolean> => {
    const found = await fetchFromServiceNow(incNumber);
    if (found) return true;
    try {
      const { data } = await getIncidents({ sysparm_query: `sys_id=${incNumber}`, sysparm_limit: 1 });
      const record = data?.result?.[0] as ServiceNowIncidentRecord | undefined;
      if (!record) return false;
      const liveStatus = SN_STATE_MAP[record.state ?? ""] ?? "pending";
      const snPriority = record.priority === "1" || record.priority === "2" ? "high"
                       : record.priority === "3" ? "medium" : "low";

      setIncident({
        id:            record.number,
        sys_id:        record.sys_id,
        fullName:      record.short_description ?? "—",
        email:         record.u_caller_email    ?? "—",
        contactNumber: record.u_caller_phone    ?? "—",
        emergencyType: record.category          ?? "others",
        location:      record.u_full_address    ?? "—",
        latitude:      record.u_gps_latitude    ?? "",
        longitude:     record.u_gps_longitude   ?? "",
        description:   record.description       ?? "",
        status:        liveStatus,
        priority:      snPriority,
        submittedAt:   record.opened_at         ?? new Date().toISOString(),
      });
      if (record.sys_id) fetchActivity(record.sys_id);
      return true;
    } catch {
      return false;
    }
  };

  // ── Fetch activity ──────────────────────────────────────────────────────────

  const fetchActivity = async (sysId?: string) => {
    if (!sysId) return;
    setUpdatesLoading(true);
    try {
      const { data } = await getIncidentActivity(sysId);
      const activities = (data?.result || []) as ActivityEntry[];
      setUpdates(activities);
    } catch { setUpdates([]); }
    finally { setUpdatesLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const currentStep = incident ? TIMELINE.findIndex((s) => s.key === incident.status) : -1;

  return (
    <Layout>
      <div className="py-8 md:py-12">
        <div className="container max-w-2xl">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full mb-4">
              <Search className="h-5 w-5" />
              <span className="text-sm font-medium">Track Request</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Track Your Request</h1>
            <p className="text-muted-foreground">Enter your Incident ID to check the status</p>
          </div>

          {/* Search */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="incidentId" className="sr-only">Incident ID</Label>
                <Input
                  id="incidentId"
                  placeholder="Enter Incident ID (e.g. INC0010001)"
                  className="h-12 text-base"
                  value={incidentId}
                  onChange={(e) => setIncidentId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={() => handleSearch()} disabled={isSearching || !incidentId.trim()} className="h-12">
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                Search
              </Button>
            </div>
          </div>

          {/* Not found */}
          {notFound && (
            <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
              <Search className="h-12 w-12 mx-auto opacity-30 mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">Incident Not Found</h3>
              <p className="text-muted-foreground mb-6">
                No incident found for "<strong>{incidentId}</strong>". Check the ID and try again.
              </p>
              <Link to="/report"><Button variant="outline">Report a New Incident</Button></Link>
            </div>
          )}

          {/* Incident details */}
          {incident && (
            <div className="space-y-6">
              {isFetchingLive && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                  <Loader2 className="h-3 w-3 animate-spin" /> Fetching latest status from ServiceNow…
                </div>
              )}

              {/* Status card */}
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Incident ID</p>
                    <p className="font-mono font-bold text-lg">{incident.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${PRIORITY_STYLES[incident.priority]?.className}`}>
                    {PRIORITY_STYLES[incident.priority]?.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg mb-5">
                  <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[incident.status].color} animate-pulse`} />
                  <div>
                    <p className="font-semibold">{STATUS_CONFIG[incident.status].label}</p>
                    <p className="text-sm text-muted-foreground">{EMERGENCY_LABELS[incident.emergencyType] ?? incident.emergencyType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{incident.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{incident.contactNumber || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{incident.location || "—"}</p>
                      {incident.latitude && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          GPS: {incident.latitude}, {incident.longitude}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team updates */}
                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">Team Updates</h3>
                      <p className="text-xs text-muted-foreground">Notes and comments from the response team</p>
                    </div>
                    {updatesLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                      </div>
                    )}
                  </div>

                  {updates.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      No team updates yet.
                    </p>
                  ) : (
                    <div className="relative pl-5">
                      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
                      <div className="space-y-4">
                        {updates.map((entry, index) => {
                          const isWorkNote  = entry.element === "work_notes";
                          const dotClasses  = isWorkNote ? "border-amber-300 bg-amber-500" : "border-sky-300 bg-sky-500";
                          
                          // Extract username from bracketed note (e.g., "[cr_kakinada]" from the note content)
                          const extractedUsername = extractUsernameFromNote(entry.value);
                          const usernameToDisplay = extractedUsername || entry.sys_created_by;
                          const roleDisplay = formatRoleWithDistrict(usernameToDisplay, "");
                          
                          return (
                            <div key={`${entry.sys_created_on}-${index}`} className="relative">
                              <div className={`absolute -left-[1.15rem] top-1 h-3.5 w-3.5 rounded-full border-2 ${dotClasses}`} />
                              <div className="rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${isWorkNote ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                                      {isWorkNote ? "Work Note" : "Comment"}
                                    </span>
                                    <p className="text-sm font-semibold text-foreground">{roleDisplay}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{formatDateIST(entry.sys_created_on)}</p>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                  {extractedUsername ? entry.value.replace(/^\[[^\]]+\]\s*/, "") : entry.value}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                <h3 className="font-semibold mb-6">Progress Timeline</h3>
                <div className="space-y-6">
                  {TIMELINE.map((step, i) => {
                    const done    = i <= currentStep;
                    const current = i === currentStep;
                    const Icon    = STATUS_CONFIG[step.key as keyof typeof STATUS_CONFIG].icon;
                    const color   = STATUS_CONFIG[step.key as keyof typeof STATUS_CONFIG].color;
                    return (
                      <div key={step.key} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center
                            ${done ? color : "bg-muted"}
                            ${current ? "ring-4 ring-offset-2 ring-offset-card ring-primary/20" : ""}`}>
                            <Icon className={`h-5 w-5 ${done ? "text-white" : "text-muted-foreground"}`} />
                          </div>
                          {i < TIMELINE.length - 1 && (
                            <div className={`w-0.5 h-8 mt-2 ${done && i < currentStep ? "bg-green-400" : "bg-border"}`} />
                          )}
                        </div>
                        <div className="pt-2">
                          <p className={`font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                          <p className="text-sm text-muted-foreground">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Link to="/"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> Back to Home</Button></Link>
            </div>
          )}

          {/* Empty state */}
          {!incident && !notFound && !searchParams.get("id") && (
            <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
              <Clock className="h-12 w-12 mx-auto opacity-30 mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">Enter Your Incident ID</h3>
              <p className="text-muted-foreground">Use the search box above to track your emergency request.</p>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default Status;