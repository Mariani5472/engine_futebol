import { MultiAgentMatchEnvironment } from "../../../src/application/match/environment/MultiAgentMatchEnvironment";
import { createCurriculumScenarioPreset } from "../../../src/application/match/scenario/MatchScenario";
import type { PlayerActionCommand } from "../../../src/application/match/policy/PlayerPolicy";
import type { PlayerActionMask } from "../../../src/application/match/policy/PlayerActionSpace";
import { buildSimulationConfig } from "../../helpers/builders";
import { MatchSession } from "../../../src/application/match/engine/MatchSession";

function create(seed = 71) {
  return new MultiAgentMatchEnvironment({
    playerIds: ["home-10", "home-9"],
    initialSeed: seed,
    configFactory: value => ({
      ...buildSimulationConfig(value),
      maxDurationSeconds: 60,
      scenario: createCurriculumScenarioPreset("PASS"),
    }),
    maxJointDecisionSteps: 8,
    maxEpisodePhysicalTicks: 1_000,
    maxPhysicalTicksPerStep: 500,
  });
}

describe("MultiAgentMatchEnvironment", () => {
  it("publishes deterministic joint boundaries and requires exactly the active agents", () => {
    const left = create(71);
    const right = create(71);
    const leftReset = left.reset(71);
    const rightReset = right.reset(71);
    expect(rightReset).toEqual(leftReset);
    expect(leftReset.activeAgentIds.length).toBeGreaterThan(0);
    expect(Object.keys(leftReset.observations).sort()).toEqual([...leftReset.activeAgentIds].sort());
    expect(() => left.step({})).toThrow(/match active agents exactly/);

    const actions = commands(leftReset.actionMasks);
    const leftStep = left.step(actions);
    const rightStep = right.step(actions);
    expect(rightStep).toEqual(leftStep);
    expect(leftStep.info.physicalTicks).toBeGreaterThan(0);
    expect(Object.keys(leftStep.rewards).sort()).toEqual(["home-10", "home-9"]);
  });

  it("can complete the passing objective from authoritative pass events", () => {
    const environment = create(93);
    let boundary = environment.reset(93);
    for (let step = 0; step < 8 && !boundary.terminated && !boundary.truncated; step++) {
      boundary = environment.step(commands(boundary.actionMasks));
    }
    expect(boundary.info.events.some(event => event.type === "PASS_COMPLETED") || boundary.truncated).toBe(true);
    if (boundary.terminated) {
      expect(boundary.info.reason).toBe("OBJECTIVE_COMPLETE");
      expect(boundary.rewards["home-10"]).toBeGreaterThan(0);
    }
  });

  it("rejects duplicate controlled players", () => {
    expect(() => new MultiAgentMatchEnvironment({
      playerIds: ["home-10", "home-10"],
      configFactory: buildSimulationConfig,
    })).toThrow(/unique controlled players/);
  });

  it("does not materialize UI snapshots inside the physical-tick hot path", () => {
    const snapshot = jest.spyOn(MatchSession.prototype, "snapshot");
    try {
      const environment = create(105);
      const boundary = environment.reset(105);
      environment.step(commands(boundary.actionMasks));
      expect(snapshot).not.toHaveBeenCalled();
    } finally {
      snapshot.mockRestore();
    }
  });
});

function commands(masks: Readonly<Record<string, PlayerActionMask>>): Record<string, PlayerActionCommand> {
  return Object.fromEntries(Object.entries(masks).map(([playerId, mask]) => {
    const preferred = playerId === "home-10"
      ? mask.entries.find(entry => entry.id === "PASS" && entry.enabled && entry.validTargetIds.includes("home-9"))
      : undefined;
    const entry = preferred ?? mask.entries.find(candidate => candidate.enabled && candidate.id !== "NONE")!;
    const target = preferred ? "home-9" : entry.validTargetIds[0];
    return [playerId, target === null || target === undefined ? { actionId: entry.id } : { actionId: entry.id, targetId: target }];
  }));
}
