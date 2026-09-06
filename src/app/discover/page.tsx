import { AppShell } from "@/components/shell/app-shell";
import { DiscoverPageContent } from "@/components/discover/discover-page-content";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <AppShell>
      <DiscoverPageContent />
    </AppShell>
  );
}
