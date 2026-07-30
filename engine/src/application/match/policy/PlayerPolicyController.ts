import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import type {
  PlayerActionCommand,
  PlayerPolicy,
  PlayerPolicyInput,
} from "./PlayerPolicy";
import { isPlayerPolicyWait } from "./PlayerPolicy";
import { ExternalPlayerPolicy } from "./PlayerPolicies";
import { PLAYER_ACTION_SPACE, type PlayerActionId, type PlayerActionMask } from "./PlayerActionSpace";
import { ACTOR_OBSERVATION_VERSION, type ActorObservation } from "../observation/ObservationSpace";

export interface PolicyDecisionRecord {
  readonly sequence: number;
  readonly playerId: string;
  readonly matchSecond: number;
  readonly policyId: string;
  readonly requestedType: DecisionType | null;
  readonly requestedActionId: PlayerActionId | null;
  readonly requestedTargetId: string | null;
  readonly selectedType: DecisionType;
  readonly selectedActionId: PlayerActionId;
  readonly observationVersion: number;
  readonly selectedTargetId: string | null;
  readonly accepted: boolean;
  readonly reason: "HEURISTIC" | "ACCEPTED" | "INVALID_FALLBACK" | "EMPTY_FALLBACK";
}

export class PlayerPolicyController {
  private readonly policies = new Map<string, PlayerPolicy>();
  private readonly external = new Map<string, ExternalPlayerPolicy>();
  private readonly records: PolicyDecisionRecord[] = [];
  private readonly latestMasks = new Map<string, PlayerActionMask>();
  private readonly latestActorObservations = new Map<string, ActorObservation>();

  public bind(playerId: string, policy: PlayerPolicy): void {
    this.policies.set(playerId, policy);
    if (policy instanceof ExternalPlayerPolicy) this.external.set(playerId, policy);
    else this.external.delete(playerId);
  }

  public unbind(playerId: string): void {
    this.policies.delete(playerId);
    this.external.delete(playerId);
  }

  public hasPolicy(playerId: string): boolean {
    return this.policies.has(playerId);
  }

  public controlExternally(playerId: string): ExternalPlayerPolicy {
    const policy = new ExternalPlayerPolicy(`external:${playerId}`);
    this.bind(playerId, policy);
    return policy;
  }

  public submit(playerId: string, command: PlayerActionCommand): void {
    const policy = this.external.get(playerId);
    if (!policy) throw new Error(`Player ${playerId} is not externally controlled`);
    policy.submit(command);
  }

  public decide(input: Omit<PlayerPolicyInput, "actionMask" | "observation"> & {
    readonly buildActorObservation: (mask: PlayerActionMask) => ActorObservation;
  }): Decision | null {
    const policy = this.policies.get(input.playerId);
    if (!policy) {
      const selected = input.heuristicDecision();
      this.records.push({
        sequence: this.records.length + 1,
        playerId: input.playerId,
        matchSecond: input.matchSecond,
        policyId: "heuristic-v1",
        requestedType: selected.type,
        requestedActionId: PLAYER_ACTION_SPACE.actionForType(selected.type).id,
        requestedTargetId: selected.targetId ?? null,
        selectedType: selected.type,
        selectedActionId: PLAYER_ACTION_SPACE.actionForType(selected.type).id,
        selectedTargetId: selected.targetId ?? null,
        observationVersion: ACTOR_OBSERVATION_VERSION,
        accepted: true,
        reason: "HEURISTIC",
      });
      return selected;
    }
    const actionMask = PLAYER_ACTION_SPACE.mask(input.playerId, input.matchSecond, input.validDecisions);
    const observation = input.buildActorObservation(actionMask);
    if (this.policies.has(input.playerId)) {
      this.latestMasks.set(input.playerId, actionMask);
      this.latestActorObservations.set(input.playerId, observation);
    }
    const { buildActorObservation: _factory, ...policyInput } = input;
    const proposal = policy.decide({ ...policyInput, actionMask, observation });
    if (isPlayerPolicyWait(proposal)) return null;
    let selected: Decision;
    let accepted = false;
    let reason: PolicyDecisionRecord["reason"];

    if (proposal?.canonical) {
      const matched = input.validDecisions.length
        ? PLAYER_ACTION_SPACE.resolve(proposal.decision, input.validDecisions)
        : proposal.decision;
      selected = matched ?? safeDecision(input.validDecisions, input.hasBall);
      accepted = matched !== undefined;
      reason = "HEURISTIC";
    } else {
      const matched = proposal ? PLAYER_ACTION_SPACE.resolve(proposal.decision, input.validDecisions) : undefined;
      if (matched) {
        selected = matched;
        accepted = true;
        reason = "ACCEPTED";
      } else if (policy.fallback === "HEURISTIC") {
        selected = input.heuristicDecision();
        reason = proposal ? "INVALID_FALLBACK" : "EMPTY_FALLBACK";
      } else {
        selected = safeDecision(input.validDecisions, input.hasBall);
        reason = proposal ? "INVALID_FALLBACK" : "EMPTY_FALLBACK";
      }
    }

    this.records.push({
      sequence: this.records.length + 1,
      playerId: input.playerId,
      matchSecond: input.matchSecond,
      policyId: policy.id,
      requestedType: proposal?.decision.type ?? null,
      requestedActionId: proposal
        ? PLAYER_ACTION_SPACE.actionForType(proposal.decision.type).id
        : null,
      requestedTargetId: proposal?.decision.targetId ?? null,
      selectedType: selected.type,
      selectedActionId: PLAYER_ACTION_SPACE.actionForType(selected.type).id,
      observationVersion: observation.version,
      selectedTargetId: selected.targetId ?? null,
      accepted,
      reason,
    });
    return selected;
  }

  public decisions(): readonly PolicyDecisionRecord[] { return this.records; }

  public decisionsAfter(sequence: number): readonly PolicyDecisionRecord[] {
    return this.records.filter(record => record.sequence > sequence);
  }

  public actionMask(playerId: string): PlayerActionMask | null {
    return this.latestMasks.get(playerId) ?? null;
  }

  public actionMasks(): readonly PlayerActionMask[] {
    return [...this.latestMasks.values()];
  }

  public actorObservation(playerId: string): ActorObservation | null {
    return this.latestActorObservations.get(playerId) ?? null;
  }

  public actorObservations(): readonly ActorObservation[] {
    return [...this.latestActorObservations.values()];
  }
}

function safeDecision(valid: readonly Decision[], hasBall: boolean): Decision {
  const preferred = hasBall
    ? [DecisionType.HOLD_BALL, DecisionType.CONTROL, DecisionType.DRIBBLE]
    : [DecisionType.MOVE, DecisionType.POSITION, DecisionType.COVER];
  for (const type of preferred) {
    const candidate = valid.find(decision => decision.type === type);
    if (candidate) return candidate;
  }
  return new Decision(hasBall ? DecisionType.HOLD_BALL : DecisionType.MOVE, 1);
}
