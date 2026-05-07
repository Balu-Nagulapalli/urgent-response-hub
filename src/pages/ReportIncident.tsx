import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, Mail, MapPin, Phone,
  User, FileText, Send, LocateFixed, Loader2, CheckCircle2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GPSData {
  latitude: string;
  longitude: string;
  accuracy: number;
  fullAddress: string;
}
type GPSStatus = "idle" | "loading" | "success" | "error";

// ─── Schema ───────────────────────────────────────────────────────────────────

const reportSchema = z
  .object({
    fullName:      z.string().trim().min(2, "Full Name is required").max(100),
    email:         z.string().email("Enter a valid email address").max(255),
    contactNumber: z.string().trim().min(10, "Contact Number is required").max(15),
    location:      z.string().min(5, "Please provide a detailed location").max(500),
    emergencyType: z.enum(["medical", "rescue", "fire", "police", "others"]),
    description:   z.string().max(1000),
    latitude:      z.string().optional(),
    longitude:     z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.emergencyType === "others" && !data.description.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Description is required when selecting Others",
      });
    }
  });

type ReportFormData = z.infer<typeof reportSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

const ReportIncident = () => {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsStatus,    setGpsStatus]    = useState<GPSStatus>("idle");
  const [gpsData,      setGpsData]      = useState<GPSData | null>(null);
  const [gpsError,     setGpsError]     = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } =
    useForm<ReportFormData>({ resolver: zodResolver(reportSchema) });

  // ── GPS ───────────────────────────────────────────────────────────────────

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by your browser.");
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    setGpsError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy);

        setValue("latitude",  lat);
        setValue("longitude", lng);

        let fullAddress = `${lat}, ${lng}`;
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const json = await res.json();
          if (json?.display_name) fullAddress = json.display_name;
        } catch { /* fallback to coords */ }

        setValue("location", fullAddress, { shouldValidate: true });
        setGpsData({ latitude: lat, longitude: lng, accuracy: acc, fullAddress });
        setGpsStatus("success");
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Permission denied. Please allow location access.",
          2: "Location unavailable. Check GPS or network.",
          3: "Request timed out. Try again.",
        };
        setGpsError(msgs[err.code] ?? "Could not get location.");
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (data: ReportFormData) => {
    setIsSubmitting(true);

    const SN_INSTANCE = import.meta.env.VITE_SN_INSTANCE;
    const SN_USERNAME = import.meta.env.VITE_SN_USERNAME;
    const SN_PASSWORD = import.meta.env.VITE_SN_PASSWORD;

    // ── WHY no caller_id? ─────────────────────────────────────────────────
    // caller_id is a Reference field in ServiceNow — it only accepts a sys_id
    // (internal user ID), NOT a plain name string. Sending a name would silently
    // fail or error. Instead we put the reporter's name inside short_description
    // and description so it's always visible on the incident form.
    // ─────────────────────────────────────────────────────────────────────

    const isHighPriority = ["medical", "rescue", "fire", "police"].includes(data.emergencyType);

    const payload = {
      // Custom fields — exact column names from ServiceNow incident table
      u_caller_email:  data.email,
      u_caller_phone:  data.contactNumber,
      u_full_address:  data.location,
      u_gps_latitude:  data.latitude  ?? "",
      u_gps_longitude: data.longitude ?? "",

      // Built-in fields
      category:          data.emergencyType,
      short_description: `[${data.emergencyType.toUpperCase()}] Reported by ${data.fullName}`,
      description:
        `Reporter : ${data.fullName}\n` +
        `Phone    : ${data.contactNumber}\n` +
        `Email    : ${data.email}\n` +
        `Location : ${data.location}\n` +
        (data.latitude ? `GPS      : ${data.latitude}, ${data.longitude}\n` : "") +
        `\nDetails  :\n${data.description}`,

      priority:  isHighPriority ? "1" : "3",
      urgency:   isHighPriority ? "1" : "2",
      impact:    "1",
      state:     "1",
    };

    try {
      const res = await fetch(
        `${SN_INSTANCE}/api/now/table/incident`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Accept":        "application/json",
            "Authorization": "Basic " + btoa(`${SN_USERNAME}:${SN_PASSWORD}`),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message ?? `HTTP ${res.status} ${res.statusText}`);
      }

      const json       = await res.json();
      const incidentId = json?.result?.number;
      const sysId      = json?.result?.sys_id;

      if (!incidentId) throw new Error("ServiceNow did not return an incident number.");

      // Save everything for the Status page
      localStorage.setItem("lastIncident", JSON.stringify({
        id:            incidentId,
        sys_id:        sysId,
        fullName:      data.fullName,
        email:         data.email,
        contactNumber: data.contactNumber,
        location:      data.location,
        latitude:      data.latitude  ?? "",
        longitude:     data.longitude ?? "",
        emergencyType: data.emergencyType,
        description:   data.description,
        status:        "pending",
        priority:      isHighPriority ? "high" : "medium",
        submittedAt:   new Date().toISOString(),
      }));

      toast({
        title:       "✅ Help Request Submitted!",
        description: `Incident ${incidentId} created in ServiceNow. Help is on the way.`,
      });

      navigate(`/status?id=${incidentId}`);

    } catch (err: any) {
      toast({
        title: "❌ Submission Failed",
        description: err.message?.includes("fetch")
          ? "Cannot reach ServiceNow. Check CORS rule or network."
          : err.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // always re-enable button — prevents blank UI
    }
  };

  // ── GPS Button ────────────────────────────────────────────────────────────

  const GPSButton = () => {
    if (gpsStatus === "loading")
      return (
        <Button type="button" variant="outline" size="sm" disabled className="gap-2 shrink-0">
          <Loader2 className="h-4 w-4 animate-spin" /> Locating…
        </Button>
      );
    if (gpsStatus === "success")
      return (
        <Button type="button" variant="outline" size="sm" onClick={handleFetchLocation}
          className="gap-2 shrink-0 border-green-500 text-green-700 hover:bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" /> Update GPS
        </Button>
      );
    return (
      <Button type="button" variant="outline" size="sm" onClick={handleFetchLocation}
        className="gap-2 shrink-0">
        <LocateFixed className="h-4 w-4" /> Use GPS
      </Button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="py-8 md:py-12">
        <div className="container max-w-2xl">

          {/* Header */}
          <div className="text-center mb-8">
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

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border space-y-6">

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-base font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input id="fullName" placeholder="Enter your full name"
                  className="h-12 text-base" {...register("fullName")} />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address <span className="text-sm text-muted-foreground font-normal">(for updates)</span>
                </Label>
                <Input id="email" type="email" placeholder="Enter your email"
                  className="h-12 text-base" {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-base font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Contact Number <span className="text-destructive">*</span>
                </Label>
                <Input id="contactNumber" type="tel" placeholder="Enter your phone number"
                  className="h-12 text-base" {...register("contactNumber")} />
                {errors.contactNumber && <p className="text-sm text-destructive">{errors.contactNumber.message}</p>}
              </div>

              {/* Location + GPS */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-base font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2 items-start">
                  <Input id="location" placeholder="Enter address or tap Use GPS →"
                    className="h-12 text-base flex-1" {...register("location")} />
                  <GPSButton />
                </div>
                {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
                {gpsStatus === "error" && <p className="text-sm text-destructive">{gpsError}</p>}
                {gpsStatus === "success" && gpsData && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      GPS captured
                      <span className="ml-auto font-normal text-green-600">±{gpsData.accuracy}m</span>
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
                <Select onValueChange={(v) => setValue("emergencyType", v as ReportFormData["emergencyType"])}>
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
                {errors.emergencyType && <p className="text-sm text-destructive">{errors.emergencyType.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                </Label>
                <Textarea id="description"
                  placeholder="Describe the emergency — people affected, immediate needs, visible dangers..."
                  className="min-h-[150px] text-base resize-none"
                  {...register("description")} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" variant="emergency" size="xl"
              className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</>
                : <><Send className="h-5 w-5" /> Send Help Request</>}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReportIncident;