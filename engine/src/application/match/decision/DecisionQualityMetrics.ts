import { DecisionType } from "./DecisionType";
import type { DecisionDebugEntry } from "./DecisionDebug";

export interface DecisionQualityReport {
  readonly observedSelections: number;
  readonly candidateDiversity: number;
  readonly clearOpportunityShotRate: number;
  readonly progressiveActionRate: number;
  readonly highRiskTurnoverSelectionRate: number;
  readonly explainedSelectionRate: number;
  readonly intentContinuityRate: number;
  readonly phaseChangesPerHundredDecisions: number;
}

export class DecisionQualityMetrics {
  public summarize(entries: readonly DecisionDebugEntry[]): DecisionQualityReport {
    const selected = entries.filter(entry => entry.selected);
    const clear = selected.filter(entry => (entry.predictedOutcome?.expectedGoalThreat ?? 0) >= .12);
    const clearShots = clear.filter(entry => entry.decisionType === DecisionType.SHOT);
    const progressive = selected.filter(entry => (entry.predictedOutcome?.territorialProgression ?? 0) >= 5
      || (entry.predictedOutcome?.shotCreationProbability ?? 0) >= .35);
    const risky = selected.filter(entry => (entry.predictedOutcome?.turnoverProbability ?? 0) > .62
      && (entry.predictedOutcome?.counterattackRisk ?? 0) > .35);
    const types = new Set(selected.map(entry => entry.decisionType));
    let phaseChanges = 0;
    for (let index = 1; index < selected.length; index++)
      if (selected[index].tacticalPhase !== selected[index - 1].tacticalPhase) phaseChanges++;
    return {
      observedSelections: selected.length,
      candidateDiversity: types.size,
      clearOpportunityShotRate: ratio(clearShots.length, clear.length),
      progressiveActionRate: ratio(progressive.length, selected.length),
      highRiskTurnoverSelectionRate: ratio(risky.length, selected.length),
      explainedSelectionRate: ratio(selected.filter(entry => Boolean(entry.selectionReason)).length, selected.length),
      intentContinuityRate: ratio(selected.filter(entry => Boolean(entry.currentIntent)).length, selected.length),
      phaseChangesPerHundredDecisions: selected.length ? phaseChanges / selected.length * 100 : 0,
    };
  }
}

const ratio=(numerator:number,denominator:number):number=>denominator?numerator/denominator:0;
