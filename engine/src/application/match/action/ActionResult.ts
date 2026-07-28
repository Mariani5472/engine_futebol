import { CardEvent, CornerEvent, FoulEvent, GoalEvent, ShotEvent } from "../../../domain";
import { DecisionType } from "../decision/DecisionType";

/** Events that an action can produce within a single tick. */
export type ActionEvent = ShotEvent | GoalEvent | CardEvent | CornerEvent | FoulEvent;

export interface ActionResultMeta {
  passRealForwardGain?: number;
  passReceiverId?: string;
  laneForwardProgress?: number;
}

export interface ActionResult {
  readonly actorId: string;
  readonly type: DecisionType;
  readonly success: boolean;
  readonly events: ActionEvent[];
  readonly meta?: ActionResultMeta;
}
