import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PlayerAttributes } from "../../../domain/player";
import {
  ActionExecutionProfile,
  getActionExecutionProfile,
} from "./ActionExecutionProfile";

export enum ActionExecutionPhase {
  IDLE = "IDLE",
  PREPARING = "PREPARING",
  EXECUTING = "EXECUTING",
  RECOVERING = "RECOVERING",
  COMPLETED = "COMPLETED",
}

export type ActionInterruptionReason =
  | "TACKLE"
  | "INTERCEPTION"
  | "BLOCK"
  | "COLLISION"
  | "LOSS_OF_BALANCE";

export interface ActionExecutionTiming {
  readonly windupSeconds: number;
  readonly recoverySeconds: number;
  readonly balanceCost: number;
  readonly stabilityCost: number;
}

export class ActionExecution {
  public phase: ActionExecutionPhase = ActionExecutionPhase.IDLE;
  public readonly timing: ActionExecutionTiming;
  public readonly startedAt: number;
  public readonly executeAt: number;
  public recoveryUntil: number;
  public interruptionReason?: ActionInterruptionReason;

  private constructor(
    public readonly decision: Decision,
    private readonly player: PlayerMatchState,
    timing: ActionExecutionTiming,
    startedAt: number,
    private readonly profile: ActionExecutionProfile,
  ) {
    this.timing = timing;
    this.startedAt = startedAt;
    this.executeAt = startedAt + timing.windupSeconds;
    this.recoveryUntil = this.executeAt + timing.recoverySeconds;
  }

  public get type(): DecisionType {
    return this.decision.type;
  }

  public static start(
    decision: Decision,
    player: PlayerMatchState,
    currentTime: number,
  ): ActionExecution | undefined {
    const profile = getActionExecutionProfile(decision.type);
    if (!profile) return undefined;

    const timing = calculateTiming(profile, player.player.attributes);
    const execution = new ActionExecution(
      decision,
      player,
      timing,
      currentTime,
      profile,
    );

    execution.begin(currentTime);
    return execution;
  }

  /**
   * Advance lifecycle. With large ticks (e.g. 2s) a near-zero windup action
   * must be able to reach EXECUTING in the same advance call that starts it.
   */
  public advance(currentTime: number): ActionExecutionPhase {
    if (this.phase === ActionExecutionPhase.COMPLETED) return this.phase;

    if (this.phase === ActionExecutionPhase.PREPARING && currentTime >= this.executeAt) {
      this.phase = ActionExecutionPhase.EXECUTING;
      return this.phase;
    }

    if (this.phase === ActionExecutionPhase.EXECUTING) {
      // Stay in EXECUTING until the scheduler resolves the outcome, then
      // markStepResolved advances into RECOVERING.
      return this.phase;
    }

    if (this.phase === ActionExecutionPhase.RECOVERING && currentTime >= this.recoveryUntil) {
      this.phase = ActionExecutionPhase.COMPLETED;
      this.finishRecovery();
    }

    return this.phase;
  }

  public interrupt(
    reason: ActionInterruptionReason,
    currentTime: number,
  ): boolean {
    if (
      this.phase === ActionExecutionPhase.IDLE ||
      this.phase === ActionExecutionPhase.COMPLETED
    ) {
      return false;
    }

    this.interruptionReason = reason;
    this.phase = ActionExecutionPhase.RECOVERING;

    const interruptionRecovery = getInterruptionRecoverySeconds(reason);
    this.recoveryUntil = Math.max(
      this.recoveryUntil,
      currentTime + interruptionRecovery,
    );

    this.player.actionLockUntil = currentTime;
    this.player.recoveryUntil = this.recoveryUntil;

    if (reason === "TACKLE" || reason === "COLLISION") {
      this.player.bodyState = "FALLING";
    }

    return true;
  }

  public isBusy(): boolean {
    return this.phase !== ActionExecutionPhase.IDLE
      && this.phase !== ActionExecutionPhase.COMPLETED;
  }

  private begin(currentTime: number): void {
    this.phase = ActionExecutionPhase.PREPARING;

    this.player.balance = subtractStateCost(this.player.balance, this.timing.balanceCost);
    this.player.stability = subtractStateCost(this.player.stability, this.timing.stabilityCost);

    if (this.profile.resultingBodyState) {
      this.player.bodyState = this.profile.resultingBodyState;
    }

    this.player.actionLockUntil = this.executeAt;
    this.player.recoveryUntil = this.recoveryUntil;
    this.player.lastActionType = this.decision.type;

    // Zero / elapsed windup → ready to execute immediately.
    if (currentTime >= this.executeAt) {
      this.phase = ActionExecutionPhase.EXECUTING;
    }
  }

  private finishRecovery(): void {
    if (this.player.bodyState === "GROUND" || this.player.bodyState === "FALLING") {
      this.player.bodyState = "STANDING";
    } else if (this.player.bodyState === "LEANING") {
      this.player.bodyState = "BALANCED";
    }
  }
}

function getInterruptionRecoverySeconds(reason: ActionInterruptionReason): number {
  switch (reason) {
    case "TACKLE": return 0.45;
    case "COLLISION": return 0.35;
    case "INTERCEPTION": return 0.20;
    case "BLOCK": return 0.25;
    case "LOSS_OF_BALANCE": return 0.30;
  }
}

function calculateTiming(
  profile: ActionExecutionProfile,
  attributes: PlayerAttributes,
): ActionExecutionTiming {
  return {
    windupSeconds: profile.windupSeconds * getAttributeMultiplier(
      profile.attributeInfluence?.windup, attributes, { min: 0.70, max: 1.30 },
    ),
    recoverySeconds: profile.recoverySeconds * getAttributeMultiplier(
      profile.attributeInfluence?.recovery, attributes, { min: 0.65, max: 1.40 },
    ),
    balanceCost: profile.balanceCost * getAttributeMultiplier(
      profile.attributeInfluence?.balanceCost, attributes, { min: 0.65, max: 1.35 },
    ),
    stabilityCost: profile.stabilityCost * getAttributeMultiplier(
      profile.attributeInfluence?.stabilityCost, attributes, { min: 0.65, max: 1.35 },
    ),
  };
}

function getAttributeMultiplier(
  weights: Readonly<Record<string, number>> | undefined,
  attributes: PlayerAttributes,
  bounds: { min: number; max: number },
): number {
  if (!weights) return 1;

  let weightedTotal = 0;
  let totalWeight = 0;

  for (const [attribute, weight] of Object.entries(weights)) {
    if (!weight || weight <= 0) continue;
    const value = getAttributeValue(attributes, attribute);
    if (value === undefined) continue;
    weightedTotal += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 1;

  const averageAttribute = weightedTotal / totalWeight;
  const normalizedDifference = (averageAttribute - 10) / 10;
  const multiplier = 1 - normalizedDifference * 0.30;

  return Math.max(bounds.min, Math.min(bounds.max, multiplier));
}

function getAttributeValue(
  attributes: PlayerAttributes,
  attribute: string,
): number | undefined {
  for (const group of [
    attributes.mental,
    attributes.physical,
    attributes.technical,
    attributes.goalkeeping,
  ]) {
    const value = group[attribute as keyof typeof group];
    if (typeof value === "number") return value;
  }

  return undefined;
}

function subtractStateCost(value: number, normalizedCost: number): number {
  if (value <= 1) return Math.max(0, value - normalizedCost);
  return Math.max(0, value - normalizedCost * 100);
}
