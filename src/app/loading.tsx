import { CatalogState } from "@/components/catalog/catalog-state";

export default function Loading() {
  return (
    <div className="route-content">
      <CatalogState tone="loading" title="Tuning the signal" message="Loading the UTA-VERSE catalog…" />
    </div>
  );
}
