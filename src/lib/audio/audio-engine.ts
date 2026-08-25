export interface AudioEngineCallbacks {
  onLoading?: () => void;
  onReady?: (duration: number) => void;
  onProgress?: (position: number, duration: number, buffered: number) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
}

/** Browser-only audio boundary. React components never own the HTMLAudioElement. */
export class AudioEngine {
  private readonly element: HTMLAudioElement;
  private cleanupListeners: (() => void) | null = null;
  private hasSource = false;

  constructor() {
    if (typeof window === "undefined") throw new Error("AudioEngine requires a browser");
    this.element = new Audio();
    this.element.preload = "metadata";
  }

  load(source: string, callbacks: AudioEngineCallbacks = {}) {
    if (!source) throw new Error("An audio source is required.");
    this.cleanupListeners?.();
    this.element.pause();
    this.element.src = source;
    this.element.load();
    this.hasSource = true;
    callbacks.onLoading?.();

    const onLoadedMetadata = () => callbacks.onReady?.(this.element.duration || 0);
    const onTimeUpdate = () => callbacks.onProgress?.(this.element.currentTime, this.element.duration || 0, this.getBufferedTime());
    const onProgress = () => callbacks.onProgress?.(this.element.currentTime, this.element.duration || 0, this.getBufferedTime());
    const onPlaying = () => callbacks.onPlaying?.();
    const onPause = () => callbacks.onPaused?.();
    const onEnded = () => callbacks.onEnded?.();
    const onError = () => {
      console.error("[AudioEngine] Audio element failed to load the source", {
        code: this.element.error?.code ?? null,
        networkState: this.element.networkState,
        readyState: this.element.readyState,
      });
      callbacks.onError?.("The resolved audio source could not be loaded by the browser.");
    };

    this.element.addEventListener("loadedmetadata", onLoadedMetadata);
    this.element.addEventListener("timeupdate", onTimeUpdate);
    this.element.addEventListener("progress", onProgress);
    this.element.addEventListener("playing", onPlaying);
    this.element.addEventListener("pause", onPause);
    this.element.addEventListener("ended", onEnded);
    this.element.addEventListener("error", onError);

    this.cleanupListeners = () => {
      this.element.removeEventListener("loadedmetadata", onLoadedMetadata);
      this.element.removeEventListener("timeupdate", onTimeUpdate);
      this.element.removeEventListener("progress", onProgress);
      this.element.removeEventListener("playing", onPlaying);
      this.element.removeEventListener("pause", onPause);
      this.element.removeEventListener("ended", onEnded);
      this.element.removeEventListener("error", onError);
    };
  }

  async play() {
    if (!this.hasSource) throw new Error("No audio source is loaded.");
    try {
      await this.element.play();
    } catch (error) {
      console.error("[AudioEngine] Browser playback request failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown playback error",
      });
      throw error;
    }
  }

  pause() {
    if (this.hasSource) this.element.pause();
  }

  seek(position: number) {
    if (this.hasSource && Number.isFinite(position)) this.element.currentTime = Math.max(0, position);
  }

  setVolume(volume: number) { this.element.volume = Math.min(1, Math.max(0, volume)); }

  clear() {
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
    this.hasSource = false;
  }

  dispose() {
    this.clear();
  }

  private getBufferedTime() {
    const range = this.element.buffered;
    return range.length ? range.end(range.length - 1) : 0;
  }
}
