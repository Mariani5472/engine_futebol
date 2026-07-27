import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

/** Base dribble advance (metres) toward the attack. */
const DRIBBLE_ADVANCE = 5.5;

export class DribbleAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random } = context;

    const team = match.home.players.includes(player)
      ? match.home
      : match.away;

    const attackX = team.attackingDirection;
    const forwardDir = new Vector2(attackX, 0);

    const flair = player.player.attributes.mental.flair / 20;
    const lateralVariance = random.nextFloat(-flair * 0.35, flair * 0.35);
    const direction = new Vector2(forwardDir.x, lateralVariance).normalize();

    const target = player.position.add(direction.multiply(DRIBBLE_ADVANCE));

    const clampedX = Math.max(0, Math.min(match.pitch.length, target.x));
    const clampedY = Math.max(0, Math.min(match.pitch.width, target.y));

    player.setTarget(new Vector2(clampedX, clampedY));

    // Keep CONTROLLED ownership glued during dribble.
    if (match.ball.owner === player || player.hasBall) {
      player.hasBall = true;
      match.ball.owner = player;
      match.ball.position = player.position;
    }

    return {
      actorId: player.player.id,
      type: DecisionType.DRIBBLE,
      success: true,
      events: []
    };
  }
}
