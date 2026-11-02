"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navigation4 } from "@/components/navigation/navigation-4";
import { UserMenu } from "@/components/navigation/user-menu";
import { PlayerDock } from "@/components/player/player-dock";
import { GlobalToast } from "@/components/ui/global-toast";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  if (isAuth) {
    return (
      <div className="app-shell app-shell--auth">
        <main className="app-shell__main app-shell__main--auth">{children}</main>
        <PlayerDock />
        <GlobalToast />
      </div>
    );
  }

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
