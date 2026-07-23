import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

export class HeaderAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, attackingDirection } = context;

    // Only valid when ball is in the air.
    if (match.ball.height <= 0.3) {
      return {
        actorId: player.player.id,
        type: DecisionType.NONE,
        success: false,
        events: []
      };
    }

    const attrs = player.player.attributes;
    const heading = attrs.technical.heading / 20;
    const jumpingReach = attrs.physical.jumpingReach / 20;

    const successProb = heading * 0.6 + jumpingReach * 0.4;
    const success = random.nextFloat(0, 1) < successProb;

    // Determine direction: attack toward goal or clear.
    const dirX = attackingDirection;
    const spread = random.nextFloat(-0.3, 0.3);
    const direction = new Vector2(dirX, spread).normalize();
    const power = success ? 12 + heading * 8 : 6;

    (match.ball as { velocity: Vector2 }).velocity = direction.multiply(power);
    (match.ball as { height: number }).height = 0.8;
    (match.ball as { state: BallState }).state = BallState.IN_FLIGHT;
    (match.ball as { owner: null }).owner = null;

    if (player.hasBall) {
      player.hasBall = false;
    }

    return {
      actorId: player.player.id,
      type: DecisionType.NONE, // HEADER doesn't have its own DecisionType; maps to CLEAR or SHOT
      success,
      events: []
    };

  }

}
