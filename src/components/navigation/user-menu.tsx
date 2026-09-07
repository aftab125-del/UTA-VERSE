"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { UserAvatar } from "@/components/ui/user-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function UserMenu() {
  const { user, avatarUrl, displayName, loading } = useUser();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

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

  return (
    <div className="user-menu">
      <div className="user-menu__identity">
        <Link href="/profile" className="user-menu__profile-link" title="View Profile">
          <UserAvatar
            avatarUrl={avatarUrl}
            displayName={displayName}
            className="user-menu__avatar"
          />
          <span className="user-menu__name" title={displayName}>
            {displayName}
          </span>
        </Link>
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
