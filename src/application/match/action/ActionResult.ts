import { CardEvent, GoalEvent, ShotEvent } from "../../../domain";
import { DecisionType } from "../decision/DecisionType";

/** Events that an action can produce within a single tick. */
export type ActionEvent = ShotEvent | GoalEvent | CardEvent;

export interface ActionResult {
  /** ID of the player who took the action. */
  readonly actorId: string;
  /** The type of action taken. */
  readonly type: DecisionType;
  /** Whether the intended outcome succeeded (e.g. pass reached target). */
  readonly success: boolean;
  /** Zero or more domain events produced by this action. */
  readonly events: ActionEvent[];
}
