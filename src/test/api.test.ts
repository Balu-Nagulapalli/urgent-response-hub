import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Dynamic import after mock is set up
const { getIncidents, updateIncident, getIncidentActivity } =
  await import("../services/api");

describe("API Service — Proxy Integration", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("getIncidents calls proxy with district filter in query string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ result: [] }),
    });
    await getIncidents({
      sysparm_query: "u_district.u_district_id=KKD^category=medical",
      sysparm_limit: "50",
    });
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/sn/incidents");
    expect(calledUrl).toContain("u_district.u_district_id=KKD");
  });

  it("getIncidents returns result array from proxy response", async () => {
    const mockIncidents = [
      { sys_id: "1", number: "INC001", category: "medical" },
      { sys_id: "2", number: "INC002", category: "fire" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ result: mockIncidents }),
    });
    const { data } = await getIncidents({ sysparm_limit: "10" });
    expect(data.result).toHaveLength(2);
    expect(data.result[0].number).toBe("INC001");
  });

  it("updateIncident sends PATCH to correct proxy URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ result: { sys_id: "abc123", state: "2" } }),
    });
    await updateIncident("abc123", { state: "2", work_notes: "Dispatched team" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/sn/incidents/abc123");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toMatchObject({ state: "2" });
  });

  it("getIncidentActivity fetches from correct proxy URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [{ value: "Team dispatched", sys_created_by: "cr_kakinada", element: "work_notes" }]
      }),
    });
    const { data } = await getIncidentActivity("abc123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sn/incidents/abc123/activity"),
      expect.anything()
    );
    expect(data.result[0].value).toBe("Team dispatched");
  });

  it("throws error when proxy returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 503,
      json: async () => ({ error: "ServiceNow not configured" }),
    });
    await expect(getIncidents({ sysparm_limit: "10" })).rejects.toThrow(
      /failed to fetch incidents/i
    );
  });

  it("updateIncident does not include Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ result: {} }),
    });
    await updateIncident("abc123", { state: "6" });
    const headers = mockFetch.mock.calls[0][1]?.headers ?? {};
    expect(headers["Authorization"]).toBeUndefined();
  });
});
