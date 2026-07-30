import type { AttackerVsGoalkeeperOutcome } from "../scenario/AttackerVsGoalkeeperEnvironment";

export const REWARD_VERSION = 1 as const;

export type RewardComponentId = "DECISION_COST" | "SEMANTIC_OUTCOME";

export interface RewardComponent {
  readonly id: RewardComponentId;
  readonly value: number;
  readonly explanation: string;
  readonly source: "DECISION_BOUNDARY" | "AUTHORITATIVE_OUTCOME";
}

export interface RewardBreakdownV1 {
  readonly version: typeof REWARD_VERSION;
  readonly outcome: AttackerVsGoalkeeperOutcome | null;
  readonly components: readonly RewardComponent[];
  readonly total: number;
}

export interface RewardV1Parameters {
  readonly decisionCost: number;
  readonly outcomes: Readonly<Record<AttackerVsGoalkeeperOutcome, number>>;
}

/**
 * Intentionally small and xG-free. Values are public, versioned and can be
 * reconstructed from a scenario transition's decision and semantic outcome.
 */
export const REWARD_V1_PARAMETERS: RewardV1Parameters = Object.freeze({
  decisionCost: -0.01,
  outcomes: Object.freeze({
    GOAL: 1,
    SAVED_CAUGHT: 0.15,
    SAVED_PARRIED: 0.2,
    BLOCKED: -0.1,
    OFF_TARGET: -0.2,
    POST: 0.05,
    CROSSBAR: 0.05,
    POSSESSION_LOST: -0.35,
    TIMEOUT: -0.5,
  }),
});

export function attackerVsGoalkeeperRewardV1(
  outcome: AttackerVsGoalkeeperOutcome | null,
  parameters: RewardV1Parameters = REWARD_V1_PARAMETERS,
): RewardBreakdownV1 {
  validateParameters(parameters);
  const components: RewardComponent[] = [{
    id: "DECISION_COST",
    value: parameters.decisionCost,
    explanation: "Small cost for consuming one agent decision boundary.",
    source: "DECISION_BOUNDARY",
  }];
  if (outcome !== null) components.push({
    id: "SEMANTIC_OUTCOME",
    value: parameters.outcomes[outcome],
    explanation: `Terminal or physical scenario outcome: ${outcome}.`,
    source: "AUTHORITATIVE_OUTCOME",
  });
  const frozen = Object.freeze(components.map(component => Object.freeze(component)));
  return Object.freeze({
    version: REWARD_VERSION,
    outcome,
    components: frozen,
    total: reconstructReward(frozen),
  });
}

export function reconstructReward(components: readonly Pick<RewardComponent, "value">[]): number {
  return components.reduce((total, component) => total + component.value, 0);
}

export function verifyRewardBreakdown(breakdown: RewardBreakdownV1): boolean {
  return breakdown.version === REWARD_VERSION
    && Number.isFinite(breakdown.total)
    && Math.abs(reconstructReward(breakdown.components) - breakdown.total) <= 1e-12;
}

function validateParameters(parameters: RewardV1Parameters): void {
  if (!Number.isFinite(parameters.decisionCost) || parameters.decisionCost > 0) {
    throw new Error("decisionCost must be a finite non-positive number");
  }
  for (const [outcome, value] of Object.entries(parameters.outcomes)) {
    if (!Number.isFinite(value)) throw new Error(`Reward for ${outcome} must be finite`);
  }
}
