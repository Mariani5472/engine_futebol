import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

/** Clearance speed (m/s). */
const CLEARANCE_POWER = 25;
/** Clearance height when kicked high. */
const CLEARANCE_HEIGHT = 2.5;

export class ClearanceAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, attackingDirection } = context;

    // Kick ball away from danger: toward the opponent's half.
    const forwardX = attackingDirection * CLEARANCE_POWER;

    // Add spread: wide clearances are imprecise.
    const lateralSpread = random.nextFloat(-8, 8);
    const velocity = new Vector2(forwardX, lateralSpread);

    // Normalize and apply power.
    const normalizedVelocity = velocity.normalize().multiply(CLEARANCE_POWER);

    player.hasBall = false;
    match.ball.owner = null;

    (match.ball as { velocity: Vector2 }).velocity = normalizedVelocity;
    (match.ball as { height: number }).height = CLEARANCE_HEIGHT;
    (match.ball as { state: BallState }).state = BallState.IN_FLIGHT;

    return {
      actorId: player.player.id,
      type: DecisionType.CLEAR,
      success: true,
      events: []
    };

  }

}
