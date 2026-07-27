import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";

export type BodyState =
  | "STANDING"
  | "BALANCED"
  | "LEANING"
  | "FALLING"
  | "GROUND";

export interface ActionExecutionProfile {
  readonly windupSeconds: number;
  readonly recoverySeconds: number;
  readonly balanceCost: number;
  readonly stabilityCost: number;
  readonly resultingBodyState?: BodyState;
  readonly canInterrupt: boolean;
}

const profile = (
  windupSeconds: number,
  recoverySeconds: number,
  balanceCost: number,
  stabilityCost: number,
  resultingBodyState: BodyState,
  canInterrupt = false
): ActionExecutionProfile => ({
  windupSeconds,
  recoverySeconds,
  balanceCost,
  stabilityCost,
  resultingBodyState,
  canInterrupt,
});

/**
 * Transient physical cost of an action.
 *
 * Costs are intentionally expressed as fractions of a normalized 0..1 state.
 * PlayerMatchState.applyExecutionProfile also supports the existing 0..100
 * representation, which makes this safe while the state scale is migrated.
 */
export const ACTION_EXECUTION_PROFILES: Readonly<
  Partial<Record<DecisionType, ActionExecutionProfile>>
> = {
  [DecisionType.PASS]: profile(0.12, 0.22, 0.04, 0.02, "LEANING"),
  [DecisionType.CROSS]: profile(0.22, 0.32, 0.07, 0.04, "LEANING"),
  [DecisionType.SHOT]: profile(0.25, 0.38, 0.10, 0.06, "LEANING"),
  [DecisionType.DRIBBLE]: profile(0.08, 0.12, 0.03, 0.01, "BALANCED", true),
  [DecisionType.SKILL_MOVE]: profile(0.18, 0.24, 0.08, 0.04, "LEANING"),
  [DecisionType.FAKE]: profile(0.10, 0.14, 0.03, 0.02, "BALANCED", true),
  [DecisionType.HOLD_BALL]: profile(0.05, 0.05, 0.01, 0.00, "BALANCED", true),
  [DecisionType.CONTROL]: profile(0.10, 0.12, 0.02, 0.01, "BALANCED", true),
  [DecisionType.RECEIVE]: profile(0.08, 0.10, 0.02, 0.01, "BALANCED", true),
  [DecisionType.HEADER]: profile(0.18, 0.25, 0.06, 0.04, "LEANING"),
  [DecisionType.CLEAR]: profile(0.18, 0.28, 0.08, 0.05, "LEANING"),
  [DecisionType.TACKLE]: profile(0.28, 0.85, 0.35, 0.20, "FALLING"),
  [DecisionType.INTERCEPT]: profile(0.16, 0.28, 0.10, 0.06, "LEANING"),
  [DecisionType.BLOCK]: profile(0.18, 0.40, 0.15, 0.10, "FALLING"),
  [DecisionType.PRESS]: profile(0.00, 0.04, 0.01, 0.00, "BALANCED", true),
  [DecisionType.MARK]: profile(0.00, 0.02, 0.005, 0.00, "BALANCED", true),
  [DecisionType.COVER]: profile(0.00, 0.02, 0.005, 0.00, "BALANCED", true),
  [DecisionType.MOVE]: profile(0.00, 0.00, 0.00, 0.00, "BALANCED", true),
  [DecisionType.POSITION]: profile(0.00, 0.00, 0.00, 0.00, "BALANCED", true),
  [DecisionType.SET_PIECE]: profile(0.20, 0.30, 0.04, 0.03, "BALANCED"),
  [DecisionType.GK_CLAIM]: profile(0.22, 0.55, 0.18, 0.12, "GROUND"),
  [DecisionType.GK_DISTRIBUTE]: profile(0.20, 0.30, 0.04, 0.03, "BALANCED"),
  [DecisionType.TACTICAL_FOUL]: profile(0.18, 0.55, 0.18, 0.10, "LEANING"),
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
  success: boolean
): void {
  const executionProfile = getActionExecutionProfile(decisionType);
  if (!executionProfile || !success) return;

  const tickDuration = Math.max(0.001, deltaTime);
  const windupTicks = Math.ceil(executionProfile.windupSeconds / tickDuration);
  const recoveryTicks = Math.ceil(executionProfile.recoverySeconds / tickDuration);

  player.actionLockUntil = Math.max(
    player.actionLockUntil,
    currentTick + windupTicks
  );
  player.recoveryUntil = Math.max(
    player.recoveryUntil,
    currentTick + windupTicks + recoveryTicks
  );

  player.balance = subtractStateCost(
    player.balance,
    executionProfile.balanceCost
  );
  player.stability = subtractStateCost(
    player.stability,
    executionProfile.stabilityCost
  );

  if (executionProfile.resultingBodyState) {
    player.bodyState = executionProfile.resultingBodyState;
  }

  player.lastActionType = decisionType;
}

function subtractStateCost(value: number, normalizedCost: number): number {
  if (value <= 1) {
    return Math.max(0, value - normalizedCost);
  }

  return Math.max(0, value - normalizedCost * 100);
}
