import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><div className="route-content route-content--narrow"><Link className="back-link" href="/discover">← Back to Discover</Link><p className="eyebrow">Artist signal</p><h1 className="route-title">{formatLabel(id)}</h1><p className="route-lede">Artist detail is reserved for the approved catalog data layer.</p></div></AppShell>;
}

function formatLabel(value: string) {
  return value.replace(/^artist-/, "").replaceAll("-", " ");
}
