import {
  BallControlScenarioEnvironment,
  MovementScenarioEnvironment,
  PassingScenarioEnvironment,
  ShootingScenarioEnvironment,
  type FundamentalScenarioEnvironmentOptions,
} from "../../../src/application/match/scenario/FundamentalScenarioEnvironment";
import type { PlayerActionId } from "../../../src/application/match/policy/PlayerActionSpace";
import type { FundamentalScenarioOutcome } from "../../../src/application/match/scenario/contracts/FundamentalScenarioOutcome";
import { buildSimulationConfig } from "../../helpers/builders";
import { sampleFundamentalDifficulty } from "../../../src/application/match/curriculum/FundamentalTraining";

const base = (extra: Partial<FundamentalScenarioEnvironmentOptions> = {}): FundamentalScenarioEnvironmentOptions => ({
  playerId: "home-10",
  playerPosition: { x: 50, y: 34 },
  configFactory: seed => ({ ...buildSimulationConfig(seed), maxDurationSeconds: 30 }),
  maxDecisionSteps: 20,
  maxEpisodePhysicalTicks: 600,
  maxPhysicalTicksPerStep: 200,
  ...extra,
});

describe("fundamental scenario environments", () => {
  it("reaches a movement target through physical locomotion", () => {
    const environment = new MovementScenarioEnvironment(base({
      targetPosition: { x: 52, y: 34 }, ballPosition: { x: 1, y: 1 }, targetRadius: 0.7,
    }));
    const result = run(environment, "MOVE");
    expect(result).toBe("TARGET_REACHED");
  });

  it("resolves physical control only after the player owns the free ball", () => {
    const environment = new BallControlScenarioEnvironment(base({ ballPosition: { x: 52, y: 34 } }));
    const result = run(environment, "CONTROL");
    expect(result).toBe("BALL_CONTROLLED");
  });

  it("keeps chasing the authoritative ball after a failed first touch", () => {
    let controlled = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const difficulty = sampleFundamentalDifficulty("BALL_CONTROL", 1, seed);
      const environment = new BallControlScenarioEnvironment(base({
        ...difficulty.scenario,
        maxDecisionSteps: 12,
        maxEpisodePhysicalTicks: 1_000,
      }));
      try {
        if (run(environment, "CONTROL") === "BALL_CONTROLLED") controlled++;
      } catch (error) {
        throw new Error(`BALL_CONTROL seed ${seed}: ${String(error)}`);
      }
    }
    expect(controlled).toBeGreaterThanOrEqual(9);
  });

  it("resolves a pass from the authoritative pass event", () => {
    const environment = new PassingScenarioEnvironment(base({
      receiverId: "home-9", receiverPosition: { x: 57, y: 34 },
    }));
    const result = run(environment, "PASS", "home-9");
    expect(result).toBe("PASS_COMPLETED");
  });

  it("lets the receiver adjust physically to a long pass", () => {
    const environment = new PassingScenarioEnvironment(base({
      playerPosition: { x: 35, y: 34 }, receiverId: "home-9",
      receiverPosition: { x: 64, y: 47 }, maxEpisodePhysicalTicks: 1_000,
    }));
    expect(run(environment, "PASS", "home-9")).toBe("PASS_COMPLETED");
  });

  it("does not let the passer intercept its own short outbound pass", () => {
    let completed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const difficulty = sampleFundamentalDifficulty("PASSING", .25, seed);
      const environment = new PassingScenarioEnvironment(base({
        ...difficulty.scenario,
        receiverId: "home-9",
        maxEpisodePhysicalTicks: 1_000,
      }));
      if (run(environment, "PASS", "home-9") === "PASS_COMPLETED") completed++;
    }
    expect(completed).toBeGreaterThanOrEqual(9);
  });

  it("exposes and accepts only the configured receiver in the passing drill", () => {
    const environment = new PassingScenarioEnvironment(base({
      receiverId: "home-9", receiverPosition: { x: 57, y: 34 },
    }));
    const reset = environment.reset(77);
    const pass = reset.actionMask.entries.find(entry => entry.id === "PASS")!;
    expect(pass.validTargetIds).toEqual(["home-9"]);
    expect(reset.actionMask.entries.filter(entry => entry.enabled).map(entry => entry.id)).toEqual(["PASS"]);
    expect(() => environment.step({ actionId: "PASS", targetId: "home-1" })).toThrow(/masked for PASSING/);
  });

  it("resolves an empty-goal shot from physical shot events", () => {
    const environment = new ShootingScenarioEnvironment(base({
      playerPosition: { x: 96, y: 34 },
    }));
    const result = run(environment, "SHOT");
    expect(["GOAL", "OFF_TARGET", "POST", "CROSSBAR"]).toContain(result);
  });

  it("resets the same scenario deterministically", () => {
    const environment = new MovementScenarioEnvironment(base({
      targetPosition: { x: 52, y: 35 }, ballPosition: { x: 1, y: 1 },
    }));
    const first = environment.reset(919);
    const second = environment.reset(919);
    expect(second.observation.vector).toEqual(first.observation.vector);
    expect(second.actionMask.bits).toEqual(first.actionMask.bits);
  });
});

type Environment = MovementScenarioEnvironment | BallControlScenarioEnvironment | PassingScenarioEnvironment | ShootingScenarioEnvironment;

function run(environment: Environment, actionId: PlayerActionId, targetId?: string): FundamentalScenarioOutcome | null {
  let boundary = environment.reset(77);
  for (let step = 0; step < 20; step++) {
    const requested = boundary.actionMask.entries.find(entry => entry.id === actionId && entry.enabled);
    const action = requested ?? boundary.actionMask.entries.find(entry => entry.enabled);
    if (!action?.enabled) throw new Error(`no exposed action; enabled=${boundary.actionMask.entries.filter(entry => entry.enabled).map(entry => entry.id).join(",")}`);
    const selectedActionId = action!.id;
    const target = selectedActionId === actionId ? targetId ?? action!.validTargetIds[0] ?? undefined
      : action!.validTargetIds[0] ?? undefined;
    const result = environment.step({ actionId: selectedActionId, ...(target ? { targetId: target } : {}) });
    if (result.terminated || result.truncated) return result.outcome;
    boundary = result;
  }
  throw new Error("Fundamental scenario did not finish within 20 decisions");
}
