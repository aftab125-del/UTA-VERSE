"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import "./Auth3.css";

export type AuthMode = "signin" | "signup";

export interface Auth3Props {
  initialMode?: AuthMode;
  onSuccessRedirect?: string;
}

export function Auth3({ initialMode = "signin", onSuccessRedirect = "/" }: Auth3Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error_description") || searchParams.get("error");

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccessMessage(
            "Check your email for a confirmation link to complete sign up. Open the confirmation link on this same device/browser to complete sign-up."
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
        } else {
          router.push(onSuccessRedirect);
          router.refresh();
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <div className="auth3-wrapper">
      <div className="auth3-container">
        {/* Left Card: Frosted Glass Auth Box */}
        <div className="auth3-card">
          <div className="auth3-header">
            <h1 className="auth3-title">
              {isSignIn ? "Sign in" : "Create an account"}
            </h1>
            <div className="auth3-subtitle">
              <span>{isSignIn ? "New user?" : "Already have an account?"}</span>
              <button
                type="button"
                className="auth3-toggle-btn"
                onClick={() => {
                  setMode(isSignIn ? "signup" : "signin");
                  setError(null);
                  setSuccessMessage(null);
                }}
              >
                {isSignIn ? "Create an account" : "Sign in"}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth3-alert auth3-alert--error" role="alert">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="auth3-alert auth3-alert--success" role="status">
              {successMessage}
            </div>
          )}

          <form className="auth3-form" onSubmit={handleSubmit}>
            <div className="auth3-field">
              <label htmlFor="auth3-email" className="auth3-label">
                Email address
              </label>
              <input
                id="auth3-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="auth3-input"
              />
            </div>

            <div className="auth3-field">
              <label htmlFor="auth3-password" className="auth3-label">
                Password
              </label>
              <input
                id="auth3-password"
                type="password"
                required
                minLength={6}
                autoComplete={isSignIn ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 6 chars)"
                className="auth3-input"
              />
            </div>

            <button
              type="submit"
              className="auth3-btn-primary"
              disabled={loading}
            >
              {loading
                ? isSignIn
                  ? "Signing in..."
                  : "Creating account..."
                : "Continue"}
            </button>
          </form>

          <div className="auth3-divider" role="separator">
            <span>Or</span>
          </div>

          <div className="auth3-socials">
            <button
              type="button"
              className="auth3-btn-social"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>

        {/* Right Floating Brand Section */}
        <div className="auth3-brand-section">
          <Link href="/" className="auth3-brand-header" aria-label="UTA-VERSE home">
            <div className="auth3-brand-orb" aria-hidden="true" />
            <div className="auth3-brand-text-block">
              <span className="auth3-brand-eyebrow">A universe of</span>
              <span className="auth3-brand-name">UTA-VERSE</span>
            </div>
          </Link>
          <p className="auth3-brand-tagline">
            A cinematic space for listening, discovery, and the music that stays with you.
          </p>
          <span className="auth3-brand-credit">Made by Aftab Kathat</span>
        </div>
      </div>
    </div>
  );
}
