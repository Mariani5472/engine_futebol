import { DecisionContext } from "./DecisionContext";
export class UtilityContext {
  constructor(
    public readonly decision: DecisionContext,
    public readonly hasBall: boolean,
    public readonly underPressure: boolean,
    public readonly attackingThird: boolean,
    public readonly defensiveThird: boolean
  ) {}
}