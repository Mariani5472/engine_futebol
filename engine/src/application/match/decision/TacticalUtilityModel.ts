import type { DecisionContext } from "./DecisionContext";
import { DecisionType } from "./DecisionType";
import type { PredictedActionOutcome, TacticalUtility } from "../tactical/intelligence/TacticalIntelligenceTypes";

/** Goal-oriented utility with role, match state and defensive responsibility modifiers. */
export class TacticalUtilityModel {
  public calculate(outcome: PredictedActionOutcome, context: DecisionContext): TacticalUtility {
    const team = context.match.home.players.includes(context.player) ? context.match.home : context.match.away;
    const opponent = team === context.match.home ? context.match.away : context.match.home;
    const role = String(context.player.currentRole);
    const late = clamp((context.match.currentSecond - 60 * 60) / (30 * 60), 0, 1);
    const deficit = opponent.score - team.score;
    const attackWeight = clamp(1 + late * deficit * .24, .72, 1.5);
    const securityWeight = clamp(1 - late * deficit * .15, .72, 1.45);
    const isDefensiveRole = role.includes("BACK") || role.includes("DEFENSIVE") || role.includes("GOALKEEPER");
    const isAttackingRole = role.includes("STRIKER") || role.includes("WINGER") || role.includes("FORWARD") || role.includes("ATTACKING");
    const physicalCondition = clamp(1 - context.player.fatigue / 130, .55, 1);
    const goalValue = outcome.expectedGoalThreat * 38 * attackWeight * (isAttackingRole ? 1.12 : 1);
    const chanceCreationValue = outcome.shotCreationProbability * 13 * attackWeight;
    const progressionValue = clamp(outcome.territorialProgression / 18, -1, 1.5) * 8 * (isAttackingRole ? 1.08 : 1);
    const possessionValue = outcome.possessionProbability * 6;
    const spaceCreationValue = outcome.spaceCreationValue * 5;
    const defensiveSecurityValue = (1 - outcome.counterattackRisk) * (isDefensiveRole ? 5 : 2.5) * securityWeight;
    const turnoverRisk = outcome.turnoverProbability * 9 * securityWeight;
    const counterattackRisk = outcome.counterattackRisk * (isDefensiveRole ? 15 : 11) * securityWeight;
    const executionRisk = (1 - outcome.successfulExecutionProbability) * 4 / physicalCondition;
    const total = goalValue + chanceCreationValue + progressionValue + possessionValue + spaceCreationValue
      + defensiveSecurityValue - turnoverRisk - counterattackRisk - executionRisk;
    return { goalValue, chanceCreationValue, progressionValue, possessionValue, spaceCreationValue,
      defensiveSecurityValue, turnoverRisk, counterattackRisk, executionRisk, total };
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
