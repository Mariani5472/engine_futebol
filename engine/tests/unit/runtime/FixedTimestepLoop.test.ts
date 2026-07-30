import { FixedTimestepLoop } from "../../../src/application/match/runtime";
import type {
  AnimationScheduler,
  RenderTiming,
} from "../../../src/application/match/runtime";

class ManualScheduler implements AnimationScheduler {
  private timeMs = 0;
  private nextHandle = 1;
  private callback: ((timestampMs: number) => void) | null = null;

  public now(): number { return this.timeMs; }
  public requestFrame(callback: (timestampMs: number) => void): number {
    this.callback = callback;
    return this.nextHandle++;
  }
  public cancelFrame(_handle: number): void { this.callback = null; }
  public advance(milliseconds: number): void {
    this.timeMs += milliseconds;
    const callback = this.callback;
    this.callback = null;
    callback?.(this.timeMs);
  }
}

describe("FixedTimestepLoop", () => {
  it("renders at frame cadence but updates simulation at 20 Hz", () => {
    const scheduler = new ManualScheduler();
    const updates: number[] = [];
    const renders: RenderTiming[] = [];
    const loop = new FixedTimestepLoop({
      scheduler,
      update: (delta) => updates.push(delta),
      render: (timing) => renders.push(timing),
    });

    loop.start();
    for (let frame = 0; frame < 6; frame++) scheduler.advance(1000 / 60);

    expect(renders).toHaveLength(6);
    expect(updates).toEqual([0.05, 0.05]);
    expect(renders.at(-1)?.simulationTimeSeconds).toBeCloseTo(0.1, 8);
    expect(renders.every(({ alpha }) => alpha >= 0 && alpha <= 1)).toBe(true);
  });

  it("caps catch-up work after a long visual frame", () => {
    const scheduler = new ManualScheduler();
    let updates = 0;
    const loop = new FixedTimestepLoop({
      scheduler,
      maxUpdatesPerFrame: 3,
      update: () => updates++,
      render: () => undefined,
    });

    loop.start();
    scheduler.advance(1000);

    expect(updates).toBe(3);
  });

  it("stops scheduling frames", () => {
    const scheduler = new ManualScheduler();
    let renders = 0;
    const loop = new FixedTimestepLoop({
      scheduler,
      update: () => undefined,
      render: () => renders++,
    });

    loop.start();
    loop.stop();
    scheduler.advance(16);

    expect(loop.isRunning()).toBe(false);
    expect(renders).toBe(0);
  });

  it("does not schedule an orphan frame when render stops the loop", () => {
    const scheduler = new ManualScheduler();
    let renders = 0;
    let loop!: FixedTimestepLoop;
    loop = new FixedTimestepLoop({
      scheduler,
      update: () => undefined,
      render: () => { renders++; loop.stop(); },
    });

    loop.start();
    scheduler.advance(16);
    scheduler.advance(16);

    expect(renders).toBe(1);
    expect(loop.isRunning()).toBe(false);
  });
});
