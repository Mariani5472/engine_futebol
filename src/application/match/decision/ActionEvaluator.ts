import { DecisionContext } from "./DecisionContext";
import { Decision } from "./Decision";
export interface ActionEvaluator {
  evaluate(context: DecisionContext): Decision[];
}