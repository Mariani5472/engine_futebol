import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { MatchSession } from "../../src/application/match/engine/MatchSession";
import type { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";
import { buildSimulationConfig } from "../helpers/builders";

describe("MatchSession", () => {
  const slowIt = process.env.RUN_SLOW_SESSION_TESTS === "1" ? it : it.skip;
  function config(duration: number, tick = 0.05): SimulationConfig {
    return { ...buildSimulationConfig(17), seed: 17, tickDeltaSeconds: tick, maxDurationSeconds: duration };
  }

  it("produces the same result in batch and incremental modes", () => {
    const matchConfig = config(3 * 60, 2);
    const batch = new MatchEngine().simulate(matchConfig);
    const session = MatchSession.create(matchConfig);
    while (!session.isFinished()) session.update(2);

    expect(session.result()).toEqual(batch);
  }, 120_000);

  it("finishes after exactly duration / 0.05 updates", () => {
    const session = MatchSession.create(config(5));
    for (let update = 0; update < 100; update++) session.update(0.05);

    expect(session.isFinished()).toBe(true);
    expect(session.snapshot().matchSecond).toBeCloseTo(5, 8);
    expect(() => session.update(0.05)).not.toThrow();
  }, 120_000);

  slowIt("finishes a regulation match after exactly 108,000 updates", () => {
    const session = MatchSession.create(config(90 * 60));
    for (let update = 0; update < 108_000; update++) session.advance(0.05);

    expect(session.isFinished()).toBe(true);
    expect(session.snapshot().sequence).toBe(108_000);
    expect(session.snapshot().matchSecond).toBe(90 * 60);
  }, 600_000);

  it("pauses, resumes and validates speed", () => {
    const session = MatchSession.create(config(5));
    const before = session.snapshot().sequence;
    session.pause();
    session.update(0.05);
    expect(session.snapshot().sequence).toBe(before);
    session.setSpeed(4);
    expect(session.getSpeed()).toBe(4);
    session.resume();
    session.update(0.05);
    expect(session.snapshot().sequence).toBe(before + 1);
  });

  it("publishes seed, score and both logical and visual ball positions", () => {
    const session = MatchSession.create(config(5));
    const snapshot = session.snapshot();
    expect(snapshot.seed).toBe(17);
    expect(snapshot.score).toEqual({ homeGoals: 0, awayGoals: 0 });
    expect(snapshot.ball.logicalPosition).toBeDefined();
    expect(snapshot.ball.position).toBeDefined();
  });

  it("speed metadata does not change deterministic engine results", () => {
    const matchConfig = config(2 * 60, 2);
    const normal = MatchSession.create(matchConfig);
    const accelerated = MatchSession.create(matchConfig);
    accelerated.setSpeed(8);

    while (!normal.isFinished()) normal.update(2);
    while (!accelerated.isFinished()) accelerated.update(2);

    expect(accelerated.result()).toEqual(normal.result());
  }, 120_000);
});
