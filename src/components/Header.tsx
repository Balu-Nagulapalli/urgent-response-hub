import { Link, useLocation } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            aria-label="Disaster Response Home"
          >
            <div className="bg-primary p-2 rounded-lg">
              <Shield className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg leading-tight text-foreground">Disaster Response</h1>
              <p className="text-xs text-muted-foreground">Emergency Services Portal</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Main navigation">
            <Link to="/">
              <Button 
                variant={isActive("/") ? "secondary" : "ghost"} 
                size="sm"
              >
                Home
              </Button>
            </Link>
            <Link to="/report">
              <Button 
                variant={isActive("/report") ? "secondary" : "ghost"} 
                size="sm"
              >
                Report Incident
              </Button>
            </Link>
            <Link to="/status">
              <Button 
                variant={isActive("/status") ? "secondary" : "ghost"} 
                size="sm"
              >
                Track Status
              </Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav 
            className="md:hidden pt-4 pb-2 space-y-2 animate-fade-in" 
            aria-label="Mobile navigation"
          >
            <Link to="/" onClick={() => setIsMenuOpen(false)}>
              <Button 
                variant={isActive("/") ? "secondary" : "ghost"} 
                className="w-full justify-start"
              >
                Home
              </Button>
            </Link>
            <Link to="/report" onClick={() => setIsMenuOpen(false)}>
              <Button 
                variant={isActive("/report") ? "secondary" : "ghost"} 
                className="w-full justify-start"
              >
                Report Incident
              </Button>
            </Link>
            <Link to="/status" onClick={() => setIsMenuOpen(false)}>
              <Button 
                variant={isActive("/status") ? "secondary" : "ghost"} 
                className="w-full justify-start"
              >
                Track Status
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
