import { DecisionContext } from "../DecisionContext";
import { Decision } from "../Decision";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

export class RiskContext {
  constructor(
    public readonly decision: Decision,
    public readonly player: PlayerMatchState,
    public readonly decisionContext: DecisionContext
  ) {}
}