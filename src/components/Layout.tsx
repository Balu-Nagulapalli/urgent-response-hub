import { ReactNode } from "react";
import EmergencyBanner from "./EmergencyBanner";
import Header from "./Header";
import Footer from "./Footer";
import PanicButton from "./PanicButton";
import VoiceWidget from "./VoiceWidget";

interface LayoutProps {
  children: ReactNode;
  /**
   * Pass hidePanicFloat on pages that already show a hero panic button
   * (e.g. Home page) so we don't get two panic buttons at once.
   */
  hidePanicFloat?: boolean;
}

const Layout = ({ children, hidePanicFloat = false }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EmergencyBanner />
      <Header />

      <main className="flex-1">
        {children}
      </main>

      <Footer />

      {/* ── Floating panic pill — bottom-CENTER (Option A) ──────────────────
          Hidden on Home page which has its own hero version               */}
      {!hidePanicFloat && <PanicButton variant="floating" />}

      {/* ── Voice widget — bottom-RIGHT, all pages ──────────────────────────
          Sits at right-6, panic pill sits at center — no overlap           */}
      <VoiceWidget />
    </div>
  );
};

export default Layout;