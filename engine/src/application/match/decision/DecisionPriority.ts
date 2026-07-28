import { DecisionType } from "./DecisionType";

export class DecisionPriority {

  private readonly priorities: Record<string, number> = {
    [DecisionType.NONE]: 0,
    [DecisionType.PASS]: 2,
    [DecisionType.CROSS]: 2,
    [DecisionType.SHOT]: 5, // was 3 — finishing must beat safe pass/hold near goal
    [DecisionType.DRIBBLE]: 1,
    [DecisionType.HOLD_BALL]: 1,
    [DecisionType.CLEAR]: 1,
    [DecisionType.PRESS]: 0,
    [DecisionType.TACKLE]: 0,
    [DecisionType.MARK]: 0,
    [DecisionType.COVER]: 0,
    [DecisionType.MOVE]: 0,
    [DecisionType.RECEIVE]: 0,
    [DecisionType.HEADER]: 3,
    [DecisionType.CONTROL]: 1,
    [DecisionType.SKILL_MOVE]: 1,
  };

  public get(type: DecisionType): number {
    return this.priorities[type] ?? 0;
  }
}
