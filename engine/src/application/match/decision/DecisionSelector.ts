import { DecisionPriority } from "./DecisionPriority";
import { EvaluatedDecision } from "./EvaluatedDecision";

export class DecisionSelector {
  constructor(private readonly priority = new DecisionPriority()) {}

  public select(evaluatedDecisions: EvaluatedDecision[]): EvaluatedDecision {
    if (evaluatedDecisions.length === 0) {
      throw new Error("Cannot select from an empty decision list");
    }

    return evaluatedDecisions.reduce((best, current) => {
      const currentPriority = this.priority.get(current.decision.type);
      const bestPriority = this.priority.get(best.decision.type);

      // Transforma a prioridade em um multiplicador matemático real
      // Ex: SHOT (prioridade 3) = 1 + (3 * 0.5) = multiplicador de 2.5x
      const currentWeight = 1 + (currentPriority * 0.5);
      const bestWeight = 1 + (bestPriority * 0.5);

      const currentWeightedScore = current.finalScore * currentWeight;
      const bestWeightedScore = best.finalScore * bestWeight;

      if (currentWeightedScore > bestWeightedScore) {
        return current;
      }

      return best;
    });
  }
}