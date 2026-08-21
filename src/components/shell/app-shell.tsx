import type { ReactNode } from "react";
import Link from "next/link";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <Link className="brand-mark" href="/" aria-label="UTA-VERSE home">
          <span className="brand-mark__eyebrow">A universe of</span>
          <span className="brand-mark__name">UTA-VERSE</span>
        </Link>
        <div className="app-shell__status" aria-label="Current area">
          <span className="status-dot" aria-hidden="true" />
          <span>Home</span>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>

      <div className="app-shell__player-reserve" aria-hidden="true" />
    </div>
  );
}
