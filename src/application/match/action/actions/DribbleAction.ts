import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

/** Distance the player tries to dribble per tick (metres). */
const DRIBBLE_ADVANCE = 3;

export class DribbleAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random } = context;

    const team = match.home.players.includes(player)
      ? match.home
      : match.away;

    // Direction: toward opponent's goal.
    const attackX = team.attackingDirection;
    const forwardDir = new Vector2(attackX, 0);

    // Add slight lateral variation for creativity.
    const flair = player.player.attributes.mental.flair / 20;
    const lateralVariance = random.nextFloat(-flair * 0.5, flair * 0.5);
    const direction = new Vector2(forwardDir.x, lateralVariance).normalize();

    // Dribble target: advance in attacking direction.
    const target = player.position.add(direction.multiply(DRIBBLE_ADVANCE));

    // Clamp to pitch.
    const clampedX = Math.max(0, Math.min(match.pitch.length, target.x));
    const clampedY = Math.max(0, Math.min(match.pitch.width, target.y));

    player.setTarget(new Vector2(clampedX, clampedY));

    // Ball stays with player (CONTROLLED state handled by MovementSystem).

    return {
      actorId: player.player.id,
      type: DecisionType.DRIBBLE,
      success: true,
      events: []
    };

  }

}
