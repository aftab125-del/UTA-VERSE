import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UTA-VERSE",
  description: "A universe of music.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
