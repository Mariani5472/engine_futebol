import {
  EvaluatedDecision,
} from "./EvaluatedDecision";

export class DecisionHysteresis {
  constructor(private readonly threshold = 3) {}

  public shouldSwitch(
    current: EvaluatedDecision | null,
    next: EvaluatedDecision
  ): boolean {
    if (!current) {
      return true;
    }

    return (
      next.finalScore >
      current.finalScore +
      this.threshold
    );
  }
}