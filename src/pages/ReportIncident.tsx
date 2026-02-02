import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, MapPin, Phone, User, FileText, Send } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const reportSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  contactNumber: z.string().min(10, "Enter a valid phone number").max(15),
  location: z.string().min(5, "Please provide a detailed location").max(200),
  emergencyType: z.enum(["medical", "rescue", "food", "shelter"]),
  description: z.string().min(10, "Please describe the situation").max(1000),
});

type ReportFormData = z.infer<typeof reportSchema>;

const ReportIncident = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
  });

  const onSubmit = async (data: ReportFormData) => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Generate a mock incident ID
    const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
    
    // Store in localStorage for demo
    localStorage.setItem("lastIncident", JSON.stringify({
      id: incidentId,
      ...data,
      status: "pending",
      priority: data.emergencyType === "medical" || data.emergencyType === "rescue" ? "high" : "medium",
      submittedAt: new Date().toISOString(),
    }));

    toast({
      title: "Help Request Submitted",
      description: `Your incident ID is ${incidentId}. Help is on the way.`,
    });

    navigate(`/status?id=${incidentId}`);
  };

  return (
    <Layout>
      <div className="py-8 md:py-12">
        <div className="container max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Emergency Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Report an Incident
            </h1>
            <p className="text-muted-foreground">
              Fill in the details below. All fields are required.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-base font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  className="h-12 text-base"
                  {...register("fullName")}
                  aria-describedby={errors.fullName ? "fullName-error" : undefined}
                />
                {errors.fullName && (
                  <p id="fullName-error" className="text-sm text-destructive">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Contact Number */}
              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-base font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  type="tel"
                  placeholder="Enter your phone number"
                  className="h-12 text-base"
                  {...register("contactNumber")}
                  aria-describedby={errors.contactNumber ? "contactNumber-error" : undefined}
                />
                {errors.contactNumber && (
                  <p id="contactNumber-error" className="text-sm text-destructive">
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-base font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Location
                </Label>
                <Input
                  id="location"
                  placeholder="Enter address or landmark"
                  className="h-12 text-base"
                  {...register("location")}
                  aria-describedby={errors.location ? "location-error" : undefined}
                />
                {errors.location && (
                  <p id="location-error" className="text-sm text-destructive">
                    {errors.location.message}
                  </p>
                )}
              </div>

              {/* Emergency Type */}
              <div className="space-y-2">
                <Label htmlFor="emergencyType" className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Type of Emergency
                </Label>
                <Select onValueChange={(value) => setValue("emergencyType", value as any)}>
                  <SelectTrigger id="emergencyType" className="h-12 text-base">
                    <SelectValue placeholder="Select emergency type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical" className="text-base py-3">
                      🏥 Medical Emergency
                    </SelectItem>
                    <SelectItem value="rescue" className="text-base py-3">
                      🚨 Rescue Operation
                    </SelectItem>
                    <SelectItem value="food" className="text-base py-3">
                      🍞 Food Assistance
                    </SelectItem>
                    <SelectItem value="shelter" className="text-base py-3">
                      🏠 Shelter Required
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.emergencyType && (
                  <p className="text-sm text-destructive">
                    {errors.emergencyType.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the emergency situation, number of people affected, and any immediate needs..."
                  className="min-h-[150px] text-base resize-none"
                  {...register("description")}
                  aria-describedby={errors.description ? "description-error" : undefined}
                />
                {errors.description && (
                  <p id="description-error" className="text-sm text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="emergency"
              size="xl"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" aria-hidden="true" />
                  Send Help Request
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReportIncident;
