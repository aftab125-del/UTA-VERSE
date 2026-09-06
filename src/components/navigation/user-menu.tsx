"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  if (loading) {
    return <div className="user-menu user-menu--loading" />;
  }

  if (!user) {
    return (
      <Link href="/auth/signin" className="user-menu__signin" aria-label="Sign in">
        <span>Sign in</span>
        <span aria-hidden="true">→</span>
      </Link>
    );
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "User";
  const avatarUrl: string | undefined =
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="user-menu">
      <div className="user-menu__identity">
        {avatarUrl ? (
          <img
            className="user-menu__avatar"
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
          />
        ) : (
          <span className="user-menu__avatar user-menu__avatar--initials" aria-hidden="true">
            {initials}
          </span>
        )}
        <span className="user-menu__name" title={displayName}>{displayName}</span>
        <button
          className="user-menu__signout"
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
