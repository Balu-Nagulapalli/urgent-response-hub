import { Phone } from "lucide-react";

const EmergencyBanner = () => {
  return (
    <div className="bg-primary text-primary-foreground py-3 px-4 emergency-pulse">
      <div className="container flex items-center justify-center gap-3 text-center">
        <Phone className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold text-sm sm:text-base">
          Emergency Helpline:{" "}
          <a 
            href="tel:1800-123-4567" 
            className="underline underline-offset-2 hover:no-underline font-bold"
            aria-label="Call emergency helpline 1800-123-4567"
          >
            1800-123-4567
          </a>
          <span className="hidden sm:inline"> (24/7 Available)</span>
        </span>
      </div>
    </div>
  );
};

export default EmergencyBanner;
