import type { ReactNode } from "react";
import { Navigation4 } from "@/components/navigation/navigation-4";
import { UserMenu } from "@/components/navigation/user-menu";
import { PlayerDock } from "@/components/player/player-dock";
import { GlobalToast } from "@/components/ui/global-toast";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Navigation4 />

      <header className="app-shell__top-bar">
        <UserMenu />
      </header>

      <main className="app-shell__main">{children}</main>
      <PlayerDock />
      <GlobalToast />
    </div>
  );
}

