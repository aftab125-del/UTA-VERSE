"use client";

import { useEffect, useRef } from "react";

/**
 * Hook to request and maintain a Screen Wake Lock via navigator.wakeLock.
 * Keeps the screen awake during active playback or Ambient Mode display.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let isSubscribed = true;

    async function requestLock() {
      try {
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          const lock = await navigator.wakeLock.request("screen");
          if (!isSubscribed) {
            void lock.release();
            return;
          }
          wakeLockRef.current = lock;
          lock.addEventListener("release", () => {
            if (wakeLockRef.current === lock) {
              wakeLockRef.current = null;
            }
          });
        }
      } catch (err) {
        // Wake lock can fail if battery saver is on or user denied permission
        console.debug("[useWakeLock] Wake Lock request not granted:", err);
      }
    }

    void requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabled) {
        void requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}
