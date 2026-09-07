import type { Metadata } from "next";
import { Auth3 } from "@/components/auth/auth-3";

export const metadata: Metadata = {
  title: "Sign In — UTA-VERSE",
  description: "Sign in or create your UTA-VERSE account.",
};

export default function SignInPage() {
  return <Auth3 />;
}
