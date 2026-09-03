import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";
import { BlurText } from "@/components/reactbits/BlurText";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LibraryContent } from "@/app/library/components/library-content";

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
          <LibraryContent />
        ) : (
          <>
            <div className="empty-panel catalog-state">
              <span className="empty-panel__mark" aria-hidden="true">·</span>
              <h2>Sign in to build your library</h2>
              <p>Liked songs and listening history require an account.</p>
            </div>
            <Link href="/auth/signin" className="auth-cta-link">
              Sign in to get started
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
