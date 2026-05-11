import { ReactNode } from "react";
import EmergencyBanner from "./EmergencyBanner";
import Header from "./Header";
import Footer from "./Footer";
import PanicButton from "./PanicButton";

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

      {/* ── Floating panic pill (Option A) ──────────────────────────────────
          Shown on every page EXCEPT Home (which has its own hero version).
          Rendered outside <main> so it floats above all content safely.
      ─────────────────────────────────────────────────────────────────────── */}
      {!hidePanicFloat && <PanicButton variant="floating" />}
    </div>
  );
};

export default Layout;