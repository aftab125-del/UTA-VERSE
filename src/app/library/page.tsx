import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";
import { BlurText } from "@/components/reactbits/BlurText";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell>
      <DarkVeilBackground />
      <div className="route-content route-content--narrow">
        <p className="eyebrow">Your collection</p>
        <h1 className="route-title">
          <BlurText text="Library" animateBy="words" direction="top" delay={300} stepDuration={0.8} />
        </h1>
        <p className="route-lede">A home for the tracks and collections you choose to keep close.</p>

        {user ? (
          <CatalogState
            title="Your library is empty"
            message="Start exploring and save tracks to build your personal collection. Liked songs and listening history are coming soon."
          />
        ) : (
          <>
            <CatalogState
              title="Sign in to build your library"
              message="Liked songs and listening history require the authentication and account-data phase."
            />
            <Link href="/auth/signin" className="auth-cta-link">
              Sign in to get started
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
