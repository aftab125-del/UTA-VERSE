import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { ProfileContent } from "@/components/profile/profile-content";

export const metadata: Metadata = {
  title: "Profile — UTA-VERSE",
  description: "Your UTA-VERSE account identity and all-time listening telemetry.",
};

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}
