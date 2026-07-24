import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { GoalEvent, Milliseconds, PlayerId, ShotEvent, TeamId } from "../../../../domain";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";

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

    const shotId = `shot-${player.player.id}-${matchSecond.toFixed(1)}`;
    const teamId = (teamSide === "HOME" ? match.home.team.id : match.away.team.id) as TeamId;
    const playerId = player.player.id as PlayerId;

    // Release ball.
    player.hasBall = false;
    match.ball.owner = null;

    if (!isOnTarget) {
      // Off target: random direction around goal.
      const missAngle = random.nextFloat(-0.6, 0.6);
      const missDir = aimPoint.subtract(player.position).normalize().rotate(missAngle);
      match.ball.velocity = missDir.multiply(SHOT_POWER);
      match.ball.height = random.nextFloat(1.5, 3.5);
      match.ball.state = BallState.IN_FLIGHT;
      match.ball.owner = null;

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
    match.ball.velocity = direction.multiply(SHOT_POWER);
    match.ball.height = SHOT_HEIGHT;
    match.ball.state = BallState.IN_FLIGHT;
    match.ball.owner = null;

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

    // Reset ball to centre for kickoff.
    match.ball.position = new Vector2(match.pitch.length / 2, match.pitch.width / 2);
    match.ball.velocity = Vector2.zero();
    match.ball.state = BallState.FREE;
    match.ball.height = 0;
    match.ball.owner = null;

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
      id: `goal-${player.player.id}-${matchSecond.toFixed(1)}`,
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

    // Position influence: strikers are much more accurate than defenders.
    const roleQuality = PositionInfluenceCalculator.shootingQuality(shooter.currentRole);

    const distance = shooter.position.distanceTo(goalCenter);
    // Closer = easier to get on target.
    const distanceFactor = Math.max(0.2, 1 - distance / 50);

    // Pressure from nearby opponents.
    const opponents = context.match.home.players.includes(shooter)
      ? context.match.away.players
      : context.match.home.players;

    let pressureCount = 0;
    for (const opp of opponents) {
      if (shooter.position.distanceTo(opp.position) < 3.5) {
        pressureCount++;
      }
    }
    const pressurePenalty = Math.min(0.50, pressureCount * 0.15);

    const fatiguePenalty = 1 - (shooter.fatigue / 100) * 0.15;

    const raw = (finishing * 0.55 + composure * 0.30 + technique * 0.15)
      * roleQuality
      * distanceFactor
      * (1 - pressurePenalty)
      * fatiguePenalty;

    return Math.max(0.05, Math.min(0.88, raw));
  }

  private calculateGkSaveProb(
    context: ActionContext,
    goalCenter: Vector2
  ): number {

    const isHome = context.match.home.players.includes(context.player);
    const defendingTeam = isHome ? context.match.away : context.match.home;
    const gk = defendingTeam.players.find(p => p.currentRole === "GOALKEEPER");

    if (!gk) return 0.05;

    const attrs = gk.player.attributes;
    const reflexes = attrs.goalkeeping.reflexes / 20;
    const handling = attrs.goalkeeping.handling / 20;
    const positioning = attrs.mental.positioning / 20;

    const gkDistToGoal = gk.position.distanceTo(goalCenter);
    // Goalkeeper close to their line = better positioned.
    const positionBonus = Math.max(0, 1 - gkDistToGoal / 6);

    // Shooter distance: closer shots are harder to save.
    const shooterDist = context.player.position.distanceTo(goalCenter);
    const distanceSavabilityBonus = Math.min(0.20, shooterDist / 80);

    const raw = (reflexes * 0.45 + handling * 0.30 + positioning * 0.25)
      * (0.65 + positionBonus * 0.25)
      + distanceSavabilityBonus;

    return Math.max(0.05, Math.min(0.85, raw));
  }
}
