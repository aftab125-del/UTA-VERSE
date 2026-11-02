export interface AudioEngineCallbacks {
  onLoading?: () => void;
  onReady?: (duration: number) => void;
  onProgress?: (position: number, duration: number, buffered: number) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
}

/**
 * Deck encapsulating an HTMLAudioElement with its event listeners and stream state.
 */
class Deck {
  public readonly element: HTMLAudioElement;
  public source: string | null = null;
  public isReady = false;
  public lastBufferedTime = 0;
  private cleanupListeners: (() => void) | null = null;
  private recoveredNetworkError = false;

  constructor() {
    this.element = new Audio();
    this.element.preload = "auto";
    this.ensureAttached();
  }

  private ensureAttached() {
    if (typeof document !== "undefined" && document.body && !this.element.isConnected) {
      this.element.style.position = "fixed";
      this.element.style.top = "-9999px";
      this.element.style.left = "-9999px";
      this.element.style.width = "1px";
      this.element.style.height = "1px";
      this.element.style.opacity = "0";
      this.element.style.pointerEvents = "none";
      this.element.setAttribute("aria-hidden", "true");
      document.body.appendChild(this.element);
    }
  }

  attachListeners(callbacks: AudioEngineCallbacks) {
    this.detachListeners();
    this.ensureAttached();

    const onLoadedMetadata = () => {
      this.isReady = true;
      callbacks.onReady?.(this.element.duration || 0);
    };

    const onCanPlay = () => {
      this.isReady = true;
    };

    const onTimeUpdate = () => {
      callbacks.onProgress?.(
        this.element.currentTime,
        this.element.duration || 0,
        this.getBufferedTime()
      );
    };

    const onProgress = () => {
      const buffered = this.getBufferedTime();
      if (buffered > this.lastBufferedTime + 0.25) {
        this.lastBufferedTime = buffered;
      }
      callbacks.onProgress?.(
        this.element.currentTime,
        this.element.duration || 0,
        buffered
      );
    };

    const onWaiting = () => {
      callbacks.onLoading?.();
    };

    const onPlaying = () => {
      this.recoveredNetworkError = false;
      callbacks.onPlaying?.();
    };

    const onPause = () => {
      callbacks.onPaused?.();
    };

    const onEnded = () => {
      callbacks.onEnded?.();
    };

    const onError = () => {
      const code = this.element.error?.code ?? null;
      // Code 1 is MEDIA_ERR_ABORTED (user interrupted or replaced source). Ignore it.
      if (code === 1 || !this.element.src || !this.source) return;

      // If it's a network glitch/disconnect (code 2 = MEDIA_ERR_NETWORK), attempt 1 transparent reconnect from current timestamp
      if (code === 2 && !this.recoveredNetworkError && this.source) {
        this.recoveredNetworkError = true;
        const resumePos = this.element.currentTime;
        console.warn("[Deck] Audio network interruption (code 2). Attempting auto-reconnect at", resumePos);
        const currentSrc = this.source;
        this.element.src = currentSrc;
        this.element.load();
        if (resumePos > 0) {
          try {
            this.element.currentTime = resumePos;
          } catch {}
        }
        void this.element.play().catch(() => {});
        return;
      }

      console.warn("[Deck] Audio stream error encountered", {
        src: this.element.src,
        code,
        message: this.element.error?.message ?? null,
      });
      callbacks.onError?.("The audio source encountered a playback issue.");
    };

    this.element.addEventListener("loadedmetadata", onLoadedMetadata);
    this.element.addEventListener("canplay", onCanPlay);
    this.element.addEventListener("timeupdate", onTimeUpdate);
    this.element.addEventListener("progress", onProgress);
    this.element.addEventListener("waiting", onWaiting);
    this.element.addEventListener("playing", onPlaying);
    this.element.addEventListener("pause", onPause);
    this.element.addEventListener("ended", onEnded);
    this.element.addEventListener("error", onError);

    this.cleanupListeners = () => {
      this.element.removeEventListener("loadedmetadata", onLoadedMetadata);
      this.element.removeEventListener("canplay", onCanPlay);
      this.element.removeEventListener("timeupdate", onTimeUpdate);
      this.element.removeEventListener("progress", onProgress);
      this.element.removeEventListener("waiting", onWaiting);
      this.element.removeEventListener("playing", onPlaying);
      this.element.removeEventListener("pause", onPause);
      this.element.removeEventListener("ended", onEnded);
      this.element.removeEventListener("error", onError);
    };
  }

  detachListeners() {
    this.cleanupListeners?.();
    this.cleanupListeners = null;
  }

  getBufferedTime(): number {
    const range = this.element.buffered;
    return range.length ? range.end(range.length - 1) : 0;
  }

  setSource(source: string, callbacks: AudioEngineCallbacks) {
    this.detachListeners();
    this.source = source;
    this.isReady = false;
    this.lastBufferedTime = 0;
    this.recoveredNetworkError = false;
    this.attachListeners(callbacks);
    this.element.src = source;
    this.element.load();
  }

  clear() {
    this.detachListeners();
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
    this.source = null;
    this.isReady = false;
    this.lastBufferedTime = 0;
    this.recoveredNetworkError = false;
  }
}

/**
 * Dual-Deck Audio Engine (Modeled after Echo Music's primary & standby player architecture).
 *
 * Provides:
 * 1. Primary Deck: Handles currently active playback and user controls.
 * 2. Standby Deck: Silently pre-loads and pre-buffers the next track in the queue.
 * 3. Instant 0ms Handoff: When track finishes or is skipped, swaps decks instantly with zero buffering spinner.
 * 4. Resilient Auto-Recovery: Reconnects seamlessly from current timestamp on stream stalls.
 */
export class AudioEngine {
  private primaryDeck: Deck;
  private standbyDeck: Deck;
  private currentCallbacks: AudioEngineCallbacks | null = null;
  private currentVolume = 0.8;
  private isMuted = false;
  private stallRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private hasRecoveredCurrentSource = false;

  constructor() {
    if (typeof window === "undefined") throw new Error("AudioEngine requires a browser");
    this.primaryDeck = new Deck();
    this.standbyDeck = new Deck();
  }

  private clearStallTimer() {
    if (this.stallRecoveryTimer) {
      clearTimeout(this.stallRecoveryTimer);
      this.stallRecoveryTimer = null;
    }
  }

  /**
   * Pre-arms the standby deck with the upcoming track's audio stream.
   * Downloads and buffers audio data in the background so track transition has 0ms latency.
   */
  preArm(source: string) {
    if (!source || this.standbyDeck.source === source) return;

    try {
      this.standbyDeck.clear();
      this.standbyDeck.source = source;
      this.standbyDeck.element.src = source;
      this.standbyDeck.element.volume = 0; // Muted while pre-buffering
      this.standbyDeck.element.load();
      console.info("[AudioEngine] Pre-armed standby deck for next track", { source: source.slice(0, 60) });
    } catch (err) {
      console.debug("[AudioEngine] Standby pre-arm ignored:", err);
    }
  }

  load(source: string, callbacks: AudioEngineCallbacks = {}) {
    if (!source) throw new Error("An audio source is required.");
    this.clearStallTimer();
    this.currentCallbacks = callbacks;
    this.hasRecoveredCurrentSource = false;

    // Check if standby deck has already pre-loaded this exact source!
    if (this.standbyDeck.source === source && this.standbyDeck.element.readyState >= 2) {
      console.info("[AudioEngine] Instant 0ms transition: Swapping to pre-armed standby deck!");
      this.primaryDeck.clear();

      // Swap decks
      const temp = this.primaryDeck;
      this.primaryDeck = this.standbyDeck;
      this.standbyDeck = temp;

      this.applyVolumeToDeck(this.primaryDeck);
      this.primaryDeck.attachListeners(callbacks);

      callbacks.onReady?.(this.primaryDeck.element.duration || 0);
      return;
    }

    // Otherwise load on primary deck
    this.primaryDeck.setSource(source, callbacks);
    this.applyVolumeToDeck(this.primaryDeck);

    callbacks.onLoading?.();
  }

  async play(): Promise<boolean> {
    if (!this.primaryDeck.source) throw new Error("No audio source is loaded.");
    try {
      await this.primaryDeck.element.play();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          console.warn("[AudioEngine] Playback was prevented by browser autoplay policy. Waiting for user interaction.");
          this.currentCallbacks?.onPaused?.();
          return false;
        }
        if (error.name === "AbortError") {
          console.debug("[AudioEngine] Play request was aborted by a subsequent load/play call.");
          return false;
        }
      }
      console.warn("[AudioEngine] Play request failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  hasLoadedSource(): boolean {
    return Boolean(this.primaryDeck.source);
  }

  pause() {
    if (this.primaryDeck.source) {
      this.primaryDeck.element.pause();
    }
  }

  seek(position: number) {
    if (this.primaryDeck.source && Number.isFinite(position)) {
      const targetTime = Math.max(0, position);
      this.primaryDeck.element.currentTime = targetTime;
      this.currentCallbacks?.onProgress?.(
        targetTime,
        this.primaryDeck.element.duration || 0,
        this.primaryDeck.getBufferedTime()
      );
    }
  }

  setVolume(volume: number) {
    this.currentVolume = Math.min(1, Math.max(0, volume));
    this.applyVolumeToDeck(this.primaryDeck);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.applyVolumeToDeck(this.primaryDeck);
  }

  private applyVolumeToDeck(deck: Deck) {
    deck.element.volume = this.isMuted ? 0 : this.currentVolume;
  }

  getBufferedTime(): number {
    return this.primaryDeck.getBufferedTime();
  }

  clear() {
    this.clearStallTimer();
    this.currentCallbacks = null;
    this.primaryDeck.clear();
    this.standbyDeck.clear();
    this.hasRecoveredCurrentSource = false;
  }

  dispose() {
    this.clear();
  }
}
