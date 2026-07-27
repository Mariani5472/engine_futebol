import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { GoalEvent, Milliseconds, PlayerId, ShotEvent, TeamId } from "../../../../domain";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";

const SHOT_POWER = 30;
const SHOT_HEIGHT = 0.5;

export class ShotAction {

  public execute(context: ActionContext): ActionResult {

    const { player, match, random, matchSecond, pitch, teamSide, attackingDirection } = context;
    const period = matchSecond < 45 * 60 ? "FIRST_HALF" as const : "SECOND_HALF" as const;

    const goal = attackingDirection === 1
      ? pitch.geometry.rightGoal
      : pitch.geometry.leftGoal;

    const goalCenter = new Vector2(goal.center.x, goal.center.y);

    const aimOffset = random.nextFloat(-goal.width / 2.5, goal.width / 2.5);
    const aimPoint = new Vector2(goalCenter.x, goalCenter.y + aimOffset);

    const onTargetProb = this.calculateOnTargetProb(context, player, goalCenter);
    const isOnTarget = random.nextFloat(0, 1) < onTargetProb;

    const shotId = `shot-${player.player.id}-${matchSecond.toFixed(1)}`;
    const teamId = (teamSide === "HOME" ? match.home.team.id : match.away.team.id) as TeamId;
    const playerId = player.player.id as PlayerId;

    player.hasBall = false;
    match.ball.owner = null;

    if (!isOnTarget) {
      // Place a contestable ball near the goal mouth rather than a permanent fly-away.
      const missAngle = random.nextFloat(-0.45, 0.45);
      const along = player.position.add(
        aimPoint.subtract(player.position).multiply(random.nextFloat(0.55, 0.9)),
      );
      match.ball.position = new Vector2(
        Math.max(0, Math.min(match.pitch.length, along.x + Math.sin(missAngle) * 4)),
        Math.max(0, Math.min(match.pitch.width, along.y + Math.cos(missAngle) * 4)),
      );
      match.ball.velocity = Vector2.zero();
      match.ball.height = 0;
      match.ball.state = BallState.FREE;

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

    const gkSaveProb = this.calculateGkSaveProb(context, goalCenter);
    const isSaved = random.nextFloat(0, 1) < gkSaveProb;

    if (isSaved) {
      // GK claims — controlled by nearest defending GK if present.
      const isHome = teamSide === "HOME";
      const defending = isHome ? match.away : match.home;
      const gk = defending.players.find((p) => p.currentRole === "GOALKEEPER")
        ?? defending.players[0];

      for (const p of [...match.home.players, ...match.away.players]) {
        p.hasBall = false;
      }
      if (gk) {
        gk.hasBall = true;
        match.ball.owner = gk;
        match.ball.position = gk.position;
        match.ball.state = BallState.CONTROLLED;
        match.ball.velocity = Vector2.zero();
        match.ball.height = 0;
      } else {
        match.ball.position = goalCenter;
        match.ball.state = BallState.FREE;
        match.ball.velocity = Vector2.zero();
        match.ball.owner = null;
      }

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

    // GOAL
    const scoringTeam = teamSide === "HOME" ? match.home : match.away;
    scoringTeam.score++;

    // Kickoff: give ball to conceding team at centre.
    const conceding = teamSide === "HOME" ? match.away : match.home;
    const kickoffPlayer =
      conceding.players.find((p) => p.currentRole !== "GOALKEEPER") ??
      conceding.players[0];

    for (const p of [...match.home.players, ...match.away.players]) {
      p.hasBall = false;
    }

    const centre = new Vector2(match.pitch.length / 2, match.pitch.width / 2);
    if (kickoffPlayer) {
      kickoffPlayer.position = centre;
      kickoffPlayer.hasBall = true;
      match.ball.owner = kickoffPlayer;
      match.ball.state = BallState.CONTROLLED;
    } else {
      match.ball.owner = null;
      match.ball.state = BallState.FREE;
    }
    match.ball.position = centre;
    match.ball.velocity = Vector2.zero();
    match.ball.height = 0;

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

    const roleQuality = PositionInfluenceCalculator.shootingQuality(shooter.currentRole);

    const distance = shooter.position.distanceTo(goalCenter);
    const distanceFactor = Math.max(0.25, 1 - distance / 48);

    const opponents = context.match.home.players.includes(shooter)
      ? context.match.away.players
      : context.match.home.players;

    let pressureCount = 0;
    for (const opp of opponents) {
      if (shooter.position.distanceTo(opp.position) < 3.5) {
        pressureCount++;
      }
    }
    const pressurePenalty = Math.min(0.45, pressureCount * 0.12);

    const fatiguePenalty = 1 - (shooter.fatigue / 100) * 0.15;

    // Slightly higher conversion readiness once volume rises (priority C prep).
    const raw = (finishing * 0.55 + composure * 0.30 + technique * 0.15)
      * roleQuality
      * distanceFactor
      * (1 - pressurePenalty)
      * fatiguePenalty
      + 0.08;

    return Math.max(0.08, Math.min(0.90, raw));
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
    const positionBonus = Math.max(0, 1 - gkDistToGoal / 6);

    const shooterDist = context.player.position.distanceTo(goalCenter);
    const distanceSavabilityBonus = Math.min(0.18, shooterDist / 90);

    const raw = (reflexes * 0.45 + handling * 0.30 + positioning * 0.25)
      * (0.60 + positionBonus * 0.25)
      + distanceSavabilityBonus;

    // Cap saves so close-range finishing converts more often once volume exists.
    return Math.max(0.05, Math.min(0.72, raw));
  }
}
