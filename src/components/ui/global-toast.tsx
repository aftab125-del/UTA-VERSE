"use client";

import { useToastStore } from "@/stores/toast-store";

export function GlobalToast() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
