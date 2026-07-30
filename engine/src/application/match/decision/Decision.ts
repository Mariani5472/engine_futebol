import { DecisionType } from "./DecisionType";
import { UtilityReason } from "./UtilityReason";
import { UtilityComponents } from "./UtilityScore";
import { objectiveForDecision, TacticalObjective } from "./TacticalObjective";

export class Decision {
  public readonly objective: TacticalObjective;

  constructor(
    public readonly type: DecisionType,
    public readonly utility: number,
    public readonly targetId?: string,
    /** Component breakdown from the evaluator (Phase 7/8). */
    public readonly reasons?: readonly UtilityReason[],
    public readonly components?: UtilityComponents,
    objective?: TacticalObjective,
  ) {
    this.objective = objective ?? objectiveForDecision(type);
  }
}
