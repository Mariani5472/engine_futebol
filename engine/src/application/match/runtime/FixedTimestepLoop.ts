import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";

export interface AnimationScheduler {
  now(): number;
  requestFrame(callback: (timestampMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export interface RenderTiming {
  /** Fraction between the previous and current simulation state, in [0, 1). */
  readonly alpha: number;
  readonly frameDeltaSeconds: number;
  readonly simulationTimeSeconds: number;
}

export interface FixedTimestepLoopOptions {
  readonly update: (fixedDeltaSeconds: number) => void;
  readonly render: (timing: RenderTiming) => void;
  readonly scheduler: AnimationScheduler;
  readonly timestepSeconds?: number;
  /** Prevents a stalled tab from running an unbounded number of updates. */
  readonly maxUpdatesPerFrame?: number;
  readonly maxFrameDeltaSeconds?: number;
}

/**
 * Runs deterministic simulation updates independently from visual frames.
 * At 60 FPS the renderer runs every ~16.7ms while update runs every 50ms.
 */
export class FixedTimestepLoop {
  private readonly timestepSeconds: number;
  private readonly maxUpdatesPerFrame: number;
  private readonly maxFrameDeltaSeconds: number;
  private accumulatorSeconds = 0;
  private simulationTimeSeconds = 0;
  private previousTimestampMs = 0;
  private frameHandle: number | null = null;
  private running = false;

  constructor(private readonly options: FixedTimestepLoopOptions) {
    this.timestepSeconds = options.timestepSeconds
      ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
    this.maxUpdatesPerFrame = options.maxUpdatesPerFrame ?? 5;
    this.maxFrameDeltaSeconds = options.maxFrameDeltaSeconds ?? 0.25;

    if (this.timestepSeconds <= 0) throw new Error("timestepSeconds must be positive");
    if (this.maxUpdatesPerFrame < 1) throw new Error("maxUpdatesPerFrame must be at least 1");
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTimestampMs = this.options.scheduler.now();
    this.frameHandle = this.options.scheduler.requestFrame(this.onFrame);
  }

  public stop(): void {
    this.running = false;
    if (this.frameHandle !== null) {
      this.options.scheduler.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  private readonly onFrame = (timestampMs: number): void => {
    if (!this.running) return;

    const elapsedSeconds = Math.max(0, (timestampMs - this.previousTimestampMs) / 1000);
    const frameDeltaSeconds = Math.min(elapsedSeconds, this.maxFrameDeltaSeconds);
    this.previousTimestampMs = timestampMs;
    this.accumulatorSeconds += frameDeltaSeconds;

    let updates = 0;
    while (
      this.accumulatorSeconds + Number.EPSILON >= this.timestepSeconds
      && updates < this.maxUpdatesPerFrame
    ) {
      this.options.update(this.timestepSeconds);
      this.accumulatorSeconds -= this.timestepSeconds;
      this.simulationTimeSeconds += this.timestepSeconds;
      updates++;
    }

    // Drop excess backlog after the safety limit instead of freezing the UI.
    if (updates === this.maxUpdatesPerFrame) {
      this.accumulatorSeconds = Math.min(this.accumulatorSeconds, this.timestepSeconds);
    }

    this.options.render({
      alpha: Math.min(1, Math.max(0, this.accumulatorSeconds / this.timestepSeconds)),
      frameDeltaSeconds,
      simulationTimeSeconds: this.simulationTimeSeconds,
    });

    // render() may synchronously unmount React and stop this loop.
    if (this.running) {
      this.frameHandle = this.options.scheduler.requestFrame(this.onFrame);
    }
  };
}
