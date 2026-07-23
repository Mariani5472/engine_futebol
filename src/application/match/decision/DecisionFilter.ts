import { Decision } from "./Decision";
export class DecisionFilter {
  public filter(decisions: Decision[]): Decision[] {
    return decisions.filter(decision => decision.utility > 0);
  }
}