import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return <AppShell><div className="route-content"><CatalogState tone="loading" title="Tuning the signal" message="Loading the UTA-VERSE catalog…" /></div></AppShell>;
}
