import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { GoalEvent, Milliseconds, PlayerId, ShotEvent, TeamId } from "../../../../domain";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";

/** Ball speed at launch when shooting (m/s). */
const SHOT_POWER = 30;
/** Height given to a driven shot. */
const SHOT_HEIGHT = 0.5;

export class ShotAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, matchSecond, pitch, teamSide, attackingDirection } = context;
    const period = matchSecond < 45 * 60 ? "FIRST_HALF" as const : "SECOND_HALF" as const;

    // Determine target goal.
    const goal = attackingDirection === 1
      ? pitch.geometry.rightGoal
      : pitch.geometry.leftGoal;

    const goalCenter = new Vector2(goal.center.x, goal.center.y);

    // Aim within goal width with some variance.
    const aimOffset = random.nextFloat(-goal.width / 2.5, goal.width / 2.5);
    const aimPoint = new Vector2(goalCenter.x, goalCenter.y + aimOffset);

    const onTargetProb = this.calculateOnTargetProb(context, player, goalCenter);
    const isOnTarget = random.nextFloat(0, 1) < onTargetProb;

    const shotId = `shot-${player.player.id}-${Date.now()}`;
    const teamId = (teamSide === "HOME" ? match.home.team.id : match.away.team.id) as TeamId;
    const playerId = player.player.id as PlayerId;

    // Release ball.
    player.hasBall = false;
    match.ball.owner = null;

    if (!isOnTarget) {
      // Off target: random direction around goal.
      const missAngle = random.nextFloat(-0.5, 0.5);
      const missDir = aimPoint.subtract(player.position).normalize().rotate(missAngle);
      (match.ball as { velocity: Vector2 }).velocity = missDir.multiply(SHOT_POWER);
      (match.ball as { height: number }).height = random.nextFloat(1.5, 3.5);
      (match.ball as { state: BallState }).state = BallState.IN_FLIGHT;
      (match.ball as { owner: null }).owner = null;

      const shot: ShotEvent = {
        id: shotId,
        type: "SHOT",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId,
        playerId,
        result: "OFF_TARGET",
        targetX: aimPoint.x,
        targetY: aimPoint.y
      };

      return { actorId: player.player.id, type: DecisionType.SHOT, success: false, events: [shot] };
    }

    // On target: check goalkeeper save.
    const gkSaveProb = this.calculateGkSaveProb(context, goalCenter);
    const isSaved = random.nextFloat(0, 1) < gkSaveProb;

    // Launch ball toward goal.
    const direction = aimPoint.subtract(player.position).normalize();
    (match.ball as { velocity: Vector2 }).velocity = direction.multiply(SHOT_POWER);
    (match.ball as { height: number }).height = SHOT_HEIGHT;
    (match.ball as { state: BallState }).state = BallState.IN_FLIGHT;
    (match.ball as { owner: null }).owner = null;

    if (isSaved) {
      const shot: ShotEvent = {
        id: shotId,
        type: "SHOT",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId,
        playerId,
        result: "SAVED",
        targetX: aimPoint.x,
        targetY: aimPoint.y
      };
      return { actorId: player.player.id, type: DecisionType.SHOT, success: false, events: [shot] };
    }

    // GOAL!
    const scoringTeam = teamSide === "HOME" ? match.home : match.away;
    scoringTeam.score++;

    // Reset ball to center.
    (match.ball as { position: Vector2 }).position = new Vector2(
      match.pitch.length / 2,
      match.pitch.width / 2
    );
    (match.ball as { velocity: Vector2 }).velocity = Vector2.zero();
    (match.ball as { state: BallState }).state = BallState.FREE;
    (match.ball as { height: number }).height = 0;

    const shotEvent: ShotEvent = {
      id: shotId,
      type: "SHOT",
      timestamp: (matchSecond * 1000) as Milliseconds,
      period,
      teamId,
      playerId,
      result: "GOAL",
      targetX: aimPoint.x,
      targetY: aimPoint.y
    };

    const goalEvent: GoalEvent = {
      id: `goal-${player.player.id}-${Date.now()}`,
      type: "GOAL",
      timestamp: (matchSecond * 1000) as Milliseconds,
      period,
      teamId,
      scorerId: playerId,
      assistId: null
    };

    return {
      actorId: player.player.id,
      type: DecisionType.SHOT,
      success: true,
      events: [shotEvent, goalEvent]
    };

  }

  private calculateOnTargetProb(
    context: ActionContext,
    shooter: PlayerMatchState,
    goalCenter: Vector2
  ): number {

    const attrs = shooter.player.attributes;
    const finishing = attrs.technical.finishing / 20;
    const composure = attrs.mental.composure / 20;
    const technique = attrs.technical.technique / 20;

    const distance = shooter.position.distanceTo(goalCenter);
    const distancePenalty = Math.min(1, distance / 35);

    // Count nearby opponents for pressure.
    const opponents = context.match.home.players.includes(shooter)
      ? context.match.away.players
      : context.match.home.players;

    let pressure = 0;
    for (const opp of opponents) {
      if (shooter.position.distanceTo(opp.position) < 4) {
        pressure += 0.2;
      }
    }
    pressure = Math.min(0.6, pressure);

    const fatigue = 1 - (shooter.fatigue / 100) * 0.2;

    const raw = (finishing * 0.5 + composure * 0.3 + technique * 0.2)
      * (1 - distancePenalty * 0.5)
      * (1 - pressure)
      * fatigue;

    return Math.max(0.05, Math.min(0.92, raw));

  }

  private calculateGkSaveProb(
    context: ActionContext,
    goalCenter: Vector2
  ): number {

    // Find the goalkeeper of the defending team.
    const isHome = context.match.home.players.includes(context.player);
    const defendingTeam = isHome ? context.match.away : context.match.home;
    const gk = defendingTeam.players.find(p => p.currentRole === "GOALKEEPER");

    if (!gk) return 0.05; // No goalkeeper — very low save chance.

    const attrs = gk.player.attributes;
    const reflexes = attrs.goalkeeping.reflexes / 20;
    const handling = attrs.goalkeeping.handling / 20;
    const positioning = attrs.mental.positioning / 20;

    const gkDistToGoal = gk.position.distanceTo(goalCenter);
    const positionBonus = Math.max(0, 1 - gkDistToGoal / 5); // Better positioned = higher save prob.

    const raw = (reflexes * 0.5 + handling * 0.3 + positioning * 0.2) * (0.7 + positionBonus * 0.3);
    return Math.max(0.05, Math.min(0.88, raw));

  }

}
