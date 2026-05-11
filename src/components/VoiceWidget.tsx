/**
 * VoiceWidget — Floating chat-bubble style emergency voice reporter
 *
 * Position : fixed bottom-right (does NOT clash with PanicButton at bottom-center)
 * Flow     : Open → Enter phone → Tap mic → Speak → AI classifies → Submit → Done
 * Pipeline : MediaRecorder → /speech-to-text → keyword classify → /api/sn/incident
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic, MicOff, Phone, MapPin, X, Send, Loader2,
  CheckCircle2, XCircle, ChevronDown, Volume2, Zap,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL ?? "http://localhost:5000";
const MAX_RECORD_MS = 10000; // 10 seconds max

// ─── AI keyword classifier ────────────────────────────────────────────────────

interface ClassifyResult {
  category:   "medical" | "fire" | "police" | "rescue" | "others";
  label:      string;
  emoji:      string;
  confidence: "high" | "medium" | "low";
}

const KEYWORD_MAP: { category: ClassifyResult["category"]; keywords: string[] }[] = [
  {
    category: "fire",
    keywords: [
      "fire","burning","burnt","smoke","flames","blaze","arson",
      "explosion","gas leak","explosive","ignite","charred",
    ],
  },
  {
    category: "medical",
    keywords: [
      "accident","injured","bleeding","hurt","pain","hospital","ambulance",
      "unconscious","fainted","seizure","heart attack","stroke","breathless",
      "emergency","wound","fracture","broken bone","overdose","poisoning",
    ],
  },
  {
    category: "police",
    keywords: [
      "robbery","theft","stolen","attack","fight","assault","threat",
      "crime","murder","weapon","gun","knife","kidnap","harassment",
      "domestic","violence","vandalism","trespassing","suspicious",
    ],
  },
  {
    category: "rescue",
    keywords: [
      "flood","trapped","stuck","drowning","collapsed","landslide",
      "earthquake","cyclone","storm","rescue","sinking","stranded",
      "missing","lost","debris","building collapse","fallen",
    ],
  },
];

const CATEGORY_META: Record<ClassifyResult["category"], { label: string; emoji: string }> = {
  fire:    { label: "Fire Team",     emoji: "🔥" },
  medical: { label: "Medical Team",  emoji: "🏥" },
  police:  { label: "Police Team",   emoji: "👮" },
  rescue:  { label: "Rescue Team",   emoji: "🚨" },
  others:  { label: "Control Room",  emoji: "📋" },
};

function classifyTranscript(text: string): ClassifyResult {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const { category, keywords } of KEYWORD_MAP) {
    scores[category] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const category = (best[1] > 0 ? best[0] : "others") as ClassifyResult["category"];
  const confidence: ClassifyResult["confidence"] =
    best[1] >= 3 ? "high" : best[1] >= 1 ? "medium" : "low";

  return { category, confidence, ...CATEGORY_META[category] };
}

// ─── GPS helper ───────────────────────────────────────────────────────────────

interface GPSResult {
  latitude:    number;
  longitude:   number;
  fullAddress: string;
}

async function fetchGPS(): Promise<GPSResult> {
  const pos = await new Promise<GeolocationPosition>((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, {
      enableHighAccuracy: true,
      timeout: 10000,
    })
  );
  const { latitude, longitude } = pos.coords;
  let fullAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );
    const d = await r.json();
    if (d?.display_name) fullAddress = d.display_name;
  } catch { /* fallback to coords */ }
  return { latitude, longitude, fullAddress };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetStep =
  | "closed"
  | "idle"       // open, waiting for input
  | "recording"  // mic active
  | "transcribing"
  | "classified" // show result, confirm before submit
  | "submitting"
  | "success"
  | "error";

// ─── Component ────────────────────────────────────────────────────────────────

const VoiceWidget = () => {
  const [step,        setStep]       = useState<WidgetStep>("closed");
  const [phone,       setPhone]      = useState("");
  const [transcript,  setTranscript] = useState("");
  const [classified,  setClassified] = useState<ClassifyResult | null>(null);
  const [gps,         setGps]        = useState<GPSResult | null>(null);
  const [gpsLoading,  setGpsLoading] = useState(false);
  const [recordSecs,  setRecordSecs] = useState(0);
  const [incidentNum, setIncidentNum]= useState("");
  const [errorMsg,    setErrorMsg]   = useState("");
  const [audioLevel,  setAudioLevel] = useState(0);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const animFrameRef      = useRef<number>(0);
  const phoneInputRef     = useRef<HTMLInputElement>(null);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(timerRef.current!);
    clearTimeout(autoStopRef.current!);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ── Auto-focus phone input when widget opens ────────────────────────────
  useEffect(() => {
    if (step === "idle") setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, [step]);

  // ── Auto-fetch GPS when widget opens ───────────────────────────────────
  useEffect(() => {
    if (step !== "idle" || gps) return;
    setGpsLoading(true);
    fetchGPS()
      .then(setGps)
      .catch(() => {/* user can still submit without GPS */})
      .finally(() => setGpsLoading(false));
  }, [step, gps]);

  // ── Audio level visualizer ──────────────────────────────────────────────
  const startLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let peakLevel = 0;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const max = Math.max(...data);
        peakLevel = Math.max(peakLevel, max);
        setAudioLevel(Math.round(avg));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
    }
  }, []);

  // ── Start recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTracks = stream.getAudioTracks();
      
      chunksRef.current = [];
      
      // Try to use optimal codec
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : "audio/webm";
      
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mr.onerror = (e) => {
        setErrorMsg(`Recording error: ${e.error}`);
      };

      mr.onstop = async () => {
        // stop level monitor
        cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);
        stream.getTracks().forEach((t) => {
          t.stop();
        });

        setStep("transcribing");
        try {
          const blob     = new Blob(chunksRef.current, { type: "audio/webm" });
          
          if (blob.size === 0) {
            throw new Error("No audio recorded. Please try again.");
          }

          const formData = new FormData();
          formData.append("file", blob, "audio.webm");

          const res  = await fetch(`${BACKEND_URL}/speech-to-text`, {
            method: "POST",
            body:   formData,
          });
          
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`STT HTTP ${res.status}: ${errData.details || errData.error || "Unknown error"}`);
          }

          const data = await res.json();
          const text = data.text?.trim() ?? "";

          if (!text) throw new Error("No speech detected. Please try again.");

          setTranscript(text);
          const classified = classifyTranscript(text);
          setClassified(classified);
          setStep("classified");
        } catch (err: any) {
          setErrorMsg(err.message ?? "Transcription failed.");
          setStep("error");
        }
      };

      mr.start();
      setStep("recording");
      setRecordSecs(0);
      startLevelMonitor(stream);

      // Timer
      timerRef.current = setInterval(
        () => setRecordSecs((s) => s + 1),
        1000
      );

      // Auto-stop after MAX_RECORD_MS
      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_MS);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Microphone access denied.");
      setStep("error");
    }
  }, [startLevelMonitor]);

  // ── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current!);
    clearTimeout(autoStopRef.current!);
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Submit to ServiceNow ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!classified) return;
    setStep("submitting");

    try {
      const payload = {
        short_description: `[${classified.category.toUpperCase()}] Voice report | ${phone || "Unknown"}`,
        description: [
          `Voice Emergency Report`,
          ``,
          `Phone    : ${phone || "—"}`,
          `Location : ${gps?.fullAddress ?? "Not captured"}`,
          `GPS      : ${gps ? `${gps.latitude}, ${gps.longitude}` : "—"}`,
          ``,
          `Transcript: "${transcript}"`,
          `AI Class  : ${classified.label} (${classified.confidence} confidence)`,
        ].join("\n"),
        category:        classified.category,
        urgency:         "1",
        impact:          "1",
        state:           "1",
        u_caller_phone:  phone || "",
        u_voice_input:   transcript,
        u_full_address:  gps?.fullAddress ?? "",
        u_gps_latitude:  gps ? String(gps.latitude)  : "",
        u_gps_longitude: gps ? String(gps.longitude) : "",
        // District auto-set by ERS District Auto Router Business Rule
      };

      const res = await fetch(`${BACKEND_URL}/api/sn/incident`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setIncidentNum(json?.result?.number ?? "INC??????");
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Submission failed.");
      setStep("error");
    }
  }, [classified, phone, gps, transcript]);

  // ── Reset everything ────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep("idle");
    setPhone("");
    setTranscript("");
    setClassified(null);
    setIncidentNum("");
    setErrorMsg("");
    setRecordSecs(0);
    setAudioLevel(0);
  }, []);

  const close = useCallback(() => {
    stopRecording();
    setStep("closed");
  }, [stopRecording]);

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── Floating bubble (when closed) ──────────────────────────────────────
  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("idle")}
        aria-label="Open voice emergency reporter"
        className={[
          "fixed bottom-6 right-6 z-50",
          "w-14 h-14 rounded-full",
          "bg-blue-600 hover:bg-blue-700 active:scale-95",
          "text-white shadow-lg shadow-blue-600/40",
          "flex items-center justify-center",
          "border-2 border-blue-400",
          "transition-all duration-150 select-none",
        ].join(" ")}
      >
        <Mic className="h-6 w-6" aria-hidden="true" />
      </button>
    );
  }

  // ── Expanded widget ─────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="Voice emergency reporter"
      className={[
        "fixed bottom-6 right-6 z-50",
        "w-80 rounded-2xl shadow-2xl",
        "bg-card border border-border",
        "flex flex-col overflow-hidden",
        "transition-all duration-200",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold text-sm">Voice Emergency</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={close}
            aria-label="Close widget"
            className="p-1 hover:bg-blue-500 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">

        {/* ── IDLE / RECORDING / TRANSCRIBING ── */}
        {(step === "idle" || step === "recording" || step === "transcribing") && (
          <>
            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" aria-hidden="true" />
                Phone Number
              </label>
              <input
                ref={phoneInputRef}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your contact number"
                disabled={step !== "idle"}
                className={[
                  "w-full h-10 px-3 rounded-lg border border-border",
                  "bg-background text-foreground text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              />
            </div>

            {/* GPS status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {gpsLoading
                ? "Getting your location…"
                : gps
                ? <span className="truncate text-green-600">{gps.fullAddress.slice(0, 50)}…</span>
                : "Location not available"}
            </div>

            {/* Mic button */}
            <div className="space-y-2">
              {step === "idle" && (
                <button
                  onClick={startRecording}
                  className={[
                    "w-full h-12 rounded-xl font-semibold text-sm",
                    "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]",
                    "text-white flex items-center justify-center gap-2",
                    "transition-all duration-150 select-none",
                  ].join(" ")}
                >
                  <Mic className="h-5 w-5" aria-hidden="true" />
                  Tap &amp; Speak Your Emergency
                </button>
              )}

              {step === "recording" && (
                <div className="space-y-2">
                  {/* Audio level bar */}
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, audioLevel * 2)}%` }}
                    />
                  </div>
                  <button
                    onClick={stopRecording}
                    className={[
                      "w-full h-12 rounded-xl font-semibold text-sm",
                      "bg-red-600 hover:bg-red-700 active:scale-[0.98]",
                      "text-white flex items-center justify-center gap-2",
                      "animate-pulse transition-all duration-150 select-none",
                    ].join(" ")}
                  >
                    <MicOff className="h-5 w-5" aria-hidden="true" />
                    Recording… {recordSecs}s — Tap to Stop
                  </button>
                </div>
              )}

              {step === "transcribing" && (
                <div className="w-full h-12 rounded-xl bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="h-4 w-4 animate-pulse" aria-hidden="true" />
                  Transcribing your voice…
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Speak clearly — AI will auto-detect the emergency type
            </p>
          </>
        )}

        {/* ── CLASSIFIED — confirm before submit ── */}
        {step === "classified" && classified && (
          <div className="space-y-3">
            {/* Transcript */}
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">You said:</p>
              <p className="text-sm text-foreground italic">"{transcript}"</p>
            </div>

            {/* Classification result */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-3 space-y-1">
              <p className="text-xs text-blue-600 font-medium">AI Detected</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{classified.emoji}</span>
                  <span className="font-bold text-blue-900">{classified.label}</span>
                </div>
                <span className={[
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  classified.confidence === "high"
                    ? "bg-green-100 text-green-700"
                    : classified.confidence === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600",
                ].join(" ")}>
                  {classified.confidence} confidence
                </span>
              </div>
            </div>

            {/* GPS */}
            {gps && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="line-clamp-2">{gps.fullAddress}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 h-10 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className="h-4 w-4" />
                Redo
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Send className="h-4 w-4" />
                Send Alert
              </button>
            </div>
          </div>
        )}

        {/* ── SUBMITTING ── */}
        {step === "submitting" && (
          <div className="py-4 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Alerting emergency teams…</p>
            <p className="text-xs text-muted-foreground">Please wait</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" aria-hidden="true" />
            <div>
              <p className="font-bold text-foreground">Help Is On The Way!</p>
              <p className="text-xs text-muted-foreground mt-1">Teams have been alerted</p>
            </div>
            {incidentNum && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700">Incident Number</p>
                <p className="font-bold text-green-800 text-lg">{incidentNum}</p>
              </div>
            )}
            <button
              onClick={close}
              className="w-full h-10 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div className="py-4 text-center space-y-3">
            <XCircle className="h-10 w-10 text-red-600 mx-auto" aria-hidden="true" />
            <div>
              <p className="font-bold text-foreground">Something went wrong</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-800 font-semibold">Call directly:</p>
              <p className="font-bold text-amber-900 text-xl">112</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={close}
                className="flex-1 h-10 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={reset}
                className="flex-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceWidget;