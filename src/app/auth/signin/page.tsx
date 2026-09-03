import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = {
  title: "Sign In — UTA-VERSE",
};

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <Link className="brand-mark" href="/" aria-label="UTA-VERSE home">
          <span className="brand-mark__eyebrow">A universe of</span>
          <span className="brand-mark__name">UTA-VERSE</span>
        </Link>
        <h1 className="auth-page__heading">Welcome back</h1>
        <p className="auth-page__lede">
          Sign in to access your library and playlists.
        </p>
        <AuthForm />
      </div>
    </div>
  );
}
