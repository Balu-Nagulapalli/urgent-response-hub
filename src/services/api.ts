// src/services/api.ts
// All calls go through backend proxy — credentials stay server-side

export interface ServiceNowUserRecord {
  user_name:  string;
  first_name: string;
  last_name:  string;
  email:      string;
  sys_id:     string;
}

export interface ServiceNowIncidentRecord {
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
  work_notes?:       string;
  caller_id?:        { display_value: string } | string;
}

export interface ServiceNowActivityRecord {
  sys_created_on: string;
  sys_created_by: string;
  value:          string;
  element:        "work_notes" | "comments";
}

type ApiResponse<T> = { data: T; status: number };

// ─── Proxy Base URL ───────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000";
const PROXY_BASE  = `${BACKEND_URL}/api/sn`;

// ─── Incidents ────────────────────────────────────────────────────────────────

export const createIncident = async (data: unknown): Promise<ApiResponse<{ result: ServiceNowIncidentRecord }>> => {
  const res = await fetch(`${PROXY_BASE}/incident`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create incident: ${res.status}`);
  const json = await res.json();
  return { data: json, status: res.status };
};

export const getIncidents = async <T = ServiceNowIncidentRecord[]>(
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResponse<{ result: T }>> => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  const res = await fetch(`${PROXY_BASE}/incidents${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.status}`);
  const json = await res.json();
  return { data: json, status: res.status };
};

export const getIncident = async <T = ServiceNowIncidentRecord>(
  id: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResponse<{ result: T }>> => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  const res = await fetch(`${PROXY_BASE}/incidents/${id}${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch incident: ${res.status}`);
  const json = await res.json();
  return { data: json, status: res.status };
};

export const getIncidentActivity = async <T = ServiceNowActivityRecord[]>(
  id: string
): Promise<ApiResponse<{ result: T }>> => {
  const res = await fetch(`${PROXY_BASE}/incidents/${id}/activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  const json = await res.json();
  return { data: json, status: res.status };
};

export const updateIncident = async <T = ServiceNowIncidentRecord>(
  id: string,
  data: unknown,
  loggedInUsername?: string
): Promise<ApiResponse<{ result: T }>> => {
  // If there's a work_notes field and a logged-in user, prefix the note with the user info
  const payload = data as Record<string, any>;
  if (loggedInUsername && payload.work_notes && typeof payload.work_notes === "string") {
    // Prepend user info to the work note so we know who made the update
    payload.work_notes = `[${loggedInUsername}] ${payload.work_notes}`;
  }

  const res = await fetch(`${PROXY_BASE}/incidents/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update incident: ${res.status}`);
  const json = await res.json();
  return { data: json, status: res.status };
};

export default { createIncident, getIncidents, getIncident, getIncidentActivity, updateIncident };