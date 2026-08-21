/** Browser-only audio boundary. Keep HTMLAudioElement and Media Session details here. */
export class AudioEngine {
  private readonly element: HTMLAudioElement;

  constructor() {
    if (typeof window === "undefined") throw new Error("AudioEngine requires a browser");
    this.element = new Audio();
    this.element.preload = "metadata";
  }

  get mediaElement() { return this.element; }
  async play() { await this.element.play(); }
  pause() { this.element.pause(); }
  dispose() { this.element.pause(); this.element.removeAttribute("src"); this.element.load(); }
}
