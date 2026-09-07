"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  display_name?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, created_at")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          setProfile(data);
          return data;
        }
      } catch (err) {
        console.warn("[useUser] Profile lookup failed:", err);
      }
      return null;
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const authUser = data.user;
      setUser(authUser);

      if (authUser) {
        await fetchProfile(authUser.id);
      } else {
        setProfile(null);
      }

      if (mounted) setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        await fetchProfile(authUser.id);
      } else {
        setProfile(null);
      }

      if (mounted) setLoading(false);
    });

    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ avatar_url?: string; display_name?: string }>;
      if (customEvent.detail) {
        setProfile((prev) => ({
          ...prev,
          ...(customEvent.detail.avatar_url !== undefined && { avatar_url: customEvent.detail.avatar_url }),
          ...(customEvent.detail.display_name !== undefined && { display_name: customEvent.detail.display_name }),
        }));
      }
    };

    window.addEventListener("uta-profile-updated", handleProfileUpdated);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("uta-profile-updated", handleProfileUpdated);
    };
  }, [supabase, fetchProfile]);

  // Single Source of Truth for App-wide Avatar and Display Name
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "User";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  return {
    user,
    profile,
    avatarUrl,
    displayName,
    initials,
    loading,
    refreshProfile,
  };
}
