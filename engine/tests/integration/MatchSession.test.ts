import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { MatchSession } from "../../src/application/match/engine/MatchSession";
import type { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";
import { buildSimulationConfig } from "../helpers/builders";
import { DecisionType } from "../../src/application/match/decision/DecisionType";

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
    expect(snapshot.manifest.seed).toBe(17);
    expect(snapshot.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves the execution manifest in the final archive", () => {
    const session = MatchSession.create(config(0.2));
    while (!session.isFinished()) session.advance(0.05);
    expect(session.archive()?.manifest).toEqual(session.result()?.manifest);
  });

  it("treats snapshot as a pure read and exposes sequence zero before updates", () => {
    const session = MatchSession.create(config(5));
    const first = session.snapshot();
    const second = session.snapshot();

    expect(first.sequence).toBe(0);
    expect(second).toEqual(first);
    expect(session.result()).toBeNull();

    session.update(0.05);
    expect(session.snapshot().sequence).toBe(1);
  });

  it("allows external control of one player without taking over the other players", () => {
    const session = MatchSession.create(config(8, 0.2));
    session.controlPlayer("home-2");
    session.submitPlayerAction("home-2", { type: DecisionType.MOVE });
    while (!session.isFinished()) session.advance(0.2);

    const controlled = session.policyTranscript().filter(record => record.playerId === "home-2");
    const others = session.policyTranscript().filter(record => record.playerId !== "home-2");
    expect(controlled.length).toBeGreaterThan(0);
    expect(controlled[0]).toMatchObject({
      policyId: "external:home-2",
      requestedType: DecisionType.MOVE,
      selectedType: DecisionType.MOVE,
      accepted: true,
    });
    expect(others.length).toBeGreaterThan(0);
    expect(others.every(record => record.policyId === "heuristic-v1")).toBe(true);
    const mask = session.actionMask("home-2");
    expect(mask?.version).toBe(1);
    expect(mask?.bits).toHaveLength(24);
    expect(session.snapshot().actionMasks).toContainEqual(mask);
    expect(session.actorObservation("home-2")?.kind).toBe("ACTOR");
    expect(session.snapshot().actorObservations).toContainEqual(session.actorObservation("home-2"));
    expect(session.snapshot()).not.toHaveProperty("privilegedCriticObservation");
    expect(session.snapshot()).not.toHaveProperty("debugObservation");
    expect(session.privilegedCriticObservation("home-2").kind).toBe("PRIVILEGED_CRITIC");
    expect(session.debugObservation("home-2").kind).toBe("DEBUG");
  });

  it("produces identical trajectories for the same seed and decision stream", () => {
    const left = MatchSession.create(config(3));
    const right = MatchSession.create(config(3));

    while (!left.isFinished() && !right.isFinished()) {
      expect(right.snapshot()).toEqual(left.snapshot());
      // Extra reads on only one side must not consume RNG or mutate runtime.
      left.snapshot();
      left.snapshot();
      left.advance(0.05);
      right.advance(0.05);
    }

    expect(right.result()).toEqual(left.result());
  });

  it("isolates sessions advanced in an interleaved schedule", () => {
    const firstConfig = { ...config(8, 0.2), seed: 31 };
    const secondConfig = { ...config(8, 0.2), seed: 47 };
    const expectedFirst = new MatchEngine().simulate(firstConfig);
    const expectedSecond = new MatchEngine().simulate(secondConfig);
    const sharedEngine = new MatchEngine();
    const first = sharedEngine.runIncrementally(firstConfig);
    const second = sharedEngine.runIncrementally(secondConfig);
    let firstResult = null as ReturnType<MatchEngine["simulate"]> | null;
    let secondResult = null as ReturnType<MatchEngine["simulate"]> | null;

    while (!firstResult || !secondResult) {
      if (!firstResult) {
        const step = first.next();
        if (step.done) firstResult = step.value;
        else if (step.value.finalResult) firstResult = step.value.finalResult;
      }
      if (!secondResult) {
        const step = second.next();
        if (step.done) secondResult = step.value;
        else if (step.value.finalResult) secondResult = step.value.finalResult;
      }
    }

    expect(firstResult).toEqual(expectedFirst);
    expect(secondResult).toEqual(expectedSecond);
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
