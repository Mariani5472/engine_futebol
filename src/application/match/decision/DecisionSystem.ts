import { ActionEvaluator } from "./ActionEvaluator";
import { Decision } from "./Decision";
import { DecisionContext } from "./DecisionContext";
import { DecisionFilter } from "./DecisionFilter";
import { DecisionSelector } from "./DecisionSelector";

export class DecisionSystem {

  constructor(
    private readonly evaluators: ActionEvaluator[],
    private readonly filter: DecisionFilter = new DecisionFilter(),
    private readonly selector: DecisionSelector = new DecisionSelector()
  ) {}

  public decide(context: DecisionContext): Decision {

    const candidates: Decision[] = [];

    for (const evaluator of this.evaluators) {

      candidates.push(...evaluator.evaluate(context));
    }

    const validDecisions = this.filter.filter(candidates);

    return this.selector.select(validDecisions);
  }
}