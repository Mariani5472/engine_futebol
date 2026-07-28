import { DecisionContext } from "../DecisionContext";
import { Decision } from "../Decision";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { FieldThird } from "../../../../domain";

export class RiskContext {
  constructor(
    public readonly decision: Decision,
    public readonly player: PlayerMatchState,
    public readonly decisionContext: DecisionContext,
    public readonly fieldThird: FieldThird,
    /**
     * Personality adjustment in the same scale produced by PersonalityModifier.
     * Positive values mean the player tolerates more risk.
     */
    public readonly personalityRiskToleranceModifier: number = 0
  ) {}
}
