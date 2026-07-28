import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

/**
 * Hold Ball: player shields the ball and stays in position,
 * waiting for better options to open up.
 */
export class HoldBallAction {

  public execute(context: ActionContext): ActionResult {

    const { player } = context;

    // Stay at current position — clear the target to remain stationary.
    player.setTarget(player.position);

    return {
      actorId: player.player.id,
      type: DecisionType.HOLD_BALL,
      success: true,
      events: []
    };

  }

}
