import { Vector2 } from "../../../../core/geometry/Vector2";
import type { MatchState } from "../../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";
import type { PlayerRole, TacticalShapeAssignment } from "../../../../domain";
import type { DecisionContext } from "../../decision/DecisionContext";
import type { DecisionType } from "../../decision/DecisionType";

export interface RoleTargetContext {
  readonly match: MatchState;
  readonly team: TeamMatchState;
  readonly player: PlayerMatchState;
  readonly assignment: TacticalShapeAssignment;
  /** Formation/collective-phase target in canonical left-to-right coordinates. */
  readonly baseTarget: Vector2;
}

/** Spatial behaviour is mandatory; attributes only determine execution quality. */
export interface RoleBehaviour {
  resolveInPossessionTarget(context: RoleTargetContext): Vector2;
  resolveOutOfPossessionTarget(context: RoleTargetContext): Vector2;
  resolveTransitionTarget(context: RoleTargetContext): Vector2;
  modifyDecisionUtility(decision: DecisionType, context: DecisionContext): number;
}

export interface RoleBehaviourResolver {
  forRole(role: PlayerRole): RoleBehaviour;
}
