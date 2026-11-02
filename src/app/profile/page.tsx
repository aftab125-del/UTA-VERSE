import type { Metadata } from "next";
import { ProfileContent } from "@/components/profile/profile-content";

export const metadata: Metadata = {
  title: "Profile — UTA-VERSE",
  description: "Your UTA-VERSE account identity and all-time listening telemetry.",
};

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return <ProfileContent />;
}
