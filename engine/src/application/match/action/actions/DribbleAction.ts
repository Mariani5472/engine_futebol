import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { Milliseconds, PlayerId, TeamId, type CarryStartedEvent } from "../../../../domain";

/** A carry is a continuous locomotion intention, not an instant displacement. */
const DRIBBLE_ADVANCE = 5.5;

export class DribbleAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, matchSecond } = context;

    const team = match.home.players.includes(player)
      ? match.home
      : match.away;

    const attackX = team.attackingDirection;
    const forwardDir = new Vector2(attackX, 0);

    const opponents = (team === match.home ? match.away : match.home).players;
    const pressure = opponents.filter(opponent => opponent.position.distanceTo(player.position) < 3).length;
    const nearest = opponents.slice().sort((a,b)=>a.position.distanceTo(player.position)-b.position.distanceTo(player.position))[0];
    const freeForward = !nearest || nearest.position.distanceTo(player.position) > 5;
    const purpose = pressure >= 2 ? "PROTECT_POSSESSION" as const
      : pressure === 1 ? "ESCAPE_PRESSURE" as const
      : freeForward ? "ATTACK_SPACE" as const : "PROGRESS" as const;
    const controlMode = pressure >= 2 ? "CLOSE" as const
      : freeForward ? "SPRINT" as const : "NORMAL" as const;
    const flair = player.player.attributes.mental.flair / 20;
    const escapeSide = nearest ? Math.sign(player.position.y-nearest.position.y) || 1 : random.nextFloat(-1,1) >= 0 ? 1 : -1;
    const lateralVariance = pressure ? escapeSide * (.18 + flair * .22) : random.nextFloat(-flair * .18, flair * .18);
    const direction = new Vector2(forwardDir.x, lateralVariance).normalize();

    const target = player.position.add(direction.multiply(DRIBBLE_ADVANCE));

    const clampedX = Math.max(0, Math.min(match.pitch.length, target.x));
    const clampedY = Math.max(0, Math.min(match.pitch.width, target.y));

    player.setTarget(new Vector2(clampedX, clampedY));

    const physical = player.player.attributes.physical;
    const technical = player.player.attributes.technical;
    const baseSpeed = physical.pace * .35 + physical.acceleration * .12;
    const controlFactor = controlMode === "CLOSE" ? .48 + technical.firstTouch / 80
      : controlMode === "SPRINT" ? .78 + technical.dribbling / 100
      : .62 + technical.dribbling / 90;
    const desiredSpeed = Math.max(2.2, baseSpeed * controlFactor * Math.max(.55, 1-player.fatigue/140));
    player.activeCarry = {
      origin: player.position, destination: new Vector2(clampedX,clampedY), desiredSpeed,
      controlMode, purpose, startedAt: matchSecond,
    };
    player.intent = {
      type: "continueCarry",
      targetPosition: new Vector2(clampedX, clampedY),
      startedAt: matchSecond,
      expiresAt: matchSecond + Math.max(.8, player.position.distanceTo(new Vector2(clampedX, clampedY)) / Math.max(1, desiredSpeed) + .5),
      confidence: Math.max(.35, 1 - pressure * .2),
      commitment: controlMode === "SPRINT" ? .82 : .68,
      possessionTeamId: team.team.id,
      cancelConditions: ["possessionChanged", "opportunityGone", "higherPriorityThreat", "expired"],
      reason: `${purpose} through ${controlMode.toLowerCase()} continuous carry`,
    };

    // Keep CONTROLLED ownership glued during dribble.
    if (match.ball.owner === player || player.hasBall) {
      player.hasBall = true;
      match.ball.acquirePossession(player, "DRIBBLE_RECOVERY", context.matchSecond, false, context.actionId);
    }
    const event: CarryStartedEvent = {
      id: `carry-${player.player.id}-${context.matchSecond.toFixed(2)}`,
      type: "CARRY_STARTED",
      timestamp: (context.matchSecond * 1000) as Milliseconds,
      period: context.matchSecond < 45 * 60 ? "FIRST_HALF" : "SECOND_HALF",
      teamId: team.team.id as TeamId,
      playerId: player.player.id as PlayerId,
      originX: player.position.x, originY: player.position.y,
      targetX: clampedX, targetY: clampedY,
      desiredSpeed, controlMode, purpose,
    };

    return {
      actorId: player.player.id,
      type: DecisionType.DRIBBLE,
      success: true,
      events: [event]
    };
  }
}
