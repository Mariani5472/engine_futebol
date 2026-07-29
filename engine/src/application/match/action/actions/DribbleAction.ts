import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { Milliseconds, PlayerId, TeamId, type CarryStartedEvent } from "../../../../domain";

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
      match.ball.acquirePossession(player, "DRIBBLE_RECOVERY", context.matchSecond);
    }
    const pressure = (team === match.home ? match.away : match.home).players
      .filter(opponent => opponent.position.distanceTo(player.position) < 3).length;
    const event: CarryStartedEvent = {
      id: `carry-${player.player.id}-${context.matchSecond.toFixed(2)}`,
      type: "CARRY_STARTED",
      timestamp: (context.matchSecond * 1000) as Milliseconds,
      period: context.matchSecond < 45 * 60 ? "FIRST_HALF" : "SECOND_HALF",
      teamId: team.team.id as TeamId,
      playerId: player.player.id as PlayerId,
      originX: player.position.x, originY: player.position.y,
      targetX: clampedX, targetY: clampedY,
      purpose: pressure > 0 ? "ESCAPE_PRESSURE" : "PROGRESS",
    };

    return {
      actorId: player.player.id,
      type: DecisionType.DRIBBLE,
      success: true,
      events: [event]
    };
  }
}
