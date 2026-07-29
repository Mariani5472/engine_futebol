import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";

export interface CognitiveCapabilities {
  readonly perceptionRadius: number;
  readonly predictionHorizon: number;
  readonly optionSearchDepth: number;
  readonly tacticalAwareness: number;
  readonly decisionNoise: number;
}

/** Attributes alter search fidelity and bounded evaluation error, never football's basic logic. */
export class CognitiveCapabilityResolver {
  public resolve(context: DecisionContext): CognitiveCapabilities {
    const mental = context.player.player.attributes.mental;
    const vision = Number(mental.vision ?? 10) / 20;
    const anticipation = Number(mental.anticipation ?? 10) / 20;
    const decisions = Number(mental.decisions ?? 10) / 20;
    const composure = Number(mental.composure ?? 10) / 20;
    return {
      perceptionRadius: 22 + vision * 28,
      predictionHorizon: .8 + anticipation * 2.2,
      optionSearchDepth: Math.round(7 + vision * 7),
      tacticalAwareness: clamp(anticipation * .35 + decisions * .45 + vision * .2, .15, 1),
      decisionNoise: clamp(.18 - decisions * .11 - composure * .04 + context.world.pressure * .06, .015, .2),
    };
  }

  public selectCandidates(candidates: readonly Decision[], context: DecisionContext): Decision[] {
    const capabilities = this.resolve(context);
    const bestByType = new Map<number, Decision>();
    for (const candidate of candidates) {
      const current = bestByType.get(candidate.type);
      if (!current || candidate.utility > current.utility) bestByType.set(candidate.type, candidate);
    }
    const required = new Set(bestByType.values());
    const sorted = [...candidates].sort((a,b) => b.utility - a.utility);
    for (const candidate of sorted.slice(0, capabilities.optionSearchDepth)) required.add(candidate);
    return [...required];
  }

  public applyEvaluationError(decision: Decision, context: DecisionContext): Decision {
    const capability = this.resolve(context);
    const deterministic = this.noise(context.player.player.id, context.currentTick, decision.type, decision.targetId);
    const error = deterministic * capability.decisionNoise * Math.min(12, Math.max(2, Math.abs(decision.utility) * .08));
    return new Decision(decision.type, decision.utility + error, decision.targetId,
      [...(decision.reasons ?? []), { code: "COGNITIVE_EVALUATION_ERROR", value: error }],
      { ...(decision.components ?? {}), COGNITIVE_EVALUATION_ERROR: error }, decision.objective);
  }

  private noise(playerId: string, tick: number, type: number, targetId?: string): number {
    const text = `${playerId}:${tick}:${type}:${targetId ?? ""}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    return ((hash >>> 0) / 0xffffffff) * 2 - 1;
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

