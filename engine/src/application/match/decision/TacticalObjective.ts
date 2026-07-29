import { DecisionType } from "./DecisionType";

export enum TacticalObjective {
  SCORE_GOAL = "SCORE_GOAL",
  CREATE_GOAL_CHANCE = "CREATE_GOAL_CHANCE",
  PROGRESS_BALL = "PROGRESS_BALL",
  MAINTAIN_POSSESSION = "MAINTAIN_POSSESSION",
  ESCAPE_PRESSURE = "ESCAPE_PRESSURE",
  SUPPORT_TEAMMATE = "SUPPORT_TEAMMATE",
  PREVENT_COUNTERATTACK = "PREVENT_COUNTERATTACK",
  PROTECT_GOAL = "PROTECT_GOAL",
  RECOVER_SHAPE = "RECOVER_SHAPE",
}

/** Stable semantic purpose for telemetry; it does not add a hidden utility bonus. */
export function objectiveForDecision(type: DecisionType): TacticalObjective {
  switch (type) {
    case DecisionType.SHOT:
    case DecisionType.HEADER:
      return TacticalObjective.SCORE_GOAL;
    case DecisionType.CROSS:
    case DecisionType.SKILL_MOVE:
    case DecisionType.FAKE:
      return TacticalObjective.CREATE_GOAL_CHANCE;
    case DecisionType.PASS:
    case DecisionType.DRIBBLE:
    case DecisionType.GK_DISTRIBUTE:
      return TacticalObjective.PROGRESS_BALL;
    case DecisionType.HOLD_BALL:
    case DecisionType.CONTROL:
    case DecisionType.RECEIVE:
      return TacticalObjective.MAINTAIN_POSSESSION;
    case DecisionType.CLEAR:
    case DecisionType.BLOCK:
    case DecisionType.GK_CLAIM:
      return TacticalObjective.PROTECT_GOAL;
    case DecisionType.TACKLE:
    case DecisionType.INTERCEPT:
    case DecisionType.TACTICAL_FOUL:
      return TacticalObjective.PREVENT_COUNTERATTACK;
    case DecisionType.PRESS:
    case DecisionType.MARK:
    case DecisionType.COVER:
      return TacticalObjective.RECOVER_SHAPE;
    case DecisionType.MOVE:
    case DecisionType.POSITION:
      return TacticalObjective.SUPPORT_TEAMMATE;
    default:
      return TacticalObjective.ESCAPE_PRESSURE;
  }
}
