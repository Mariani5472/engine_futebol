import type { MatchEvent } from "../../../domain";
import {
  PureMatchEnvironment,
  type EnvironmentResetResult,
  type EnvironmentStepResult,
} from "../environment/PureMatchEnvironment";
import type { SimulationConfig } from "../engine/SimulationConfig";
import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type { PlayerActionMask } from "../policy/PlayerActionSpace";
import {
  fundamentalReward,
  type FundamentalRewardBreakdown,
} from "../reward/FundamentalReward";
import {
  FUNDAMENTAL_SCENARIO_VERSION,
  type FundamentalScenarioConfig,
  type FundamentalScenarioSkill,
  type ScenarioPoint,
} from "./MatchScenario";
import type { FundamentalScenarioOutcome } from "./contracts/FundamentalScenarioOutcome";

export interface FundamentalScenarioEnvironmentOptions {
  readonly playerId: string;
  readonly configFactory: (seed: number) => SimulationConfig;
  readonly playerPosition: ScenarioPoint;
  readonly targetPosition?: ScenarioPoint;
  readonly receiverId?: string;
  readonly receiverPosition?: ScenarioPoint;
  readonly ballPosition?: ScenarioPoint;
  readonly targetRadius?: number;
  readonly scenarioFactory?: (seed: number) => FundamentalScenarioConfig;
  readonly initialSeed?: number;
  readonly maxDecisionSteps?: number;
  readonly maxEpisodePhysicalTicks?: number;
  readonly maxPhysicalTicksPerStep?: number;
}

export interface FundamentalScenarioResetResult extends EnvironmentResetResult {
  readonly scenarioVersion: typeof FUNDAMENTAL_SCENARIO_VERSION;
  readonly skill: FundamentalScenarioSkill;
}

export interface FundamentalScenarioStepResult extends EnvironmentStepResult {
  readonly outcome: FundamentalScenarioOutcome | null;
  readonly rewardBreakdown: FundamentalRewardBreakdown;
}

abstract class FundamentalScenarioEnvironment {
  private readonly environment: PureMatchEnvironment;
  private activeScenario: FundamentalScenarioConfig;
  private done = false;
  private previousDistance = 0;
  private exposedActionMask: PlayerActionMask | null = null;

  protected constructor(
    private readonly skill: FundamentalScenarioSkill,
    protected readonly options: FundamentalScenarioEnvironmentOptions,
  ) {
    const scenario: FundamentalScenarioConfig = {
      kind: "FUNDAMENTAL",
      version: FUNDAMENTAL_SCENARIO_VERSION,
      skill,
      playerId: options.playerId,
      playerPosition: options.playerPosition,
      targetPosition: options.targetPosition,
      receiverId: options.receiverId,
      receiverPosition: options.receiverPosition,
      ballPosition: options.ballPosition,
      targetRadius: options.targetRadius,
      isolateOtherPlayers: true,
    };
    this.activeScenario = scenario;
    this.environment = new PureMatchEnvironment({
      playerId: options.playerId,
      initialSeed: options.initialSeed,
      maxDecisionSteps: options.maxDecisionSteps,
      maxEpisodePhysicalTicks: options.maxEpisodePhysicalTicks,
      maxPhysicalTicksPerStep: options.maxPhysicalTicksPerStep,
      configFactory: seed => {
        this.activeScenario = options.scenarioFactory?.(seed) ?? scenario;
        return { ...options.configFactory(seed), scenario: this.activeScenario };
      },
    });
  }

  public reset(seed?: number): FundamentalScenarioResetResult {
    this.done = false;
    const result = seed === undefined ? this.environment.reset() : this.environment.reset(seed);
    this.previousDistance = this.distanceToObjective();
    const actionMask = this.restrictActionMask(result.actionMask);
    this.exposedActionMask = actionMask;
    return Object.freeze({ ...result, actionMask, scenarioVersion: FUNDAMENTAL_SCENARIO_VERSION, skill: this.skill });
  }

  public step(action: PlayerActionCommand): FundamentalScenarioStepResult {
    if (this.done) throw new Error("Scenario episode is done; call reset() before step()");
    this.assertExposedAction(action);
    const transition = this.environment.step(action);
    let outcome = this.resolveOutcome(transition);
    if (!outcome && (transition.terminated || transition.truncated)) outcome = "TIMEOUT";
    const currentDistance = this.distanceToObjective();
    const normalization = Math.max(1, this.previousDistance);
    const progress = (this.previousDistance - currentDistance) / normalization * 0.1;
    this.previousDistance = currentDistance;
    const sportingOutcome = outcome !== null && outcome !== "TIMEOUT";
    const terminated = sportingOutcome || transition.terminated;
    const truncated = sportingOutcome ? false : transition.truncated;
    const rewardBreakdown = fundamentalReward(outcome, progress);
    this.done = terminated || truncated;
    const actionMask = this.restrictActionMask(transition.actionMask);
    this.exposedActionMask = actionMask;
    return Object.freeze({
      ...transition,
      actionMask,
      reward: rewardBreakdown.total,
      rewardBreakdown,
      outcome,
      terminated,
      truncated,
    });
  }

  public isDone(): boolean { return this.done; }

  private restrictActionMask(mask: PlayerActionMask): PlayerActionMask {
    const allowed = this.skill === "MOVEMENT" ? new Set(["MOVE"])
      : this.skill === "BALL_CONTROL" ? new Set(["MOVE", "CONTROL"])
      : this.skill === "PASSING" ? new Set(["PASS"])
      : new Set(["MOVE", "DRIBBLE", "SHOT"]);
    const receiverId = this.activeScenario.receiverId;
    let entries = mask.entries.map(entry => {
      if (!allowed.has(entry.id)) return Object.freeze({
        ...entry, enabled: false, validTargetIds: Object.freeze([]),
      });
      const validTargetIds = entry.id === "PASS"
        ? entry.validTargetIds.filter(targetId => targetId === receiverId)
        : entry.validTargetIds;
      return Object.freeze({ ...entry, enabled: validTargetIds.length > 0, validTargetIds: Object.freeze(validTargetIds) });
    });
    if (!entries.some(entry => entry.enabled)) {
      const continuation = mask.entries.find(entry => entry.id === "NONE" && entry.enabled)
        ?? mask.entries.find(entry => entry.enabled);
      if (continuation) entries = entries.map(entry => entry.id === continuation.id ? continuation : entry);
    }
    return Object.freeze({
      ...mask,
      bits: Object.freeze(entries.map(entry => entry.enabled ? 1 as const : 0 as const)),
      entries: Object.freeze(entries),
    });
  }

  private assertExposedAction(action: PlayerActionCommand): void {
    const entry = this.exposedActionMask?.entries.find(candidate => candidate.id === action.actionId);
    const target = action.targetId ?? null;
    if (!entry?.enabled || !entry.validTargetIds.includes(target)) {
      throw new Error(`Action ${action.actionId}:${target ?? "NONE"} is masked for ${this.skill}`);
    }
  }

  private resolveOutcome(transition: EnvironmentStepResult): FundamentalScenarioOutcome | null {
    const events = transition.info.events;
    if (this.skill === "MOVEMENT") {
      return this.distanceToObjective() <= (this.activeScenario.targetRadius ?? 0.6) ? "TARGET_REACHED" : null;
    }
    if (this.skill === "BALL_CONTROL") {
      const debug = this.environment.debugObservation();
      if (debug.ball.ownerId === this.options.playerId && transition.observation.self.hasBall) return "BALL_CONTROLLED";
      if (this.ballOut(events)) return "BALL_OUT";
      return null;
    }
    if (this.skill === "PASSING") {
      if (events.some(event => event.type === "PASS_COMPLETED"
        && event.playerId === this.options.playerId
        && String(event.controllingPlayerId) === this.activeScenario.receiverId)) return "PASS_COMPLETED";
      if (events.some(event => event.type === "PASS_INTERCEPTED" && event.playerId === this.options.playerId)) return "PASS_INTERCEPTED";
      if (this.ballOut(events)) return "BALL_OUT";
      return null;
    }
    const resolved = events.find((event): event is Extract<MatchEvent, { type: "SHOT_RESOLVED" }> =>
      event.type === "SHOT_RESOLVED" && event.playerId === this.options.playerId);
    if (resolved) return resolved.finalOutcome as FundamentalScenarioOutcome;
    if (events.some(event => event.type === "GOAL" && event.scorerId === this.options.playerId)) return "GOAL";
    if (this.ballOut(events)) return "BALL_OUT";
    return null;
  }

  private distanceToObjective(): number {
    const debug = this.environment.debugObservation();
    const player = debug.players.find(candidate => candidate.id === this.options.playerId);
    if (!player) throw new Error(`Unknown fundamental player: ${this.options.playerId}`);
    const target = this.skill === "BALL_CONTROL" ? debug.ball.position : this.activeScenario.targetPosition;
    if (!target) return 0;
    return Math.hypot(player.position.x - target.x, player.position.y - target.y);
  }

  private ballOut(events: readonly MatchEvent[]): boolean {
    return events.some(event => event.type === "THROW_IN" || event.type === "GOAL_KICK" || event.type === "CORNER");
  }
}

export class MovementScenarioEnvironment extends FundamentalScenarioEnvironment {
  public constructor(options: FundamentalScenarioEnvironmentOptions) { super("MOVEMENT", options); }
}

export class BallControlScenarioEnvironment extends FundamentalScenarioEnvironment {
  public constructor(options: FundamentalScenarioEnvironmentOptions) { super("BALL_CONTROL", options); }
}

export class PassingScenarioEnvironment extends FundamentalScenarioEnvironment {
  public constructor(options: FundamentalScenarioEnvironmentOptions) { super("PASSING", options); }
}

export class ShootingScenarioEnvironment extends FundamentalScenarioEnvironment {
  public constructor(options: FundamentalScenarioEnvironmentOptions) { super("SHOOTING_EMPTY_GOAL", options); }
}
