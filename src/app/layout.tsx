import type { Metadata } from "next";
import "./globals.css";
import { Agentation } from "agentation";
import { RouteBackground } from "@/components/visual/route-background";
import { PageBackground } from "@/components/PageBackground";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "UTA-VERSE",
  description: "A universe of music.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RouteBackground />
        <PageBackground />
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === "development" && <Agentation endpoint="http://localhost:4747" />}
      </body>
    </html>
  );
}
