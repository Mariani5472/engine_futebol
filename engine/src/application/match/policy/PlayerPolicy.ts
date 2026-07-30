import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { PLAYER_ACTION_SPACE, type PlayerActionId, type PlayerActionMask } from "./PlayerActionSpace";
import type { ActorObservation } from "../observation/ObservationSpace";

export type PolicyFallback = "HEURISTIC" | "SAFE";

export type PlayerActionCommand = {
  readonly actionId: PlayerActionId;
  readonly type?: never;
  readonly targetId?: string;
} | {
  readonly type: DecisionType;
  readonly actionId?: never;
  readonly targetId?: string;
};

export interface PlayerPolicyInput {
  readonly playerId: string;
  readonly matchSecond: number;
  readonly hasBall: boolean;
  readonly validDecisions: readonly Decision[];
  readonly actionMask: PlayerActionMask;
  /** This is the only observation available to a player policy. */
  readonly observation: ActorObservation;
  readonly heuristicDecision: () => Decision;
}

export interface PlayerPolicyProposal {
  readonly decision: Decision;
  /** Only the heuristic adapter may return an already selected canonical decision. */
  readonly canonical: boolean;
}

export interface PlayerPolicyWait {
  readonly waitForAction: true;
}

export type PlayerPolicyResult = PlayerPolicyProposal | PlayerPolicyWait | undefined;

export interface PlayerPolicy {
  readonly id: string;
  readonly fallback: PolicyFallback;
  decide(input: PlayerPolicyInput): PlayerPolicyResult;
}

export function isPlayerPolicyWait(result: PlayerPolicyResult): result is PlayerPolicyWait {
  return result !== undefined && "waitForAction" in result && result.waitForAction === true;
}

export function commandDecision(command: PlayerActionCommand): Decision {
  const type = command.actionId !== undefined
    ? PLAYER_ACTION_SPACE.actionForId(command.actionId).decisionType
    : command.type;
  return new Decision(type, 1, command.targetId);
}
