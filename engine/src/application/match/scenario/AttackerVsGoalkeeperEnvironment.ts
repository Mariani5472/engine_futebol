import type { MatchEvent } from "../../../domain";
import {
  PureMatchEnvironment,
  type EnvironmentResetResult,
  type EnvironmentStepResult,
} from "../environment/PureMatchEnvironment";
import type { SimulationConfig } from "../engine/SimulationConfig";
import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import {
  ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION,
  type AttackerVsGoalkeeperScenarioConfig,
  type ScenarioPoint,
} from "./MatchScenario";
import { attackerVsGoalkeeperRewardV1, type RewardBreakdownV1 } from "../reward/RewardV1";

export type AttackerVsGoalkeeperOutcome =
  | "GOAL"
  | "SAVED_CAUGHT"
  | "SAVED_PARRIED"
  | "BLOCKED"
  | "OFF_TARGET"
  | "POST"
  | "CROSSBAR"
  | "POSSESSION_LOST"
  | "TIMEOUT";

export interface AttackerVsGoalkeeperEnvironmentOptions {
  readonly attackerId: string;
  readonly goalkeeperId: string;
  readonly configFactory: (seed: number) => SimulationConfig;
  readonly initialSeed?: number;
  readonly scenario?: Omit<AttackerVsGoalkeeperScenarioConfig, "kind" | "version" | "attackerId" | "goalkeeperId">;
  readonly maxDecisionSteps?: number;
  readonly maxEpisodePhysicalTicks?: number;
  readonly maxPhysicalTicksPerStep?: number;
}

export interface AttackerVsGoalkeeperResetResult extends EnvironmentResetResult {
  readonly scenarioVersion: typeof ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION;
  readonly goalkeeperPosition: ScenarioPoint;
}

export interface AttackerVsGoalkeeperStepResult extends EnvironmentStepResult {
  readonly outcome: AttackerVsGoalkeeperOutcome | null;
  readonly goalkeeperPosition: ScenarioPoint;
  readonly rewardBreakdown: RewardBreakdownV1;
}

export class AttackerVsGoalkeeperEnvironment {
  private readonly environment: PureMatchEnvironment;
  private goalkeeperOrigin: ScenarioPoint | null = null;
  private done = false;

  public constructor(private readonly options: AttackerVsGoalkeeperEnvironmentOptions) {
    this.environment = new PureMatchEnvironment({
      playerId: options.attackerId,
      initialSeed: options.initialSeed,
      maxDecisionSteps: options.maxDecisionSteps,
      maxEpisodePhysicalTicks: options.maxEpisodePhysicalTicks,
      maxPhysicalTicksPerStep: options.maxPhysicalTicksPerStep,
      configFactory: seed => ({
        ...options.configFactory(seed),
        scenario: {
          kind: "ATTACKER_VS_GOALKEEPER",
          version: ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION,
          attackerId: options.attackerId,
          goalkeeperId: options.goalkeeperId,
          ...options.scenario,
        },
      }),
    });
  }

  public reset(seed?: number): AttackerVsGoalkeeperResetResult {
    this.done = false;
    const reset = seed === undefined ? this.environment.reset() : this.environment.reset(seed);
    this.goalkeeperOrigin = this.goalkeeperPosition();
    this.assertGoalkeeperFrozen();
    return Object.freeze({
      ...reset,
      scenarioVersion: ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION,
      goalkeeperPosition: this.goalkeeperOrigin,
    });
  }

  public step(action: PlayerActionCommand): AttackerVsGoalkeeperStepResult {
    if (this.done) throw new Error("Scenario episode is done; call reset() before step()");
    const transition = this.environment.step(action);
    const outcome = this.resolveOutcome(transition);
    const scenarioTimeout = outcome === null && (transition.terminated || transition.truncated);
    const semanticOutcome = scenarioTimeout ? "TIMEOUT" : outcome;
    const sportingOutcome = semanticOutcome !== null && semanticOutcome !== "TIMEOUT";
    // A normal match may already stage its post-goal restart in the same
    // physical transition. That state is after this scenario's terminal
    // sporting outcome and must not redefine the frozen 1v1 endpoint.
    if (!sportingOutcome) this.assertGoalkeeperFrozen();
    const terminated = sportingOutcome || transition.terminated;
    const truncated = sportingOutcome ? false : transition.truncated;
    const rewardBreakdown = attackerVsGoalkeeperRewardV1(semanticOutcome);
    this.done = terminated || truncated;
    return Object.freeze({
      ...transition,
      reward: rewardBreakdown.total,
      rewardBreakdown,
      terminated,
      truncated,
      outcome: semanticOutcome,
      goalkeeperPosition: sportingOutcome ? this.goalkeeperOrigin! : this.goalkeeperPosition(),
    });
  }

  public isDone(): boolean { return this.done; }

  private resolveOutcome(transition: EnvironmentStepResult): AttackerVsGoalkeeperOutcome | null {
    const resolved = transition.info.events.find((event): event is Extract<MatchEvent, { type: "SHOT_RESOLVED" }> =>
      event.type === "SHOT_RESOLVED" && event.playerId === this.options.attackerId);
    if (resolved) {
      const semantic = resolved.finalOutcome as AttackerVsGoalkeeperOutcome;
      if (["GOAL", "SAVED_CAUGHT", "SAVED_PARRIED", "BLOCKED", "OFF_TARGET", "POST", "CROSSBAR"].includes(semantic)) {
        return semantic;
      }
    }
    const goal = transition.info.events.some(event => event.type === "GOAL" && event.scorerId === this.options.attackerId);
    if (goal) return "GOAL";
    const debug = this.environment.debugObservation();
    if (!transition.observation.self.hasBall && debug.ball.ownerId !== this.options.attackerId) {
      const shotStarted = transition.info.events.some(event => event.type === "SHOT_STARTED" && event.playerId === this.options.attackerId);
      if (!shotStarted) return "POSSESSION_LOST";
    }
    return null;
  }

  private goalkeeperPosition(): ScenarioPoint {
    const goalkeeper = this.environment.debugObservation().players
      .find(player => player.id === this.options.goalkeeperId);
    if (!goalkeeper) throw new Error(`Unknown goalkeeper: ${this.options.goalkeeperId}`);
    return Object.freeze({ ...goalkeeper.position });
  }

  private assertGoalkeeperFrozen(): void {
    if ((this.options.scenario?.freezeGoalkeeper ?? true) === false || !this.goalkeeperOrigin) return;
    const current = this.goalkeeperPosition();
    if (Math.abs(current.x - this.goalkeeperOrigin.x) > 1e-9 || Math.abs(current.y - this.goalkeeperOrigin.y) > 1e-9) {
      throw new Error(`Frozen goalkeeper moved from (${this.goalkeeperOrigin.x}, ${this.goalkeeperOrigin.y}) to (${current.x}, ${current.y})`);
    }
  }
}
