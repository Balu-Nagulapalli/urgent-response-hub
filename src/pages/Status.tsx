import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Clock, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface IncidentData {
  id: string;
  fullName: string;
  emergencyType: string;
  location: string;
  status: "pending" | "active" | "resolved";
  priority: "low" | "medium" | "high";
  submittedAt: string;
}

const emergencyTypeLabels: Record<string, string> = {
  medical: "Medical Emergency",
  rescue: "Rescue Operation",
  food: "Food Assistance",
  shelter: "Shelter Required",
};

const statusConfig = {
  pending: {
    label: "Request Received",
    color: "bg-status-pending",
    icon: Clock,
  },
  active: {
    label: "Help On The Way",
    color: "bg-status-active",
    icon: AlertTriangle,
  },
  resolved: {
    label: "Resolved",
    color: "bg-status-resolved",
    icon: CheckCircle,
  },
};

const priorityLabels: Record<string, { label: string; class: string }> = {
  high: { label: "High Priority", class: "bg-primary/10 text-primary" },
  medium: { label: "Medium Priority", class: "bg-secondary/10 text-secondary" },
  low: { label: "Standard", class: "bg-muted text-muted-foreground" },
};

const Status = () => {
  const [searchParams] = useSearchParams();
  const [incidentId, setIncidentId] = useState(searchParams.get("id") || "");
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      handleSearch(id);
    }
  }, [searchParams]);

  const handleSearch = async (id?: string) => {
    const searchId = id || incidentId;
    if (!searchId.trim()) return;

    setIsSearching(true);
    setNotFound(false);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Check localStorage for demo
    const stored = localStorage.getItem("lastIncident");
    if (stored) {
      const data = JSON.parse(stored);
      if (data.id === searchId) {
        setIncident(data);
        setIsSearching(false);
        return;
      }
    }

    setNotFound(true);
    setIncident(null);
    setIsSearching(false);
  };

  const timelineSteps = [
    { status: "pending", label: "Request Received", description: "Your request has been logged" },
    { status: "active", label: "Help Dispatched", description: "Response team on the way" },
    { status: "resolved", label: "Resolved", description: "Assistance provided" },
  ];

  const currentStepIndex = incident
    ? timelineSteps.findIndex((step) => step.status === incident.status)
    : -1;

  return (
    <Layout>
      <div className="py-8 md:py-12">
        <div className="container max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full mb-4">
              <Search className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Track Request</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Track Your Request
            </h1>
            <p className="text-muted-foreground">
              Enter your Incident ID to check the status
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="incidentId" className="sr-only">
                  Incident ID
                </Label>
                <Input
                  id="incidentId"
                  placeholder="Enter Incident ID (e.g., INC-ABC123)"
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
                {isSearching ? (
                  <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                Search
              </Button>
            </div>
          </div>

          {/* Not Found State */}
          {notFound && (
            <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
              <div className="text-muted-foreground mb-4">
                <Search className="h-12 w-12 mx-auto opacity-50" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Incident Not Found
              </h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find an incident with ID "{incidentId}". Please check and try again.
              </p>
              <Link to="/report">
                <Button variant="outline">Report a New Incident</Button>
              </Link>
            </div>
          )}

          {/* Incident Details */}
          {incident && (
            <div className="space-y-6 animate-fade-in">
              {/* Status Card */}
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Incident ID</p>
                    <p className="font-mono font-bold text-lg text-foreground">
                      {incident.id}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      priorityLabels[incident.priority].class
                    }`}
                  >
                    {priorityLabels[incident.priority].label}
                  </span>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg mb-4">
                  <div
                    className={`status-dot ${statusConfig[incident.status].color}`}
                  />
                  <div>
                    <p className="font-semibold text-foreground">
                      {statusConfig[incident.status].label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {emergencyTypeLabels[incident.emergencyType]}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Reported By</p>
                    <p className="font-medium text-foreground">{incident.fullName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">{incident.location}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                <h3 className="font-semibold text-foreground mb-6">Progress Timeline</h3>
                <div className="space-y-6">
                  {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const StatusIcon = statusConfig[step.status as keyof typeof statusConfig].icon;

                    return (
                      <div key={step.status} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? statusConfig[step.status as keyof typeof statusConfig].color
                                : "bg-muted"
                            } ${isCurrent ? "ring-4 ring-offset-2 ring-offset-card ring-primary/20" : ""}`}
                          >
                            <StatusIcon
                              className={`h-5 w-5 ${
                                isCompleted ? "text-white" : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          {index < timelineSteps.length - 1 && (
                            <div
                              className={`w-0.5 h-8 mt-2 ${
                                isCompleted && index < currentStepIndex
                                  ? "bg-accent"
                                  : "bg-border"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pt-2">
                          <p
                            className={`font-medium ${
                              isCompleted ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Back Button */}
              <Link to="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          )}

          {/* Empty State */}
          {!incident && !notFound && !searchParams.get("id") && (
            <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
              <div className="text-muted-foreground mb-4">
                <Clock className="h-12 w-12 mx-auto opacity-50" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Enter Your Incident ID
              </h3>
              <p className="text-muted-foreground">
                Use the search box above to track the status of your emergency request.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Status;
