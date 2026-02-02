import { Shield, Phone, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-3">
            <div className="bg-primary p-2 rounded-lg flex-shrink-0">
              <Shield className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Disaster Response</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Emergency Services Portal
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-3">Emergency Contacts</h4>
            <div className="space-y-2">
              <a 
                href="tel:1800-123-4567" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                1800-123-4567
              </a>
              <a 
                href="mailto:help@disaster-response.gov" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                help@disaster-response.gov
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Safety Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Resource Centers
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Volunteer Registration
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Disaster Response Portal. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
