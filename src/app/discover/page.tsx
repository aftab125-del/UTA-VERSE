import { AppShell } from "@/components/shell/app-shell";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";
import { DiscoverPageContent } from "@/components/discover/discover-page-content";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <AppShell>
      <DarkVeilBackground />
      <DiscoverPageContent />
    </AppShell>
  );
}
