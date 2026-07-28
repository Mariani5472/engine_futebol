import type { AnimationScheduler } from "./FixedTimestepLoop";

interface AnimationFrameHost {
  readonly performance: { now(): number };
  requestAnimationFrame(callback: (timestampMs: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

/** Browser adapter kept separate so the engine loop remains platform agnostic. */
export class BrowserAnimationScheduler implements AnimationScheduler {
  constructor(
    private readonly host: AnimationFrameHost = globalThis as unknown as AnimationFrameHost,
  ) {}

  public now(): number {
    return this.host.performance.now();
  }

  public requestFrame(callback: (timestampMs: number) => void): number {
    return this.host.requestAnimationFrame(callback);
  }

  public cancelFrame(handle: number): void {
    this.host.cancelAnimationFrame(handle);
  }
}
