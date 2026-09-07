import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  console.info("[Auth Callback] Request received", {
    hasCode: Boolean(code),
    next,
    error: errorParam,
    errorCode,
    errorDescription,
  });

  // 1. Check if Supabase passed an explicit error directly in the URL query params
  if (errorParam || errorDescription) {
    console.error("[Auth Callback] Supabase query error:", {
      error: errorParam,
      errorCode,
      errorDescription,
    });

    let userMessage = errorDescription || errorParam || "Could not authenticate.";
    if (errorCode === "otp_expired" || /expired|invalid/i.test(userMessage)) {
      userMessage = "This confirmation link has expired or has already been used. Please try signing in or request a new link.";
    }

    return NextResponse.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(userMessage)}`
    );
  }

  // 2. If an authorization code is present, exchange it for a session
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        console.info("[Auth Callback] Successfully exchanged code for session. Redirecting to:", next);
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Log the full error object for debugging
      console.error("[Auth Callback] exchangeCodeForSession failed:", {
        message: error.message,
        name: error.name,
        status: error.status,
        code: error.code,
        details: error,
      });

      let userMessage = error.message;

      // Detect PKCE code verifier mismatch
      if (/verifier|pkce/i.test(error.message) || error.name === "AuthPKCEGrantCodeExchangeError") {
        userMessage =
          "Could not verify sign-up on this browser. Please open the confirmation link on the same device and browser where you signed up.";
      } else if (/expired|invalid|otp/i.test(error.message)) {
        userMessage =
          "This confirmation link has expired or has already been used. Please try signing in or request a new link.";
      }

      return NextResponse.redirect(
        `${origin}/auth/signin?error=${encodeURIComponent(userMessage)}`
      );
    } catch (err) {
      console.error("[Auth Callback] Unexpected exception during code exchange:", err);
      return NextResponse.redirect(
        `${origin}/auth/signin?error=${encodeURIComponent(
          "An unexpected authentication error occurred. Please try signing in again."
        )}`
      );
    }
  }

  console.warn("[Auth Callback] No code or error provided in URL.");
  return NextResponse.redirect(
    `${origin}/auth/signin?error=${encodeURIComponent("No authentication code was found in the link.")}`
  );
}
