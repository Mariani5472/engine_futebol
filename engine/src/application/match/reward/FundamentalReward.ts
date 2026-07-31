import type { FundamentalScenarioOutcome } from "../scenario/contracts/FundamentalScenarioOutcome";

export const FUNDAMENTAL_REWARD_VERSION = 1 as const;

export type FundamentalRewardComponentId = "DECISION_COST" | "DISTANCE_PROGRESS" | "SEMANTIC_OUTCOME";

export interface FundamentalRewardComponent {
  readonly id: FundamentalRewardComponentId;
  readonly value: number;
  readonly explanation: string;
  readonly source: "DECISION_BOUNDARY" | "OBSERVED_TRANSITION" | "AUTHORITATIVE_EVENT";
}

export interface FundamentalRewardBreakdown {
  readonly version: typeof FUNDAMENTAL_REWARD_VERSION;
  readonly outcome: FundamentalScenarioOutcome | null;
  readonly components: readonly FundamentalRewardComponent[];
  readonly total: number;
}

const OUTCOME_REWARD: Readonly<Record<FundamentalScenarioOutcome, number>> = Object.freeze({
  TARGET_REACHED: 1,
  BALL_CONTROLLED: 1,
  PASS_COMPLETED: 1,
  PASS_INTERCEPTED: -0.5,
  GOAL: 1,
  SAVED_CAUGHT: -0.1,
  SAVED_PARRIED: 0,
  BLOCKED: -0.2,
  OFF_TARGET: -0.35,
  POST: 0.1,
  CROSSBAR: 0.1,
  POSSESSION_LOST: -0.5,
  BALL_OUT: -0.4,
  TIMEOUT: -0.5,
});

export function fundamentalReward(
  outcome: FundamentalScenarioOutcome | null,
  distanceProgress = 0,
): FundamentalRewardBreakdown {
  const components: FundamentalRewardComponent[] = [{
    id: "DECISION_COST", value: -0.01,
    explanation: "Cost of consuming one agent decision boundary.", source: "DECISION_BOUNDARY",
  }];
  const progress = Math.max(-0.1, Math.min(0.1, distanceProgress));
  if (Math.abs(progress) > 1e-12) components.push({
    id: "DISTANCE_PROGRESS", value: progress,
    explanation: "Normalized reduction in distance to the declared scenario target.", source: "OBSERVED_TRANSITION",
  });
  if (outcome) components.push({
    id: "SEMANTIC_OUTCOME", value: OUTCOME_REWARD[outcome],
    explanation: `Authoritative fundamental outcome: ${outcome}.`, source: "AUTHORITATIVE_EVENT",
  });
  const frozen = Object.freeze(components.map(component => Object.freeze(component)));
  return Object.freeze({
    version: FUNDAMENTAL_REWARD_VERSION,
    outcome,
    components: frozen,
    total: reconstructFundamentalReward(frozen),
  });
}

export function reconstructFundamentalReward(components: readonly Pick<FundamentalRewardComponent, "value">[]): number {
  return components.reduce((total, component) => total + component.value, 0);
}

export function verifyFundamentalReward(breakdown: FundamentalRewardBreakdown): boolean {
  return breakdown.version === FUNDAMENTAL_REWARD_VERSION
    && Number.isFinite(breakdown.total)
    && Math.abs(reconstructFundamentalReward(breakdown.components) - breakdown.total) <= 1e-12;
}
