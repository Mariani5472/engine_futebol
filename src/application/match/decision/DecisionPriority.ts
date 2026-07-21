import { DecisionType } from "./DecisionType";

export class DecisionPriority {

  private readonly priorities: Record<DecisionType, number> = {
    [DecisionType.NONE]: 0,
    [DecisionType.PASS]: 2,
    [DecisionType.SHOT]: 3,
    [DecisionType.DRIBBLE]: 0,
    [DecisionType.HOLD_BALL]: 1,
    [DecisionType.CLEAR]: 0,
    [DecisionType.PRESS]: 0,
    [DecisionType.TACKLE]: 0,
    [DecisionType.MARK]: 0,
    [DecisionType.COVER]: 0,
    [DecisionType.MOVE]: 0,
    [DecisionType.RECEIVE]: 0,
  };

  public get(type: DecisionType): number {
    return this.priorities[type] ?? 0;
  }
}