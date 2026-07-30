import { PureMatchEnvironment } from "../../../src/application/match/environment/PureMatchEnvironment";
import type { PlayerActionCommand } from "../../../src/application/match/policy/PlayerPolicy";
import type { PlayerActionMask } from "../../../src/application/match/policy/PlayerActionSpace";
import { buildSimulationConfig } from "../../helpers/builders";

function firstAllowed(mask: PlayerActionMask): PlayerActionCommand {
  const entry = mask.entries.find(candidate => candidate.enabled && candidate.id !== "NONE");
  if (!entry) throw new Error("Test fixture produced no enabled action");
  const targetId = entry.validTargetIds[0] ?? undefined;
  return { actionId: entry.id, targetId };
}

function environment(overrides: Partial<ConstructorParameters<typeof PureMatchEnvironment>[0]> = {}) {
  return new PureMatchEnvironment({
    playerId: "home-2",
    initialSeed: 73,
    configFactory: seed => ({
      ...buildSimulationConfig(seed),
      maxDurationSeconds: 20,
    }),
    maxPhysicalTicksPerStep: 500,
    ...overrides,
  });
}

describe("PureMatchEnvironment", () => {
  it("resets at a decision gate and advances several fixed physics ticks per action", () => {
    const env = environment();
    const initial = env.reset();
    const transition = env.step(firstAllowed(initial.actionMask));

    expect(initial.observation.kind).toBe("ACTOR");
    expect(initial.info.physicalTicks).toBeGreaterThan(0);
    expect(transition.info.physicalTicks).toBeGreaterThan(1);
    expect(transition.info.decision?.policyId).toBe("environment:home-2");
    expect(transition.info.decision?.accepted).toBe(true);
    expect(transition.terminated).toBe(false);
    expect(transition.truncated).toBe(false);
    expect(transition.observation.matchSecond).toBeGreaterThan(initial.observation.matchSecond);
  });

  it("rejects a masked action without advancing physics", () => {
    const env = environment();
    const initial = env.reset();
    const masked = initial.actionMask.entries.find(entry => !entry.enabled && entry.id !== "NONE")!;
    const ticksBefore = initial.info.totalPhysicalTicks;

    expect(() => env.step({ actionId: masked.id })).toThrow(/is masked/);
    expect(env.currentObservation()).toBe(initial.observation);
    expect(initial.info.totalPhysicalTicks).toBe(ticksBefore);
  });

  it("truncates on an environment decision limit and requires reset afterwards", () => {
    const env = environment({ maxDecisionSteps: 1 });
    const initial = env.reset();
    const transition = env.step(firstAllowed(initial.actionMask));

    expect(transition.terminated).toBe(false);
    expect(transition.truncated).toBe(true);
    expect(transition.info.reason).toBe("DECISION_LIMIT");
    expect(env.isDone()).toBe(true);
    expect(() => env.step(firstAllowed(transition.actionMask))).toThrow(/call reset/);
  });

  it("marks the natural match horizon as termination rather than truncation", () => {
    const env = environment({
      configFactory: seed => ({ ...buildSimulationConfig(seed), maxDurationSeconds: 3 }),
    });
    let boundary = env.reset();
    let transition = env.step(firstAllowed(boundary.actionMask));
    while (!transition.terminated && !transition.truncated) {
      boundary = transition;
      transition = env.step(firstAllowed(boundary.actionMask));
    }

    expect(transition.terminated).toBe(true);
    expect(transition.truncated).toBe(false);
    expect(transition.info.reason).toBe("MATCH_FINISHED");
  });

  it("reproduces reset and step transitions with the same seed and actions", () => {
    const left = environment();
    const right = environment();
    const leftReset = left.reset(101);
    const rightReset = right.reset(101);
    expect(rightReset).toEqual(leftReset);

    const action = firstAllowed(leftReset.actionMask);
    expect(right.step(action)).toEqual(left.step(action));
  });
});
