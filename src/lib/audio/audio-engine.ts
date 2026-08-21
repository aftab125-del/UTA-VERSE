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

  constructor() {
    if (typeof window === "undefined") throw new Error("AudioEngine requires a browser");
    this.element = new Audio();
    this.element.preload = "metadata";
  }

  load(source: string, callbacks: AudioEngineCallbacks = {}) {
    this.cleanupListeners?.();
    this.element.pause();
    this.element.src = source;
    this.element.load();
    callbacks.onLoading?.();

    const onLoadedMetadata = () => callbacks.onReady?.(this.element.duration || 0);
    const onTimeUpdate = () => callbacks.onProgress?.(this.element.currentTime, this.element.duration || 0, this.getBufferedTime());
    const onProgress = () => callbacks.onProgress?.(this.element.currentTime, this.element.duration || 0, this.getBufferedTime());
    const onPlaying = () => callbacks.onPlaying?.();
    const onPause = () => callbacks.onPaused?.();
    const onEnded = () => callbacks.onEnded?.();
    const onError = () => callbacks.onError?.("The audio source could not be loaded.");

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

  async play() { await this.element.play(); }
  pause() { this.element.pause(); }
  seek(position: number) { this.element.currentTime = Math.max(0, position); }
  setVolume(volume: number) { this.element.volume = Math.min(1, Math.max(0, volume)); }

  dispose() {
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
  }

  private getBufferedTime() {
    const range = this.element.buffered;
    return range.length ? range.end(range.length - 1) : 0;
  }
}
