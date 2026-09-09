import { create } from "zustand";

interface ToastState {
  message: string | null;
  showToast: (message: string, durationMs?: number) => void;
  hideToast: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message: string, durationMs = 2500) => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ message });
    timeoutId = setTimeout(() => {
      set({ message: null });
      timeoutId = null;
    }, durationMs);
  },
  hideToast: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ message: null });
    timeoutId = null;
  },
}));

export function showToast(message: string, durationMs = 2500) {
  useToastStore.getState().showToast(message, durationMs);
}
