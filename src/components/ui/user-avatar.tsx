"use client";

import { useState, useEffect } from "react";

export interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string;
  size?: number | string;
  className?: string;
  alt?: string;
}

export function UserAvatar({
  avatarUrl,
  displayName = "User",
  size,
  className = "",
  alt,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const style = size ? { width: size, height: size } : undefined;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={alt || displayName}
        className={`user-avatar-img ${className}`.trim()}
        style={style}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`user-avatar-initials ${className}`.trim()}
      style={style}
      aria-hidden="true"
      title={displayName}
    >
      {initials}
    </div>
  );
}
