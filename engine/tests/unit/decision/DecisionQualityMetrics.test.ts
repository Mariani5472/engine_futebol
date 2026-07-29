import { DecisionQualityMetrics } from "../../../src/application/match/decision/DecisionQualityMetrics";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { TacticalObjective } from "../../../src/application/match/decision/TacticalObjective";

describe("DecisionQualityMetrics", () => {
  it("measures explained, progressive and goal-oriented selections", () => {
    const base = { tick:1, matchSecond:1, playerId:"p", playerName:"P", objective:TacticalObjective.CREATE_GOAL_CHANCE,
      reasons:[], hasBall:true, selected:true, rejectionReasons:[], tacticalPhase:"establishedAttack" as const,
      selectionReason:"best tactical future" };
    const report = new DecisionQualityMetrics().summarize([
      { ...base, decisionType:DecisionType.SHOT, utility:80,
        predictedOutcome:{ actionType:DecisionType.SHOT,horizons:[.5,1,2,3],possessionProbability:.6,successfulExecutionProbability:.6,
          territorialProgression:0,defensiveLinesBroken:0,shotCreationProbability:1,expectedGoalThreat:.3,turnoverProbability:.4,
          counterattackRisk:.1,spaceCreationValue:0,explanation:["clear"] } },
      { ...base, tick:2, decisionType:DecisionType.PASS, utility:70,
        predictedOutcome:{ actionType:DecisionType.PASS,horizons:[.5,1,2,3],possessionProbability:.8,successfulExecutionProbability:.8,
          territorialProgression:12,defensiveLinesBroken:1,shotCreationProbability:.2,expectedGoalThreat:.03,turnoverProbability:.2,
          counterattackRisk:.08,spaceCreationValue:.3,explanation:["progressive"] } },
    ]);
    expect(report.clearOpportunityShotRate).toBe(1);
    expect(report.progressiveActionRate).toBe(1);
    expect(report.explainedSelectionRate).toBe(1);
    expect(report.highRiskTurnoverSelectionRate).toBe(0);
  });
});
