import { DecisionType } from "../decision/DecisionType";

/**
 * Physical / competitive priority of an action.
 *
 * Used by ActionArbitrator when two (or more) concurrent actions
 * compete for the same ball, space or outcome in the same tick.
 */
export enum ActionPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

const PRIORITY_MAP: Readonly<Record<DecisionType, ActionPriority>> = {
  [DecisionType.NONE]: ActionPriority.LOW,

  // Ball control / possession management
  [DecisionType.CONTROL]: ActionPriority.NORMAL,
  [DecisionType.RECEIVE]: ActionPriority.NORMAL,
  [DecisionType.HOLD_BALL]: ActionPriority.NORMAL,
  [DecisionType.PASS]: ActionPriority.NORMAL,
  [DecisionType.CROSS]: ActionPriority.NORMAL,
  [DecisionType.DRIBBLE]: ActionPriority.NORMAL,
  [DecisionType.SKILL_MOVE]: ActionPriority.NORMAL,
  [DecisionType.FAKE]: ActionPriority.NORMAL,
  [DecisionType.CLEAR]: ActionPriority.NORMAL,
  [DecisionType.GK_DISTRIBUTE]: ActionPriority.NORMAL,
  [DecisionType.SET_PIECE]: ActionPriority.NORMAL,

  // High-impact attacking / defensive actions
  [DecisionType.SHOT]: ActionPriority.HIGH,
  [DecisionType.HEADER]: ActionPriority.HIGH,
  [DecisionType.TACKLE]: ActionPriority.HIGH,
  [DecisionType.INTERCEPT]: ActionPriority.HIGH,
  [DecisionType.BLOCK]: ActionPriority.HIGH,
  [DecisionType.TACTICAL_FOUL]: ActionPriority.HIGH,

  // Goalkeeper claim is the highest-priority discrete action
  [DecisionType.GK_CLAIM]: ActionPriority.CRITICAL,

  // Continuous / positional (low competitive priority)
  [DecisionType.PRESS]: ActionPriority.LOW,
  [DecisionType.MARK]: ActionPriority.LOW,
  [DecisionType.COVER]: ActionPriority.LOW,
  [DecisionType.MOVE]: ActionPriority.LOW,
  [DecisionType.POSITION]: ActionPriority.LOW,
};

export function getActionPriority(type: DecisionType): ActionPriority {
  return PRIORITY_MAP[type] ?? ActionPriority.NORMAL;
}
