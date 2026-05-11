import { useState, useCallback } from "react";
import { AlertTriangle, Loader2, CheckCircle2, XCircle, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanicStatus =
  | "idle"
  | "gps"        // grabbing GPS
  | "geocoding"  // reverse geocoding address
  | "submitting" // posting to backend
  | "success"
  | "error";

interface PanicButtonProps {
  /** "floating" = fixed pill bottom-center (Layout use)
   *  "hero"     = large inline button (Home page use) */
  variant?: "floating" | "hero";
}

// ─── Component ────────────────────────────────────────────────────────────────

const PanicButton = ({ variant = "floating" }: PanicButtonProps) => {
  const [status,        setStatus]       = useState<PanicStatus>("idle");
  const [errorMsg,      setErrorMsg]     = useState("");
  const [incidentNum,   setIncidentNum]  = useState("");
  const [showModal,     setShowModal]    = useState(false);
  const [address,       setAddress]      = useState("");

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMsg("");
    setIncidentNum("");
    setAddress("");
    setShowModal(false);
  }, []);

  // ── Main panic handler ────────────────────────────────────────────────────
  const handlePanic = useCallback(async () => {
    // Already in progress or done — do nothing
    if (status !== "idle") return;

    setShowModal(true);
    setStatus("gps");

    // 1. Grab GPS
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    let latitude: number;
    let longitude: number;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      latitude  = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Could not get your location. Please enable GPS.");
      return;
    }

    // 2. Reverse geocode
    setStatus("geocoding");
    let fullAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    try {
      const geoRes  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const geoData = await geoRes.json();
      if (geoData?.display_name) fullAddress = geoData.display_name;
    } catch {
      // fallback to raw coords — non-fatal
    }

    setAddress(fullAddress);

    // 3. Submit to backend → ServiceNow
    setStatus("submitting");

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000";

    try {
      const payload = {
        // ── Fields that go into ServiceNow incident ──────────────────────
        short_description: `[PANIC] Emergency at ${fullAddress.slice(0, 80)}`,
        description:       `PANIC BUTTON ACTIVATED\n\nLocation : ${fullAddress}\nGPS      : ${latitude}, ${longitude}`,
        category:          "police",   // routes to Police Team + Control Room
        urgency:           "1",        // 1 = Critical
        impact:            "1",        // 1 = High
        state:             "1",        // 1 = New
        u_gps_latitude:    String(latitude),
        u_gps_longitude:   String(longitude),
        u_full_address:    fullAddress,
        // District is auto-set by your ERS District Auto Router Business Rule
        // Emergency Type + Severity auto-set by EmergencyAIClassifier Business Rule
      };

      // Try dedicated panic route first, fall back to generic incident route
      let res = await fetch(`${BACKEND_URL}/api/sn/incident/panic`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(payload),
      });

      // If dedicated panic route doesn't exist yet, use same incident route
      if (res.status === 404) {
        res = await fetch(`${BACKEND_URL}/api/sn/incident`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body:    JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const num  = json?.result?.number ?? "INC??????";
      setIncidentNum(num);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Submission failed. Please call emergency services directly.");
    }
  }, [status]);

  // ── Status label shown inside the modal ──────────────────────────────────
  const statusLabel = {
    idle:       "",
    gps:        "Getting your location…",
    geocoding:  "Finding your address…",
    submitting: "Alerting emergency teams…",
    success:    "",
    error:      "",
  }[status];

  // ─── Floating pill trigger button ─────────────────────────────────────────
  const FloatingTrigger = (
    <button
      onClick={handlePanic}
      aria-label="Emergency panic button"
      className={[
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-5 py-3 rounded-full",
        "bg-red-600 hover:bg-red-700 active:scale-95",
        "text-white font-semibold text-sm shadow-lg shadow-red-600/40",
        "border-2 border-red-400",
        "transition-all duration-150",
        "select-none",
        // pulse ring only when idle
        status === "idle" ? "animate-pulse-ring" : "",
      ].join(" ")}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Emergency Help</span>
    </button>
  );

  // ─── Hero trigger button (Home page) ──────────────────────────────────────
  const HeroTrigger = (
    <button
      onClick={handlePanic}
      aria-label="Emergency panic button"
      className={[
        "group relative inline-flex items-center gap-3",
        "px-8 py-4 rounded-2xl",
        "bg-red-600 hover:bg-red-700 active:scale-[0.98]",
        "text-white font-bold text-lg shadow-xl shadow-red-600/30",
        "border-2 border-red-400/60",
        "transition-all duration-150",
        "w-full sm:w-auto justify-center",
        "select-none",
      ].join(" ")}
    >
      {/* Pulse ring */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl border-2 border-red-400 animate-ping opacity-40 pointer-events-none"
      />
      <AlertTriangle className="h-6 w-6 shrink-0 group-hover:animate-bounce" aria-hidden="true" />
      <span>Get Immediate Help</span>
    </button>
  );

  // ─── Modal ────────────────────────────────────────────────────────────────
  const Modal = showModal ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Emergency panic status"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">

        {/* Close — only when done or error */}
        {(status === "success" || status === "error") && (
          <button
            onClick={reset}
            aria-label="Close"
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* ── In-progress ── */}
        {(status === "gps" || status === "geocoding" || status === "submitting") && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto">
              <Loader2 className="h-8 w-8 text-red-600 animate-spin" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Sending Alert…</p>
              <p className="text-muted-foreground text-sm mt-1">{statusLabel}</p>
            </div>
            {address && (
              <div className="flex items-start gap-2 bg-muted rounded-lg px-3 py-2 text-left">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-muted-foreground line-clamp-2">{address}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Success ── */}
        {status === "success" && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Help Is On The Way!</p>
              <p className="text-muted-foreground text-sm mt-1">
                Emergency teams have been alerted and are being dispatched.
              </p>
            </div>
            {incidentNum && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-xs text-green-700 font-medium">Incident Number</p>
                <p className="text-green-800 font-bold text-xl">{incidentNum}</p>
                <p className="text-xs text-green-600 mt-1">Save this for tracking</p>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2 bg-muted rounded-lg px-3 py-2 text-left">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-muted-foreground line-clamp-2">{address}</p>
              </div>
            )}
            <Button onClick={reset} className="w-full" variant="outline">
              Close
            </Button>
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto">
              <XCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Alert Failed</p>
              <p className="text-muted-foreground text-sm mt-1">{errorMsg}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
              <p className="text-xs text-amber-800 font-semibold mb-1">⚠️ Call directly:</p>
              <p className="text-amber-900 font-bold text-lg">112</p>
              <p className="text-xs text-amber-700">National Emergency Number</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} className="flex-1" variant="outline">
                Cancel
              </Button>
              <Button
                onClick={() => { reset(); setTimeout(handlePanic, 100); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {variant === "floating" ? FloatingTrigger : HeroTrigger}
      {Modal}
    </>
  );
};

export default PanicButton;