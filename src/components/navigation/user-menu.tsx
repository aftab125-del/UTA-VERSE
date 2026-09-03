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
      <Link href="/auth/signin" className="user-menu__signin">
        Sign in
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
        <span className="user-menu__name">{displayName}</span>
      </div>
      <button
        className="user-menu__signout"
        type="button"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
}
