import { Decision } from "./Decision";
import { DecisionPriority } from "./DecisionPriority";
export class DecisionSelector {
  constructor(private readonly priority = new DecisionPriority()) {}
  public select(decisions: Decision[]): Decision {
    if (decisions.length === 0) {
      throw new Error(
        "Cannot select from an empty decision list"
      );
    }
    return decisions.reduce((best, current) => {
      if (current.utility > best.utility) {
        return current;
      }
      if (current.utility === best.utility) {
        return this.isHigherPriority(current, best)
          ? current
          : best;
      }
      return best;
    });
  }
  private isHigherPriority(
    current: Decision,
    best: Decision
  ): boolean {
    return (
      this.priority.get(
        current.type
      ) >
      this.priority.get(
        best.type
      )
    );
  }
}