import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, MapPin, Phone, User, FileText, Send, Loader2,
  CheckCircle2, Navigation,
} from "lucide-react";
import Layout from "@/components/Layout";
import VoiceRecorder from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Schema ───────────────────────────────────────────────────────────────────
// FIX 1: emergencyType made optional with a clearer error so validation
//         failure is visible; all fields align with what the form collects.

const reportSchema = z.object({
  fullName:      z.string().min(2, "Name must be at least 2 characters").max(100),
  contactNumber: z.string().min(10, "Enter a valid phone number").max(15),
  email:         z.string().email("Enter a valid email").optional().or(z.literal("")),
  location:      z.string().min(5, "Please provide a detailed location").max(200),
  latitude:      z.string().optional(),
  longitude:     z.string().optional(),
  emergencyType: z.enum(["medical", "rescue", "fire", "police", "others"], {
    // FIX 1: explicit message shown when nothing is selected
    errorMap: () => ({ message: "Please select an emergency type" }),
  }),
  description:   z.string().max(1000).optional().or(z.literal("")),
  voiceInput:    z.string().max(2000).optional().or(z.literal("")),
});

type ReportFormData = z.infer<typeof reportSchema>;

// ─── GPS State ────────────────────────────────────────────────────────────────

interface GPSData {
  latitude:    number;
  longitude:   number;
  accuracy:    number;
  fullAddress: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ReportIncident = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsStatus,    setGpsStatus]    = useState<"idle" | "loading" | "success" | "error">("idle");
  const [gpsData,      setGpsData]      = useState<GPSData | null>(null);
  const [gpsError,     setGpsError]     = useState("");
  const [micError,     setMicError]     = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    // FIX 2: set default values so no field starts as undefined
    defaultValues: {
      fullName:      "",
      contactNumber: "",
      email:         "",
      location:      "",
      latitude:      "",
      longitude:     "",
      description:   "",
      voiceInput:    "",
    },
  });

  // FIX 2: useCallback prevents VoiceRecorder from causing re-renders
  const handleTranscriptReady = useCallback((text: string) => {
    const cleanedText = text.trim();
    if (!cleanedText) return;
    setValue("description", cleanedText, { shouldDirty: true, shouldValidate: true });
    setValue("voiceInput",  cleanedText, { shouldDirty: true, shouldValidate: true });
    setMicError("");
  }, [setValue]);

  // FIX 2: useCallback for GPS too
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setValue("latitude",  String(latitude));
        setValue("longitude", String(longitude));

        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const fullAddress = data.display_name ?? `${latitude}, ${longitude}`;
          setValue("location", fullAddress);
          setGpsData({ latitude, longitude, accuracy: Math.round(accuracy), fullAddress });
        } catch {
          setValue("location", `${latitude}, ${longitude}`);
          setGpsData({ latitude, longitude, accuracy: Math.round(accuracy), fullAddress: `${latitude}, ${longitude}` });
        }
        setGpsStatus("success");
      },
      (err) => {
        setGpsStatus("error");
        setGpsError(err.message ?? "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setValue]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: ReportFormData) => {
    setIsSubmitting(true);
    try {
      const prefix = {
        medical: "[MEDICAL]",
        rescue:  "[RESCUE]",
        fire:    "[FIRE]",
        police:  "[POLICE]",
        others:  "[OTHERS]",
      }[data.emergencyType];

      const description = [
        `Reporter : ${data.fullName}`,
        `Phone    : ${data.contactNumber}`,
        `Email    : ${data.email || "—"}`,
        `Location : ${data.location}`,
        `GPS      : ${data.latitude ?? "—"}, ${data.longitude ?? "—"}`,
        ``,
        `Details  : ${data.description}`,
      ].join("\n");

      const payload = {
        short_description: `${prefix} | ${data.fullName} | ${data.contactNumber}`,
        description,
        category:        data.emergencyType,
        urgency:         "1",
        impact:          "1",
        u_caller_phone:  data.contactNumber,
        u_caller_email:  data.email || "",
        u_full_address:  data.location,
        // FIX: field names match Business Rule (u_gps_latitude / u_gps_longitude)
        u_gps_latitude:  data.latitude  ?? "",
        u_gps_longitude: data.longitude ?? "",
        u_voice_input:   data.voiceInput || "",
      };

          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000";
          const res = await fetch(`${BACKEND_URL}/api/sn/incident`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              // No Authorization header — server handles credentials
            },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const incidentNumber = json?.result?.number ?? "INC??????";

      toast({
        title:       "✅ Help Request Submitted!",
        description: `Incident ${incidentNumber} created. Help is on the way.`,
      });

      navigate(`/status?id=${incidentNumber}`);
    } catch (err: any) {
      toast({
        title:       "❌ Submission Failed",
        description: err.message ?? "Please try again.",
        variant:     "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIX 1: show all validation errors in one place so user knows what's missing
  const onInvalid = (errs: typeof errors) => {
    const first = Object.values(errs)[0];
    if (first?.message) {
      toast({
        title:       "⚠️ Please fix the form",
        description: first.message as string,
        variant:     "destructive",
      });
    }
  };

  return (
    // FIX 3: removed any global cursor:pointer that was leaking from Layout
    // Added select-none on non-input areas to reduce lag from text selection
    <Layout>
      <div className="py-8 md:py-12">
        <div className="container max-w-2xl">

          {/* Header */}
          <div className="text-center mb-8 select-none">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Emergency Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Report an Incident
            </h1>
            <p className="text-muted-foreground">
              Fill in the details below. Help will be dispatched immediately.
            </p>
          </div>

          {/* FIX 1: pass onInvalid as second arg so errors surface via toast */}
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border space-y-6">

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-base font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input id="fullName" placeholder="Enter your full name"
                  className="h-12 text-base" {...register("fullName")} />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-base font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Contact Number <span className="text-destructive">*</span>
                </Label>
                <Input id="contactNumber" type="tel" placeholder="Enter your phone number"
                  className="h-12 text-base" {...register("contactNumber")} />
                {errors.contactNumber && (
                  <p className="text-sm text-destructive">{errors.contactNumber.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Email{" "}
                  <span className="text-muted-foreground text-sm font-normal">(optional)</span>
                </Label>
                <Input id="email" type="email" placeholder="Enter your email"
                  className="h-12 text-base" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Location + GPS */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-base font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2 items-start">
                  <Input
                    id="location"
                    placeholder="Enter address or tap Use GPS →"
                    className="h-12 text-base flex-1"
                    {...register("location")}
                  />
                  {/* FIX 3: explicit cursor-pointer only on this button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGPS}
                    disabled={gpsStatus === "loading"}
                    className="h-12 px-3 shrink-0 gap-1.5 cursor-pointer"
                  >
                    {gpsStatus === "loading"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Navigation className="h-4 w-4" />}
                    <span className="hidden sm:inline text-sm">GPS</span>
                  </Button>
                </div>
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location.message}</p>
                )}
                {gpsStatus === "error" && (
                  <p className="text-sm text-destructive">{gpsError}</p>
                )}
                {gpsStatus === "success" && gpsData && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      GPS captured
                      <span className="ml-auto font-normal text-green-600">
                        ±{gpsData.accuracy}m
                      </span>
                    </p>
                    <div className="flex gap-4 text-xs text-green-700">
                      <span>Lat: <strong>{gpsData.latitude}</strong></span>
                      <span>Lng: <strong>{gpsData.longitude}</strong></span>
                    </div>
                    <p className="text-xs text-green-600 truncate">{gpsData.fullAddress}</p>
                  </div>
                )}
                <input type="hidden" {...register("latitude")}  />
                <input type="hidden" {...register("longitude")} />
              </div>

              {/* Emergency Type */}
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Type of Emergency <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) =>
                    setValue("emergencyType", v as ReportFormData["emergencyType"], {
                      shouldDirty:    true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select emergency type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical" className="text-base py-3">🏥 Medical Emergency</SelectItem>
                    <SelectItem value="rescue"  className="text-base py-3">🚨 Rescue Operation</SelectItem>
                    <SelectItem value="fire"    className="text-base py-3">🔥 Fire Assistance</SelectItem>
                    <SelectItem value="police"  className="text-base py-3">👮 Police Team</SelectItem>
                    <SelectItem value="others"  className="text-base py-3">📝 Others</SelectItem>
                  </SelectContent>
                </Select>
                {errors.emergencyType && (
                  <p className="text-sm text-destructive">{errors.emergencyType.message}</p>
                )}
              </div>

              {/* Description + Voice */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description{" "}
                  <span className="text-muted-foreground text-sm font-normal">(optional)</span>
                </Label>
                <div className="space-y-2">
                  <Textarea
                    id="description"
                    placeholder="Describe the emergency situation, number of people affected, and any immediate needs..."
                    className="min-h-[120px] text-base resize-none"
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}

                  {/* FIX 2: VoiceRecorder gets stable callback refs — no extra re-renders */}
                  <VoiceRecorder
                    onTranscriptReady={handleTranscriptReady}
                    onError={setMicError}
                  />

                  {micError && (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      ⚠️ {micError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            {/* FIX 3: explicit cursor-pointer on submit button only */}
            <Button
              type="submit"
              className="w-full h-14 text-base font-semibold cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Submitting…</>
                : <><Send className="h-5 w-5 mr-2" /> Send Help Request</>}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReportIncident;