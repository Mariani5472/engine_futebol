import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import type { ActorObservation, DebugObservation, PrivilegedCriticObservation } from "../observation/ObservationSpace";
import { MatchSession } from "../engine/MatchSession";
import type { SimulationConfig } from "../engine/SimulationConfig";
import { DecisionGatePlayerPolicy } from "../policy/PlayerPolicies";
import { commandDecision, type PlayerActionCommand } from "../policy/PlayerPolicy";
import { PLAYER_ACTION_SPACE, type PlayerActionMask } from "../policy/PlayerActionSpace";
import type { PolicyDecisionRecord } from "../policy/PlayerPolicyController";
import type { MatchEvent } from "../../../domain";

export const PURE_MATCH_ENVIRONMENT_VERSION = 1 as const;

export interface PureMatchEnvironmentOptions {
  readonly playerId: string;
  readonly configFactory: (seed: number) => SimulationConfig;
  readonly initialSeed?: number;
  /** Agent decisions, not physics ticks. */
  readonly maxDecisionSteps?: number;
  /** Environmental cutoff. Reaching the match duration is termination, not truncation. */
  readonly maxEpisodePhysicalTicks?: number;
  /** Safety cutoff for a player that never reaches another decision window. */
  readonly maxPhysicalTicksPerStep?: number;
}

export interface EnvironmentTransitionInfo {
  readonly seed: number;
  readonly playerId: string;
  readonly decisionStep: number;
  readonly physicalTicks: number;
  readonly totalPhysicalTicks: number;
  readonly matchSecond: number;
  readonly decision: PolicyDecisionRecord | null;
  readonly events: readonly MatchEvent[];
  readonly reason: "RUNNING" | "MATCH_FINISHED" | "DECISION_LIMIT" | "PHYSICAL_TICK_LIMIT" | "STEP_SAFETY_LIMIT";
}

export interface EnvironmentResetResult {
  readonly observation: ActorObservation;
  readonly actionMask: PlayerActionMask;
  readonly info: EnvironmentTransitionInfo;
}

export interface EnvironmentStepResult {
  readonly observation: ActorObservation;
  readonly actionMask: PlayerActionMask;
  /** Base environment is neutral; scenario wrappers may provide a versioned reward. */
  readonly reward: number;
  readonly terminated: boolean;
  readonly truncated: boolean;
  readonly info: EnvironmentTransitionInfo;
}

/**
 * Synchronous, deterministic environment. It owns no timer, socket, HTTP
 * client or rendering state: reset() and step() are its only clocks.
 */
export class PureMatchEnvironment {
  private session: MatchSession | null = null;
  private gate: DecisionGatePlayerPolicy | null = null;
  private seed: number;
  private decisionSteps = 0;
  private totalPhysicalTicks = 0;
  private done = false;

  public constructor(private readonly options: PureMatchEnvironmentOptions) {
    this.seed = options.initialSeed ?? 1;
    if (!Number.isInteger(this.seed)) throw new Error("Environment seed must be an integer");
    this.validateLimit(options.maxDecisionSteps, "maxDecisionSteps");
    this.validateLimit(options.maxEpisodePhysicalTicks, "maxEpisodePhysicalTicks");
    this.validateLimit(options.maxPhysicalTicksPerStep, "maxPhysicalTicksPerStep");
  }

  public reset(seed = this.seed): EnvironmentResetResult {
    if (!Number.isInteger(seed)) throw new Error("Environment seed must be an integer");
    this.seed = seed;
    this.decisionSteps = 0;
    this.totalPhysicalTicks = 0;
    this.done = false;
    const requested = this.options.configFactory(seed);
    this.session = MatchSession.create({
      ...requested,
      seed,
      tickDeltaSeconds: ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds,
    });
    this.gate = new DecisionGatePlayerPolicy(`environment:${this.options.playerId}`);
    this.session.setPlayerPolicy(this.options.playerId, this.gate);

    const physicalTicks = this.advanceUntilDecisionGate(this.maxTicksPerStep());
    const observation = this.requireObservation();
    return Object.freeze({
      observation,
      actionMask: observation.actionMask,
      info: this.info(physicalTicks, null, "RUNNING", []),
    });
  }

  public step(action: PlayerActionCommand): EnvironmentStepResult {
    const session = this.requireSession();
    const gate = this.requireGate();
    if (this.done) throw new Error("Environment episode is done; call reset() before step()");
    if (!gate.isWaiting()) throw new Error("Environment is not at a decision boundary");
    this.assertAllowed(action, this.requireObservation().actionMask);

    const previousRecordSequence = this.latestControlledDecision()?.sequence ?? 0;
    gate.submit(action);
    let physicalTicks = 0;
    let reason: EnvironmentTransitionInfo["reason"] = "RUNNING";
    const stepLimit = this.maxTicksPerStep();
    const events: MatchEvent[] = [];

    while (!session.isFinished() && physicalTicks < stepLimit) {
      session.advance(ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
      events.push(...session.latestEvents());
      physicalTicks++;
      this.totalPhysicalTicks++;
      if (this.reachedEpisodeTickLimit()) {
        reason = "PHYSICAL_TICK_LIMIT";
        break;
      }
      const actionWasConsumed = (this.latestControlledDecision()?.sequence ?? 0) > previousRecordSequence;
      if (actionWasConsumed && gate.isWaiting()) break;
    }

    this.decisionSteps++;
    const terminated = session.isFinished();
    let truncated = false;
    if (terminated) reason = "MATCH_FINISHED";
    else if (reason === "PHYSICAL_TICK_LIMIT") truncated = true;
    else if (this.decisionSteps >= (this.options.maxDecisionSteps ?? Number.POSITIVE_INFINITY)) {
      truncated = true;
      reason = "DECISION_LIMIT";
    } else if (!gate.isWaiting()) {
      truncated = true;
      reason = "STEP_SAFETY_LIMIT";
    }
    this.done = terminated || truncated;

    const observation = this.requireObservation();
    const decision = this.latestControlledDecision();
    return Object.freeze({
      observation,
      actionMask: observation.actionMask,
      reward: 0 as const,
      terminated,
      truncated,
      info: this.info(physicalTicks, decision, reason, events),
    });
  }

  public isDone(): boolean { return this.done; }
  public currentObservation(): ActorObservation { return this.requireObservation(); }
  public privilegedCriticObservation(): PrivilegedCriticObservation {
    return this.requireSession().privilegedCriticObservation(this.options.playerId);
  }
  public debugObservation(): DebugObservation {
    return this.requireSession().debugObservation(this.options.playerId);
  }

  private advanceUntilDecisionGate(limit: number): number {
    const session = this.requireSession();
    const gate = this.requireGate();
    let ticks = 0;
    while (!session.isFinished() && !gate.isWaiting() && ticks < limit) {
      session.advance(ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
      ticks++;
      this.totalPhysicalTicks++;
    }
    if (!gate.isWaiting()) {
      throw new Error(session.isFinished()
        ? `Match finished before ${this.options.playerId} reached a decision boundary`
        : `No decision boundary within ${limit} physical ticks`);
    }
    return ticks;
  }

  private assertAllowed(command: PlayerActionCommand, mask: PlayerActionMask): void {
    const requested = commandDecision(command);
    const action = PLAYER_ACTION_SPACE.actionForType(requested.type);
    const entry = mask.entries[action.index];
    const target = requested.targetId ?? null;
    if (!entry.enabled || !entry.validTargetIds.includes(target)) {
      throw new Error(`Action ${action.id}${requested.targetId ? `:${requested.targetId}` : ""} is masked at this decision boundary`);
    }
  }

  private latestControlledDecision(): PolicyDecisionRecord | null {
    const records = this.requireSession().policyTranscript();
    return [...records].reverse().find(record => record.playerId === this.options.playerId) ?? null;
  }

  private requireObservation(): ActorObservation {
    const observation = this.requireSession().actorObservation(this.options.playerId);
    if (!observation) throw new Error(`No actor observation for ${this.options.playerId}`);
    return observation;
  }

  private requireSession(): MatchSession {
    if (!this.session) throw new Error("Environment is not initialized; call reset() first");
    return this.session;
  }

  private requireGate(): DecisionGatePlayerPolicy {
    if (!this.gate) throw new Error("Environment is not initialized; call reset() first");
    return this.gate;
  }

  private info(
    physicalTicks: number,
    decision: PolicyDecisionRecord | null,
    reason: EnvironmentTransitionInfo["reason"],
    events: readonly MatchEvent[],
  ): EnvironmentTransitionInfo {
    return Object.freeze({
      seed: this.seed,
      playerId: this.options.playerId,
      decisionStep: this.decisionSteps,
      physicalTicks,
      totalPhysicalTicks: this.totalPhysicalTicks,
      matchSecond: this.requireObservation().matchSecond,
      decision,
      events: Object.freeze([...events]),
      reason,
    });
  }

  private reachedEpisodeTickLimit(): boolean {
    return this.totalPhysicalTicks >= (this.options.maxEpisodePhysicalTicks ?? Number.POSITIVE_INFINITY);
  }

  private maxTicksPerStep(): number {
    return this.options.maxPhysicalTicksPerStep ?? 10_000;
  }

  private validateLimit(value: number | undefined, name: string): void {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
}
