import type { Metadata } from "next";
import "./globals.css";
import { Agentation } from "agentation";
import { RouteBackground } from "@/components/visual/route-background";

export const metadata: Metadata = {
  title: "UTA-VERSE",
  description: "A universe of music.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RouteBackground />
        {children}
        {process.env.NODE_ENV === "development" && <Agentation endpoint="http://localhost:4747" />}
      </body>
    </html>
  );
}