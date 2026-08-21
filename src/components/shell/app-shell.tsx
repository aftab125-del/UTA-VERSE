import type { ReactNode } from "react";
import Link from "next/link";
import { PrimaryNavigation } from "@/components/navigation/primary-navigation";
import { PlayerDock } from "@/components/player/player-dock";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <Link className="brand-mark" href="/" aria-label="UTA-VERSE home">
          <span className="brand-mark__eyebrow">A universe of</span>
          <span className="brand-mark__name">UTA-VERSE</span>
        </Link>
        <PrimaryNavigation />
        <div className="sidebar-footer">A universe of music.</div>
      </aside>

      <header className="app-shell__mobile-header">
        <Link className="brand-mark" href="/" aria-label="UTA-VERSE home">
          <span className="brand-mark__eyebrow">A universe of</span>
          <span className="brand-mark__name">UTA-VERSE</span>
        </Link>
        <span className="status-dot" aria-label="Online" />
      </header>

      <main className="app-shell__main">{children}</main>
      <PlayerDock />
    </div>
  );
}
