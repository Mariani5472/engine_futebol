import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

const CLEARANCE_DISTANCE = 28;

export class ClearanceAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, attackingDirection } = context;

    player.hasBall = false;
    match.ball.owner = null;

    const lateral = random.nextFloat(-12, 12);
    const land = new Vector2(
      Math.max(
        0,
        Math.min(
          match.pitch.length,
          player.position.x + attackingDirection * CLEARANCE_DISTANCE,
        ),
      ),
      Math.max(0, Math.min(match.pitch.width, player.position.y + lateral)),
    );

    match.ball.position = land;
    match.ball.velocity = Vector2.zero();
    match.ball.height = 0;
    match.ball.state = BallState.FREE;

    return {
      actorId: player.player.id,
      type: DecisionType.CLEAR,
      success: true,
      events: []
    };
  }
}
