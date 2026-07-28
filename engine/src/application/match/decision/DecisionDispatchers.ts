import { Decision } from "./Decision";
import { DecisionContext } from "./DecisionContext";

export interface DecisionSystemLike {
  decide(context: DecisionContext): Decision;
}
