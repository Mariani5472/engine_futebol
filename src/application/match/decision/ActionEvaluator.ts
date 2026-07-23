import { DecisionContext } from "./DecisionContext";
import { Decision } from "./Decision";
export interface ActionEvaluator {
  generate(context: DecisionContext): Decision[];
}