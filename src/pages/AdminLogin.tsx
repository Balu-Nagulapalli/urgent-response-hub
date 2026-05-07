import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

const AdminLogin = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"control"|"police"|"team"|null>(null);
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState<string>("fire");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Note: This login is lightweight — it does not verify credentials against
  // a backend. For stronger security integrate a real auth provider.
  const handleLogin = async () => {
    if (!username || !role) { setError("Provide username and role"); return; }
    setLoading(true); setError("");
    try {
      // If password provided, attempt a lightweight ServiceNow auth check.
      const SN_INSTANCE = import.meta.env.VITE_SN_INSTANCE;
      if (!SN_INSTANCE) {
        setError("VITE_SN_INSTANCE not configured in .env");
        setLoading(false);
        return;
      }

      if (password) {
        try {
          const res = await fetch(`${SN_INSTANCE}/api/now/table/incident?sysparm_limit=1`, {
            headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` },
            method: "GET",
          });
          if (res.status === 401) throw new Error("Invalid username or password");
          if (!res.ok) {
            // Could be CORS or other network issue — surface a helpful message
            throw new Error("Could not verify credentials (network or CORS). See console for details.");
          }
        } catch (err: any) {
          setError(err.message ?? "Authentication check failed");
          setLoading(false);
          return;
        }
      }

      auth.login(username, role, role === "team" ? team : undefined);
      navigate("/admin");
    } catch (e: any) {
      setError(e.message ?? "Failed to login");
    } finally { setLoading(false); }
  };

  return (
    <Layout>
      <div className="py-12">
        <div className="container max-w-md">
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold mb-4">Admin / Team Login</h2>
            <div className="space-y-4">
              <div>
                <Label className="mb-1">Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>

              <div>
                <Label className="mb-1">Password (optional — used to verify credentials)</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
              </div>

              <div>
                <Label className="mb-1">Role</Label>
                <div className="flex gap-2">
                  <button className={`px-3 py-1 rounded border ${role==="control"?"bg-primary text-primary-foreground":""}`} onClick={() => setRole("control")}>Control Room</button>
                  <button className={`px-3 py-1 rounded border ${role==="police"?"bg-primary text-primary-foreground":""}`} onClick={() => setRole("police")}>Police Team</button>
                  <button className={`px-3 py-1 rounded border ${role==="team"?"bg-primary text-primary-foreground":""}`} onClick={() => setRole("team")}>Team</button>
                </div>
              </div>

              {role === "team" && (
                <div>
                  <Label className="mb-1">Team Category</Label>
                  <Select onValueChange={(v) => setTeam(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">🏥 Medical</SelectItem>
                      <SelectItem value="rescue">🚨 Rescue</SelectItem>
                      <SelectItem value="fire">🔥 Fire</SelectItem>
                      <SelectItem value="police">👮 Police</SelectItem>
                      <SelectItem value="others">📝 Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end">
                <Button onClick={handleLogin} disabled={loading}>{loading?"Signing in…":"Sign in"}</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminLogin;
