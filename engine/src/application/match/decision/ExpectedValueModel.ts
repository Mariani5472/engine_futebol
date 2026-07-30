import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";
import { ShortHorizonPredictionSystem } from "./ShortHorizonPredictionSystem";
import { TacticalUtilityModel } from "./TacticalUtilityModel";
import type { PredictedActionOutcome, TacticalUtility } from "../tactical/intelligence/TacticalIntelligenceTypes";

export interface DecisionExpectedValue {
  readonly successProbability: number;
  readonly goalProbability: number;
  readonly futurePossessionValue: number;
  readonly defensiveExposure: number;
  readonly utilityModifier: number;
  readonly predictedOutcome: PredictedActionOutcome;
  readonly tacticalUtility: TacticalUtility;
}

/**
 * One explicit, bounded EV layer shared by possession actions. Evaluators still
 * describe action-specific technique and space; this layer makes their common
 * trade-off observable: execution, goal threat, retained value and exposure.
 */
export class ExpectedValueModel {
  private readonly predictor = new ShortHorizonPredictionSystem();
  private readonly utility = new TacticalUtilityModel();

  public evaluate(decision: Decision, context: DecisionContext): DecisionExpectedValue {
    const predictedOutcome = this.predictor.predict(decision, context);
    const tacticalUtility = this.utility.calculate(predictedOutcome, context);
    const successProbability = predictedOutcome.successfulExecutionProbability;
    const goalProbability = predictedOutcome.expectedGoalThreat;
    const futurePossessionValue = clamp(
      predictedOutcome.possessionProbability + predictedOutcome.territorialProgression / 35
        + predictedOutcome.spaceCreationValue * .3,
      -.4, 1.6,
    );
    const defensiveExposure = clamp(predictedOutcome.counterattackRisk, 0, 1);
    return {
      successProbability,
      goalProbability,
      futurePossessionValue,
      defensiveExposure,
      utilityModifier: clamp(tacticalUtility.total * .62 - 3, -14, 16),
      predictedOutcome,
      tacticalUtility,
    };
  }

  public apply(decision: Decision, context: DecisionContext): Decision {
    const value = this.evaluate(decision, context);
    return new Decision(
      decision.type,
      decision.utility + value.utilityModifier,
      decision.targetId,
      [
        ...(decision.reasons ?? []),
        { code: "EXPECTED_VALUE", value: value.utilityModifier },
      ],
      {
        ...(decision.components ?? {}),
        SUCCESS_PROBABILITY: value.successProbability,
        GOAL_PROBABILITY: value.goalProbability,
        FUTURE_POSSESSION_VALUE: value.futurePossessionValue,
        DEFENSIVE_EXPOSURE: -value.defensiveExposure,
        CHANCE_CREATION_VALUE: value.tacticalUtility.chanceCreationValue,
        PROGRESSION_VALUE: value.tacticalUtility.progressionValue,
        SPACE_CREATION_VALUE: value.tacticalUtility.spaceCreationValue,
        COUNTERATTACK_RISK: -value.tacticalUtility.counterattackRisk,
        EXPECTED_VALUE: value.utilityModifier,
      },
      decision.objective,
    );
  }

}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
