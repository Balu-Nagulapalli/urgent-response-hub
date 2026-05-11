import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search, Users, Clock, ShieldCheck } from "lucide-react";
import Layout from "@/components/Layout";
import PanicButton from "@/components/PanicButton";

const Home = () => {
  return (
    <Layout hidePanicFloat>  {/* hidePanicFloat → suppress floating pill on Home */}
      {/* Hero Section */}
      <section className="py-12 md:py-20 px-4">
        <div className="container max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">Official Emergency Portal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Disaster Help &<br className="hidden sm:block" /> Emergency Response
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Report emergencies quickly and get the help you need.
            Our response teams are available 24/7.
          </p>

          {/* ── PANIC BUTTON — Hero (Option C) ── */}
          {/* Sits above the regular buttons, full-width on mobile */}
          <div className="flex flex-col items-center gap-4 mb-2">
            <PanicButton variant="hero" />

            <p className="text-xs text-muted-foreground">
              Tap once — we'll grab your location and alert the nearest team instantly.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Existing buttons — untouched */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/report">
              <Button variant="emergency" size="xl" className="w-full sm:w-auto">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                Report an Emergency
              </Button>
            </Link>
            <Link to="/status">
              <Button variant="track" size="xl" className="w-full sm:w-auto">
                <Search className="h-6 w-6" aria-hidden="true" />
                Track My Request
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Info Cards — untouched */}
      <section className="py-12 bg-muted/50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="bg-secondary/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-secondary" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Quick Reporting</h3>
              <p className="text-muted-foreground text-sm">
                Submit emergency reports in under 2 minutes. Simple forms designed for urgent situations.
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="bg-accent/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-accent" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Real-Time Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Monitor your request status with live updates. Know exactly when help is on the way.
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="bg-primary/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Coordinated Response</h3>
              <p className="text-muted-foreground text-sm">
                Multiple agencies working together to provide comprehensive emergency assistance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Types — untouched */}
      <section className="py-12">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            We Respond To
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Medical", icon: "🏥" },
              { label: "Rescue", icon: "🚨" },
              { label: "Food Aid", icon: "🍞" },
              { label: "Shelter", icon: "🏠" },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors"
              >
                <span className="text-4xl mb-3 block" aria-hidden="true">{item.icon}</span>
                <span className="font-semibold text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;