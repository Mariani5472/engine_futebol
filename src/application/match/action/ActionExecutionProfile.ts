import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PlayerAttributes } from "../../../domain/player";

export type BodyState =
  | "STANDING"
  | "BALANCED"
  | "LEANING"
  | "FALLING"
  | "GROUND";

type AttributePath =
  | keyof PlayerAttributes["mental"]
  | keyof PlayerAttributes["physical"]
  | keyof PlayerAttributes["technical"]
  | keyof PlayerAttributes["goalkeeping"];

type AttributeWeights = Readonly<Partial<Record<AttributePath, number>>>;

export interface ActionExecutionProfile {
  readonly windupSeconds: number;
  readonly recoverySeconds: number;
  readonly balanceCost: number;
  readonly stabilityCost: number;
  readonly resultingBodyState?: BodyState;
  /** Whether the action can be interrupted by a new action during recovery. */
  readonly canInterrupt: boolean;

  /**
   * Attribute influence for each physical part of the action.
   * Values are weights, not direct attribute values.
   */
  readonly attributeInfluence?: {
    readonly windup?: AttributeWeights;
    readonly recovery?: AttributeWeights;
    readonly balanceCost?: AttributeWeights;
    readonly stabilityCost?: AttributeWeights;
  };
}

interface ProfileOptions {
  readonly windup?: AttributeWeights;
  readonly recovery?: AttributeWeights;
  readonly balanceCost?: AttributeWeights;
  readonly stabilityCost?: AttributeWeights;
}

const profile = (
  windupSeconds: number,
  recoverySeconds: number,
  balanceCost: number,
  stabilityCost: number,
  resultingBodyState: BodyState,
  canInterrupt = false,
  attributeInfluence?: ProfileOptions
): ActionExecutionProfile => ({
  windupSeconds,
  recoverySeconds,
  balanceCost,
  stabilityCost,
  resultingBodyState,
  canInterrupt,
  attributeInfluence,
});

/**
 * Transient physical cost of an action.
 *
 * Base values describe an average player with attributes around 10/20.
 * Attribute modifiers are applied at execution time. They do not change the
 * evaluator's decision utility; they change how quickly and efficiently the
 * selected action is physically performed.
 */
export const ACTION_EXECUTION_PROFILES: Readonly<
  Partial<Record<DecisionType, ActionExecutionProfile>>
> = {
  [DecisionType.PASS]: profile(0.12, 0.22, 0.04, 0.02, "LEANING", false, {
    windup: { passing: 0.60, technique: 0.25, firstTouch: 0.15 },
    recovery: { agility: 0.45, balance: 0.35, stamina: 0.20 },
    balanceCost: { technique: 0.45, balance: 0.35, agility: 0.20 },
    stabilityCost: { balance: 0.55, agility: 0.25, technique: 0.20 },
  }),

  [DecisionType.CROSS]: profile(0.22, 0.32, 0.07, 0.04, "LEANING", false, {
    windup: { crossing: 0.50, technique: 0.30, agility: 0.20 },
    recovery: { agility: 0.40, balance: 0.35, stamina: 0.25 },
    balanceCost: { crossing: 0.35, technique: 0.30, balance: 0.35 },
    stabilityCost: { balance: 0.50, agility: 0.30, technique: 0.20 },
  }),

  [DecisionType.SHOT]: profile(0.25, 0.38, 0.10, 0.06, "LEANING", false, {
    windup: { finishing: 0.45, technique: 0.35, agility: 0.20 },
    recovery: { agility: 0.40, balance: 0.35, stamina: 0.25 },
    balanceCost: { technique: 0.35, balance: 0.35, agility: 0.30 },
    stabilityCost: { balance: 0.45, agility: 0.30, strength: 0.25 },
  }),

  [DecisionType.DRIBBLE]: profile(0.08, 0.12, 0.03, 0.01, "BALANCED", true, {
    windup: { dribbling: 0.45, agility: 0.35, technique: 0.20 },
    recovery: { agility: 0.45, balance: 0.35, stamina: 0.20 },
    balanceCost: { dribbling: 0.40, agility: 0.35, balance: 0.25 },
    stabilityCost: { agility: 0.45, balance: 0.35, technique: 0.20 },
  }),

  [DecisionType.SKILL_MOVE]: profile(0.18, 0.24, 0.08, 0.04, "LEANING", false, {
    windup: { dribbling: 0.40, technique: 0.30, agility: 0.30 },
    recovery: { agility: 0.50, balance: 0.30, stamina: 0.20 },
    balanceCost: { dribbling: 0.35, agility: 0.35, balance: 0.30 },
    stabilityCost: { agility: 0.40, balance: 0.40, technique: 0.20 },
  }),

  [DecisionType.FAKE]: profile(0.10, 0.14, 0.03, 0.02, "BALANCED", true, {
    windup: { dribbling: 0.40, technique: 0.30, agility: 0.30 },
    recovery: { agility: 0.50, balance: 0.30, stamina: 0.20 },
    balanceCost: { dribbling: 0.40, agility: 0.35, balance: 0.25 },
    stabilityCost: { agility: 0.45, balance: 0.35, technique: 0.20 },
  }),

  [DecisionType.HOLD_BALL]: profile(0.05, 0.05, 0.01, 0.00, "BALANCED", true, {
    windup: { technique: 0.40, balance: 0.35, strength: 0.25 },
    recovery: { balance: 0.50, agility: 0.25, stamina: 0.25 },
    balanceCost: { strength: 0.40, balance: 0.40, technique: 0.20 },
  }),

  [DecisionType.CONTROL]: profile(0.10, 0.12, 0.02, 0.01, "BALANCED", true, {
    windup: { firstTouch: 0.60, technique: 0.25, agility: 0.15 },
    recovery: { agility: 0.45, balance: 0.35, stamina: 0.20 },
    balanceCost: { firstTouch: 0.40, balance: 0.35, agility: 0.25 },
    stabilityCost: { firstTouch: 0.40, balance: 0.40, agility: 0.20 },
  }),

  [DecisionType.RECEIVE]: profile(0.08, 0.10, 0.02, 0.01, "BALANCED", true, {
    windup: { firstTouch: 0.55, technique: 0.25, agility: 0.20 },
    recovery: { agility: 0.45, balance: 0.35, stamina: 0.20 },
    balanceCost: { firstTouch: 0.40, balance: 0.35, agility: 0.25 },
    stabilityCost: { firstTouch: 0.40, balance: 0.40, agility: 0.20 },
  }),

  [DecisionType.HEADER]: profile(0.18, 0.25, 0.06, 0.04, "LEANING", false, {
    windup: { heading: 0.45, jumpingReach: 0.35, agility: 0.20 },
    recovery: { agility: 0.35, balance: 0.35, strength: 0.15, stamina: 0.15 },
    balanceCost: { heading: 0.30, jumpingReach: 0.25, balance: 0.45 },
    stabilityCost: { balance: 0.45, agility: 0.30, strength: 0.25 },
  }),

  [DecisionType.CLEAR]: profile(0.18, 0.28, 0.08, 0.05, "LEANING", false, {
    windup: { technique: 0.35, strength: 0.30, kicking: 0.20, agility: 0.15 },
    recovery: { agility: 0.40, balance: 0.35, stamina: 0.25 },
    balanceCost: { technique: 0.30, strength: 0.25, balance: 0.45 },
    stabilityCost: { balance: 0.45, agility: 0.30, strength: 0.25 },
  }),

  [DecisionType.TACKLE]: profile(0.28, 0.85, 0.35, 0.20, "FALLING", false, {
    windup: { tackling: 0.45, agility: 0.30, acceleration: 0.15, bravery: 0.10 },
    recovery: { agility: 0.35, balance: 0.25, strength: 0.20, stamina: 0.20 },
    balanceCost: { tackling: 0.25, agility: 0.25, balance: 0.25, strength: 0.25 },
    stabilityCost: { balance: 0.35, agility: 0.25, strength: 0.25, stamina: 0.15 },
  }),

  [DecisionType.INTERCEPT]: profile(0.16, 0.28, 0.10, 0.06, "LEANING", false, {
    windup: { anticipation: 0.40, acceleration: 0.30, agility: 0.20, positioning: 0.10 },
    recovery: { agility: 0.40, balance: 0.30, stamina: 0.30 },
    balanceCost: { agility: 0.35, acceleration: 0.25, balance: 0.25, anticipation: 0.15 },
    stabilityCost: { balance: 0.45, agility: 0.35, stamina: 0.20 },
  }),

  [DecisionType.BLOCK]: profile(0.18, 0.40, 0.15, 0.10, "FALLING", false, {
    windup: { bravery: 0.30, anticipation: 0.25, agility: 0.25, positioning: 0.20 },
    recovery: { agility: 0.35, balance: 0.30, strength: 0.20, stamina: 0.15 },
    balanceCost: { bravery: 0.20, agility: 0.25, balance: 0.30, strength: 0.25 },
    stabilityCost: { balance: 0.35, strength: 0.30, agility: 0.20, bravery: 0.15 },
  }),

  [DecisionType.PRESS]: profile(0.00, 0.04, 0.01, 0.00, "BALANCED", true, {
    recovery: { acceleration: 0.40, stamina: 0.35, agility: 0.25 },
    balanceCost: { stamina: 0.45, acceleration: 0.30, agility: 0.25 },
  }),

  [DecisionType.MARK]: profile(0.00, 0.02, 0.005, 0.00, "BALANCED", true, {
    recovery: { agility: 0.45, stamina: 0.30, balance: 0.25 },
    balanceCost: { agility: 0.40, positioning: 0.35, stamina: 0.25 },
  }),

  [DecisionType.COVER]: profile(0.00, 0.02, 0.005, 0.00, "BALANCED", true, {
    recovery: { agility: 0.40, stamina: 0.35, balance: 0.25 },
    balanceCost: { positioning: 0.40, agility: 0.35, stamina: 0.25 },
  }),

  [DecisionType.MOVE]: profile(0.00, 0.00, 0.00, 0.00, "BALANCED", true, {
    recovery: { acceleration: 0.35, agility: 0.30, stamina: 0.35 },
  }),

  [DecisionType.POSITION]: profile(0.00, 0.00, 0.00, 0.00, "BALANCED", true, {
    recovery: { positioning: 0.45, agility: 0.25, stamina: 0.30 },
  }),

  [DecisionType.SET_PIECE]: profile(0.20, 0.30, 0.04, 0.03, "BALANCED", false, {
    windup: { technique: 0.35, composure: 0.25, decisions: 0.20, concentration: 0.20 },
    recovery: { agility: 0.40, balance: 0.35, stamina: 0.25 },
    balanceCost: { technique: 0.40, balance: 0.35, agility: 0.25 },
    stabilityCost: { composure: 0.35, concentration: 0.35, balance: 0.30 },
  }),

  [DecisionType.GK_CLAIM]: profile(0.22, 0.55, 0.18, 0.12, "GROUND", false, {
    windup: { aerialReach: 0.35, handling: 0.30, rushingOut: 0.20, bravery: 0.15 },
    recovery: { agility: 0.30, balance: 0.25, strength: 0.20, naturalFitness: 0.25 },
    balanceCost: { aerialReach: 0.25, handling: 0.25, bravery: 0.20, balance: 0.30 },
    stabilityCost: { balance: 0.30, strength: 0.25, agility: 0.20, bravery: 0.25 },
  }),

  [DecisionType.GK_DISTRIBUTE]: profile(0.20, 0.30, 0.04, 0.03, "BALANCED", false, {
    windup: { throwing: 0.45, kicking: 0.30, technique: 0.25 },
    recovery: { agility: 0.40, balance: 0.35, stamina: 0.25 },
    balanceCost: { throwing: 0.30, kicking: 0.30, balance: 0.40 },
    stabilityCost: { balance: 0.45, technique: 0.30, agility: 0.25 },
  }),

  [DecisionType.TACTICAL_FOUL]: profile(0.18, 0.55, 0.18, 0.10, "LEANING", false, {
    windup: { tackling: 0.35, aggression: 0.25, anticipation: 0.20, bravery: 0.20 },
    recovery: { agility: 0.35, balance: 0.30, strength: 0.20, stamina: 0.15 },
    balanceCost: { tackling: 0.25, aggression: 0.20, strength: 0.25, balance: 0.30 },
    stabilityCost: { balance: 0.35, agility: 0.25, strength: 0.25, aggression: 0.15 },
  }),
};

export function getActionExecutionProfile(
  decisionType: DecisionType
): ActionExecutionProfile | undefined {
  return ACTION_EXECUTION_PROFILES[decisionType];
}

export function applyActionExecutionProfile(
  player: PlayerMatchState,
  decisionType: DecisionType,
  currentTick: number,
  deltaTime: number,
  executed: boolean
): void {
  const executionProfile = getActionExecutionProfile(decisionType);
  if (!executionProfile || !executed) return;

  const attributes = player.player.attributes;
  const windupMultiplier = getAttributeMultiplier(
    executionProfile.attributeInfluence?.windup,
    attributes,
    { min: 0.70, max: 1.30 }
  );
  const recoveryMultiplier = getAttributeMultiplier(
    executionProfile.attributeInfluence?.recovery,
    attributes,
    { min: 0.65, max: 1.40 }
  );
  const balanceCostMultiplier = getAttributeMultiplier(
    executionProfile.attributeInfluence?.balanceCost,
    attributes,
    { min: 0.65, max: 1.35 }
  );
  const stabilityCostMultiplier = getAttributeMultiplier(
    executionProfile.attributeInfluence?.stabilityCost,
    attributes,
    { min: 0.65, max: 1.35 }
  );

  const effectiveWindupSeconds = executionProfile.windupSeconds * windupMultiplier;
  const effectiveRecoverySeconds = executionProfile.recoverySeconds * recoveryMultiplier;
  const effectiveBalanceCost = executionProfile.balanceCost * balanceCostMultiplier;
  const effectiveStabilityCost = executionProfile.stabilityCost * stabilityCostMultiplier;

  const tickDuration = Math.max(0.001, deltaTime);
  const windupTicks = Math.ceil(effectiveWindupSeconds / tickDuration);
  const recoveryTicks = Math.ceil(effectiveRecoverySeconds / tickDuration);

  player.actionLockUntil = Math.max(
    player.actionLockUntil,
    currentTick + windupTicks
  );
  player.recoveryUntil = Math.max(
    player.recoveryUntil,
    currentTick + windupTicks + recoveryTicks
  );

  player.balance = subtractStateCost(player.balance, effectiveBalanceCost);
  player.stability = subtractStateCost(
    player.stability,
    effectiveStabilityCost
  );

  if (executionProfile.resultingBodyState) {
    player.bodyState = executionProfile.resultingBodyState;
  }

  player.lastActionType = decisionType;
}

/**
 * Passive physical recovery. This is deliberately independent of decision
 * selection: a player can recover while moving, thinking, or being evaluated.
 */
export function recoverActionState(
  player: PlayerMatchState,
  currentTick: number,
  deltaTime: number
): void {
  const recoveryFinished = currentTick >= player.recoveryUntil;
  const scale = player.balance <= 1 ? 1 : 100;
  const recoveryAmount = deltaTime * 0.08 * scale;

  player.balance = Math.min(scale, player.balance + recoveryAmount);
  player.stability = Math.min(scale, player.stability + recoveryAmount * 0.75);

  if (recoveryFinished) {
    if (player.bodyState === "GROUND" || player.bodyState === "FALLING") {
      player.bodyState = "STANDING";
    } else if (player.bodyState === "LEANING") {
      player.bodyState = "BALANCED";
    }
  }
}

function getAttributeMultiplier(
  weights: AttributeWeights | undefined,
  attributes: PlayerAttributes,
  bounds: { min: number; max: number }
): number {
  if (!weights) return 1;

  let weightedTotal = 0;
  let totalWeight = 0;

  for (const [attribute, weight] of Object.entries(weights)) {
    if (!weight || weight <= 0) continue;

    const value = getAttributeValue(attributes, attribute as AttributePath);
    if (value === undefined) continue;

    weightedTotal += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 1;

  const averageAttribute = weightedTotal / totalWeight;

  // 10/20 is the neutral reference point. A player with 20 in the relevant
  // attributes is faster/more efficient; a player with 1 is slower/more costly.
  const normalizedDifference = (averageAttribute - 10) / 10;
  const multiplier = 1 - normalizedDifference * 0.30;

  return Math.max(bounds.min, Math.min(bounds.max, multiplier));
}

function getAttributeValue(
  attributes: PlayerAttributes,
  attribute: AttributePath
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
  if (value <= 1) {
    return Math.max(0, value - normalizedCost);
  }

  return Math.max(0, value - normalizedCost * 100);
}
