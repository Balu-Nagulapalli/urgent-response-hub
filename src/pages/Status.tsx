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

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentData {
  id:            string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_LABELS: Record<string, string> = {
  medical: "Medical Emergency",
  rescue:  "Rescue Operation",
  fire:    "Fire Assistance",
  police:  "Police Team",
  others:  "Others",
};

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  high:   { label: "High Priority",   className: "bg-red-100 text-red-700" },
  medium: { label: "Medium Priority", className: "bg-amber-100 text-amber-700" },
  low:    { label: "Standard",        className: "bg-muted text-muted-foreground" },
};

const STATUS_CONFIG = {
  pending:  { label: "Request Received", icon: Clock,         color: "bg-amber-500" },
  active:   { label: "Help On The Way",  icon: AlertTriangle, color: "bg-blue-500"  },
  resolved: { label: "Resolved",         icon: CheckCircle,   color: "bg-green-500" },
};

const TIMELINE = [
  { key: "pending",  label: "Request Received", desc: "Your request has been logged in ServiceNow" },
  { key: "active",   label: "Help Dispatched",  desc: "Response team is on the way"                },
  { key: "resolved", label: "Resolved",          desc: "Assistance has been provided"               },
];

// ─── ServiceNow state map ─────────────────────────────────────────────────────
// ServiceNow incident state field values:
// 1 = New → pending | 2 = In Progress → active | 6 = Resolved → resolved
const SN_STATE_MAP: Record<string, IncidentData["status"]> = {
  "1": "pending",
  "2": "active",
  "3": "active",
  "6": "resolved",
  "7": "resolved",
};

// ─── Component ────────────────────────────────────────────────────────────────

const Status = () => {
  const [searchParams]                  = useSearchParams();
  const [incidentId,    setIncidentId]  = useState(searchParams.get("id") ?? "");
  const [incident,      setIncident]    = useState<IncidentData | null>(null);
  const [isSearching,   setIsSearching] = useState(false);
  const [notFound,      setNotFound]    = useState(false);
  const [isFetchingLive, setIsFetchingLive] = useState(false);

  // Auto-search when arriving from the form with ?id=INC...
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) handleSearch(id);
  }, [searchParams]);

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = async (id?: string) => {
    const searchId = (id ?? incidentId).trim();
    if (!searchId) return;

    setIsSearching(true);
    setNotFound(false);
    setIncident(null);

    // Step 1: load from localStorage (instant, populated right after submission)
    const stored = localStorage.getItem("lastIncident");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id === searchId) {
          setIncident(parsed as IncidentData);
          setIsSearching(false);
          // Step 2: also fetch live status from ServiceNow in background
          fetchLiveStatus(searchId, parsed.sys_id);
          return;
        }
      } catch { /* bad JSON — ignore */ }
    }

    // Step 3: if not in localStorage, try ServiceNow directly
    const found = await fetchFromServiceNow(searchId);
    if (!found) setNotFound(true);
    setIsSearching(false);
  };

  // ── Live status fetch from ServiceNow ──────────────────────────────────────

  const fetchLiveStatus = async (incNumber: string, sysId?: string) => {
    setIsFetchingLive(true);
    try {
      const SN_INSTANCE = import.meta.env.VITE_SN_INSTANCE;
      const SN_USERNAME = import.meta.env.VITE_SN_USERNAME;
      const SN_PASSWORD = import.meta.env.VITE_SN_PASSWORD;
      const auth        = "Basic " + btoa(`${SN_USERNAME}:${SN_PASSWORD}`);

      // Query by sys_id if available (faster), else by number
      const query = sysId
        ? `sys_id=${sysId}`
        : `number=${incNumber}`;

      const res = await fetch(
        `${SN_INSTANCE}/api/now/table/incident?${query}&sysparm_fields=number,state,sys_id,u_caller_email,u_caller_phone,u_full_address,u_gps_latitude,u_gps_longitude,category,short_description,description,priority,opened_at&sysparm_limit=1`,
        { headers: { Accept: "application/json", Authorization: auth } }
      );

      if (!res.ok) return;

      const json   = await res.json();
      const record = json?.result?.[0];
      if (!record) return;

      // Map live state back to our status
      const liveStatus = SN_STATE_MAP[record.state] ?? "pending";

      // Update local incident with latest state from ServiceNow
      setIncident((prev) => prev ? { ...prev, status: liveStatus } : prev);

      // Also update localStorage
      const stored = localStorage.getItem("lastIncident");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.setItem("lastIncident", JSON.stringify({ ...parsed, status: liveStatus }));
        } catch { /* ignore */ }
      }
    } catch { /* silently fail — local data still shows */ }
    finally { setIsFetchingLive(false); }
  };

  // ── Fetch directly from ServiceNow (when not in localStorage) ──────────────

  const fetchFromServiceNow = async (incNumber: string): Promise<boolean> => {
    try {
      const SN_INSTANCE = import.meta.env.VITE_SN_INSTANCE;
      const SN_USERNAME = import.meta.env.VITE_SN_USERNAME;
      const SN_PASSWORD = import.meta.env.VITE_SN_PASSWORD;
      const auth        = "Basic " + btoa(`${SN_USERNAME}:${SN_PASSWORD}`);

      const res = await fetch(
        `${SN_INSTANCE}/api/now/table/incident?number=${incNumber}&sysparm_fields=number,state,u_caller_email,u_caller_phone,u_full_address,u_gps_latitude,u_gps_longitude,category,short_description,description,priority,opened_at&sysparm_limit=1`,
        { headers: { Accept: "application/json", Authorization: auth } }
      );

      if (!res.ok) return false;

      const json   = await res.json();
      const record = json?.result?.[0];
      if (!record) return false;

      const liveStatus = SN_STATE_MAP[record.state] ?? "pending";
      const snPriority = record.priority === "1" || record.priority === "2" ? "high"
                       : record.priority === "3" ? "medium" : "low";

      setIncident({
        id:            record.number,
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
      return true;
    } catch { return false; }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentStep = incident
    ? TIMELINE.findIndex((s) => s.key === incident.status)
    : -1;

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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Track Your Request
            </h1>
            <p className="text-muted-foreground">
              Enter your Incident ID to check the status
            </p>
          </div>

          {/* Search box */}
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
              <Button
                onClick={() => handleSearch()}
                disabled={isSearching || !incidentId.trim()}
                className="h-12"
              >
                {isSearching
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Search className="h-5 w-5" />}
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
              <Link to="/report">
                <Button variant="outline">Report a New Incident</Button>
              </Link>
            </div>
          )}

          {/* Incident details */}
          {incident && (
            <div className="space-y-6">

              {/* Live status badge */}
              {isFetchingLive && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching latest status from ServiceNow…
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

                {/* Status pill */}
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg mb-5">
                  <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[incident.status].color} animate-pulse`} />
                  <div>
                    <p className="font-semibold">{STATUS_CONFIG[incident.status].label}</p>
                    <p className="text-sm text-muted-foreground">{EMERGENCY_LABELS[incident.emergencyType] ?? incident.emergencyType}</p>
                  </div>
                </div>

                {/* Details grid */}
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
                          <p className={`font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                            {step.label}
                          </p>
                          <p className="text-sm text-muted-foreground">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Back button */}
              <Link to="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4" /> Back to Home
                </Button>
              </Link>
            </div>
          )}

          {/* Empty state */}
          {!incident && !notFound && !searchParams.get("id") && (
            <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
              <Clock className="h-12 w-12 mx-auto opacity-30 mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">Enter Your Incident ID</h3>
              <p className="text-muted-foreground">
                Use the search box above to track your emergency request.
              </p>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default Status;