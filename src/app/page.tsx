import { AppShell } from "@/components/shell/app-shell";
import { BallpitBackground } from "@/components/visual/ballpit-background";

export default function HomePage() {
  return (
    <AppShell>
      <section className="home-stage" aria-labelledby="home-heading">
        <BallpitBackground />
        <div className="home-stage__veil" aria-hidden="true" />

        <div className="home-stage__content">
          <p className="eyebrow">The signal is forming</p>
          <h1 id="home-heading">Find your place in the sound.</h1>
          <p className="home-stage__lede">
            UTA-VERSE is a cinematic space for listening, discovery, and the music
            that stays with you.
          </p>
          <div className="home-stage__rule" aria-hidden="true" />
          <p className="home-stage__note">The universe is coming into focus.</p>
        </div>
      </section>
    </AppShell>
  );
}
