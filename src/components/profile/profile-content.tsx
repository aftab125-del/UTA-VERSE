"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getUserAllTimeStats, type UserAllTimeStats } from "@/lib/music/stats";
import { Stats14Card } from "@/components/dashboard/stats-14-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarCropModal } from "@/components/profile/avatar-crop-modal";
import "./profile.css";

export function ProfileContent() {
  const { user, profile, avatarUrl, displayName, loading: userLoading, refreshProfile } = useUser();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<UserAllTimeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Avatar Crop & Upload State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

  // Edit Name State
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Synchronize display name input with resolved displayName
  useEffect(() => {
    if (displayName) {
      setDisplayNameInput(displayName);
    }
  }, [displayName]);

  // Fetch All-Time Stats asynchronously
  useEffect(() => {
    if (!user) {
      setStats(null);
      setStatsLoading(false);
      return;
    }

    const activeUser = user;
    let isMounted = true;

    async function loadStats() {
      try {
        const allTimeStats = await getUserAllTimeStats(
          activeUser.id,
          profile?.created_at || activeUser.created_at,
          supabase
        );

        if (isMounted) {
          setStats(allTimeStats);
          setStatsLoading(false);
        }
      } catch (err) {
        console.warn("[Profile] Failed to load all-time stats:", err);
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [user, profile?.created_at, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function handleAvatarClick() {
    if (avatarUploading) return;
    fileInputRef.current?.click();
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = "";

    // 1. Validate file type before opening crop modal
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validMimeTypes.includes(file.type)) {
      setAvatarError("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    // 2. Validate file size before opening crop modal (max 5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setAvatarError("Avatar image must be under 5MB.");
      return;
    }

    setAvatarError(null);
    setAvatarSuccess(null);

    // Create object URL for cropping preview
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setIsCropModalOpen(true);
  }

  function handleCropModalClose() {
    setIsCropModalOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  }

  async function handleCropSave(croppedBlob: Blob) {
    if (!user) return;

    setAvatarUploading(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const filePath = `${user.id}/avatar-${Date.now()}.webp`;

      // 1. Upload cropped WebP to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Update profiles table (single source of truth)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            avatar_url: publicUrl,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        throw profileError;
      }

      // 4. Broadcast event for instant synchronization across all components
      window.dispatchEvent(
        new CustomEvent("uta-profile-updated", {
          detail: { avatar_url: publicUrl },
        })
      );

      await refreshProfile();
      setAvatarSuccess("Avatar cropped and updated successfully.");
    } catch (err) {
      console.error("[Profile] Avatar upload failed:", err);
      setAvatarError(
        err instanceof Error ? err.message : "Failed to upload avatar. Please try again."
      );
    } finally {
      setAvatarUploading(false);
      handleCropModalClose();
    }
  }

  async function handleResetToGooglePhoto() {
    if (!user) return;
    setAvatarUploading(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      // Clear custom avatar_url from profiles so it falls back to OAuth picture
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            avatar_url: null,
          },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;

      window.dispatchEvent(
        new CustomEvent("uta-profile-updated", {
          detail: { avatar_url: null },
        })
      );

      await refreshProfile();
      setAvatarSuccess("Restored your original Google profile photo.");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to reset avatar.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleUpdateDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      setNameError("Display name cannot be empty.");
      return;
    }

    setNameSaving(true);
    setNameError(null);
    setNameSuccess(null);

    try {
      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            display_name: trimmed,
          },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;

      // 2. Update Supabase Auth metadata
      await supabase.auth.updateUser({
        data: {
          display_name: trimmed,
          full_name: trimmed,
          name: trimmed,
        },
      });

      // Broadcast instant update
      window.dispatchEvent(
        new CustomEvent("uta-profile-updated", {
          detail: { display_name: trimmed },
        })
      );

      await refreshProfile();
      setNameSuccess("Display name updated successfully.");
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update display name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordSuccess("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (userLoading) {
    return (
      <div className="profile-page">
        <div className="user-menu--loading" style={{ margin: "4rem auto", width: "4rem", height: "4rem" }} />
      </div>
    );
  }

  // Guest / Logged-out State
  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-guest-card">
          <div className="profile-guest-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="profile-guest-title">Identify in the UTA-VERSE</h1>
          <p className="profile-guest-desc">
            Sign in to view your all-time sonic telemetry, account credentials, listening orbit, and profile settings.
          </p>
          <Link href="/auth/signin" className="profile-guest-cta">
            <span>Sign In to Your Account</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }

  const memberSinceFormatted =
    stats?.memberSinceFormatted ||
    new Date(profile?.created_at || user.created_at || Date.now()).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const hasGooglePhoto = Boolean(user.user_metadata?.avatar_url || user.user_metadata?.picture);
  const hasCustomProfileAvatar = Boolean(profile?.avatar_url);

  return (
    <div className="profile-page">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        style={{ display: "none" }}
        onChange={handleAvatarFileChange}
      />

      {/* Image Cropping Modal */}
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          isOpen={isCropModalOpen}
          onClose={handleCropModalClose}
          onCropComplete={handleCropSave}
        />
      )}

      {/* 1. Identity Header */}
      <header className="profile-hero">
        <div className="profile-hero__identity">
          <div
            className="profile-hero__avatar-box"
            onClick={handleAvatarClick}
            role="button"
            tabIndex={0}
            aria-label="Change profile picture"
            title="Click to change profile photo"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAvatarClick();
              }
            }}
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              displayName={displayName}
              className="profile-hero__avatar"
            />

            {/* Hover overlay for changing photo */}
            <div className="profile-hero__avatar-overlay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Change</span>
            </div>

            {/* Uploading Spinner */}
            {avatarUploading && (
              <div className="profile-hero__avatar-spinner" aria-label="Uploading avatar...">
                <div className="user-menu--loading" style={{ width: "2rem", height: "2rem", borderRadius: "50%" }} />
              </div>
            )}
          </div>

          <div className="profile-hero__meta">
            <div className="profile-hero__badge">
              <span aria-hidden="true">✦</span>
              <span>Verified Orbit</span>
            </div>
            <h1 className="profile-hero__name">{displayName}</h1>
            <div className="profile-hero__details">
              <span className="profile-hero__detail-item" title="Authenticated Email">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>{user.email}</span>
              </span>
              <span className="profile-hero__detail-item" title="Member Since Date">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Member since {memberSinceFormatted}</span>
              </span>
            </div>

            {/* Feedback & Google Reset Option */}
            {avatarError && (
              <div className="profile-alert profile-alert--error" style={{ marginTop: "0.5rem" }} role="alert">
                {avatarError}
              </div>
            )}
            {avatarSuccess && (
              <div className="profile-alert profile-alert--success" style={{ marginTop: "0.5rem" }} role="status">
                {avatarSuccess}
              </div>
            )}

            {hasGooglePhoto && hasCustomProfileAvatar && (
              <button
                type="button"
                className="profile-hero__avatar-reset"
                onClick={handleResetToGooglePhoto}
                disabled={avatarUploading}
              >
                Reset to Google photo
              </button>
            )}
          </div>
        </div>

        <div className="profile-hero__actions">
          <button
            type="button"
            className="profile-btn-danger"
            onClick={handleSignOut}
            title="Sign out of UTA-VERSE"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* 2. All-Time Stats Section */}
      <section className="profile-stats-section" aria-labelledby="alltime-stats-heading">
        <div className="profile-section-header">
          <div className="profile-section-header__title">
            <p className="profile-section-header__eyebrow">Lifetime Orbit</p>
            <h2 id="alltime-stats-heading" className="profile-section-header__heading">
              All-Time Sonic Telemetry
            </h2>
          </div>
        </div>

        <div className="profile-stats-grid">
          {statsLoading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="stats14-card" style={{ height: "160px", opacity: 0.6 }}>
                  <div className="user-menu--loading" style={{ width: "100%", height: "100%", borderRadius: "1.25rem" }} />
                </div>
              ))
            : stats?.items.map((stat) => (
                <Stats14Card key={stat.id} stat={stat} />
              ))}
        </div>
      </section>

      {/* 3. Account Actions Grid */}
      <section className="profile-actions-section" aria-labelledby="account-settings-heading">
        <div className="profile-section-header">
          <div className="profile-section-header__title">
            <p className="profile-section-header__eyebrow">Credentials & Identity</p>
            <h2 id="account-settings-heading" className="profile-section-header__heading">
              Account Settings
            </h2>
          </div>
        </div>

        <div className="profile-actions-grid">
          {/* Form 1: Edit Display Name */}
          <div className="profile-card">
            <div className="profile-card__header">
              <h3 className="profile-card__title">Display Name</h3>
              <p className="profile-card__desc">
                Your public identity across playlists, favorites, and community listening.
              </p>
            </div>

            {nameError && (
              <div className="profile-alert profile-alert--error" role="alert">
                {nameError}
              </div>
            )}
            {nameSuccess && (
              <div className="profile-alert profile-alert--success" role="status">
                {nameSuccess}
              </div>
            )}

            <form className="profile-form" onSubmit={handleUpdateDisplayName}>
              <div className="profile-field">
                <label htmlFor="profile-display-name" className="profile-label">
                  Public Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  maxLength={50}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your display name"
                  className="profile-input"
                />
              </div>

              <button
                type="submit"
                className="profile-btn-primary"
                disabled={nameSaving || displayNameInput.trim() === displayName}
              >
                {nameSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Form 2: Change Password */}
          <div className="profile-card">
            <div className="profile-card__header">
              <h3 className="profile-card__title">Change Password</h3>
              <p className="profile-card__desc">
                Update your account password with at least 6 characters.
              </p>
            </div>

            {passwordError && (
              <div className="profile-alert profile-alert--error" role="alert">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="profile-alert profile-alert--success" role="status">
                {passwordSuccess}
              </div>
            )}

            <form className="profile-form" onSubmit={handleChangePassword}>
              <div className="profile-field">
                <label htmlFor="profile-new-password" className="profile-label">
                  New Password
                </label>
                <input
                  id="profile-new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="profile-input"
                  autoComplete="new-password"
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-confirm-password" className="profile-label">
                  Confirm New Password
                </label>
                <input
                  id="profile-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="profile-input"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="profile-btn-primary"
                disabled={passwordSaving || !newPassword || !confirmPassword}
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
