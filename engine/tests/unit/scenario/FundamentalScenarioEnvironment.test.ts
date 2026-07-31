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
    const environment = new BallControlScenarioEnvironment(base({ ballPosition: { x: 50.7, y: 34 } }));
    const result = run(environment, "CONTROL");
    expect(result).toBe("BALL_CONTROLLED");
  });

  it("resolves a pass from the authoritative pass event", () => {
    const environment = new PassingScenarioEnvironment(base({
      receiverId: "home-9", receiverPosition: { x: 57, y: 34 },
    }));
    const result = run(environment, "PASS", "home-9");
    expect(result).toBe("PASS_COMPLETED");
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
    const action = boundary.actionMask.entries.find(entry => entry.id === actionId);
    expect(action?.enabled).toBe(true);
    const target = targetId ?? action!.validTargetIds[0] ?? undefined;
    const result = environment.step({ actionId, ...(target ? { targetId: target } : {}) });
    if (result.terminated || result.truncated) return result.outcome;
    boundary = result;
  }
  throw new Error("Fundamental scenario did not finish within 20 decisions");
}
