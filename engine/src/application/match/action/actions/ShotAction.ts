import { Vector2 } from "../../../../core/geometry/Vector2";
import { Vector3 } from "../../../../core/geometry/Vector3";
import type { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import {
  Milliseconds,
  PlayerId,
  ShotEvent,
  ShotStartedEvent,
  ShotTakenEvent,
  TeamId,
  createGoalFrame,
  type PreferredFoot,
  type ShotExecution,
  type ShotType,
} from "../../../../domain";
import { ENGINE_CALIBRATION_PARAMETERS } from "../../calibration/CalibrationParameters";
import { DecisionType } from "../../decision/DecisionType";
import { BallMotionPlanner } from "../../physics/BallMotionPlanner";
import type { ActionContext } from "../ActionContext";
import type { ActionResult } from "../ActionResult";

const SHOT_CALIBRATION = ENGINE_CALIBRATION_PARAMETERS.shot;

/**
 * Starts a spatial shot. It deliberately does not decide goal/save/miss here:
 * those outcomes are produced later by BallPhysicsSystem interactions.
 */
export class ShotAction {
  public execute(context: ActionContext): ActionResult {
    const { player, match, random, matchSecond, pitch, teamSide, attackingDirection } = context;
    const secondsIntoPeriod = matchSecond % (45 * 60);
    if (45 * 60 - secondsIntoPeriod < 2.25) {
      return {
        actorId: player.player.id,
        type: DecisionType.SHOT,
        success: false,
        events: [],
      };
    }
    const period = matchSecond < 45 * 60 ? "FIRST_HALF" as const : "SECOND_HALF" as const;
    const goal = attackingDirection === 1 ? pitch.geometry.rightGoal : pitch.geometry.leftGoal;
    const defending = teamSide === "HOME" ? match.away : match.home;
    const attacking = teamSide === "HOME" ? match.home : match.away;
    const goalkeeper = defending.players.find(candidate => candidate.currentRole.includes("GOALKEEPER")) ?? null;
    const pressure = this.pressureLevel(player, defending.players);
    const quality = this.executionQuality(player, pressure);
    const shotType = this.selectShotType(player, goalkeeper, goal.center.x, quality);
    const intendedTarget = this.selectTarget(context, goalkeeper, shotType, quality, goal.center.y, goal.width, goal.height);
    const actualTarget = this.applyExecutionError(context, intendedTarget, quality, shotType);
    const speed = this.initialSpeed(player, shotType, quality);
    const origin = new Vector3(player.position.x, player.position.y, .18);
    const direction = actualTarget.subtract(origin).normalize();
    const initialVelocity = direction.multiply(speed);
    const shotId = `shot-${player.player.id}-${matchSecond.toFixed(2)}`;
    const teamId = attacking.team.id as TeamId;
    const playerId = player.player.id as PlayerId;
    const technique = player.player.attributes.technical.technique / 20;
    const flair = player.player.attributes.mental.flair / 20;
    const curve = technique >= .78 && flair >= .7
      ? (actualTarget.y < goal.center.y ? -1 : 1) * (.35 + technique * .65)
      : 0;
    const beyondDistance = .28;
    const goalDistanceX = Math.max(.1, Math.abs(goal.center.x - origin.x));
    const trajectoryFactor = (goalDistanceX + beyondDistance) / goalDistanceX;
    const targetBeyondLine = new Vector2(
      goal.center.x + attackingDirection * beyondDistance,
      origin.y + (actualTarget.y - origin.y) * trajectoryFactor,
    );
    const peakHeight = shotType === "CHIP" ? 1.25 : .2 + technique * .25;
    const goalProgress = goalDistanceX / (goalDistanceX + beyondDistance);
    const targetHeightBeyond = Math.max(0, (
      actualTarget.z
      - origin.z * (1 - goalProgress)
      - peakHeight * 4 * goalProgress * (1 - goalProgress)
    ) / goalProgress);
    const distance = origin.subtract(actualTarget).magnitude();

    const execution: ShotExecution = {
      id: shotId,
      shooterId: player.player.id,
      teamId: attacking.team.id,
      defendingTeamId: defending.team.id,
      goalkeeperId: goalkeeper?.player.id ?? null,
      goalkeeperInitialPosition:goalkeeper?.position??null,
      origin,
      intendedTarget,
      actualTarget,
      initialVelocity,
      speed,
      shotType,
      footUsed: this.footUsed(player, intendedTarget.y, goal.center.y),
      expectedArrivalTime: matchSecond + distance / Math.max(1, speed),
      executionQuality: quality,
      pressureLevel: pressure,
      bodyPosture: player.bodyState,
      balance: Math.max(0, Math.min(1, player.balance / 100)),
      contactQuality: Math.max(0, Math.min(1, quality * (.85 + player.stability / 700))),
      curve,
      startedAt: matchSecond,
      goalFrame: createGoalFrame(goal.center.x, goal.center.y, goal.width, goal.height),
      lifecycle: "IN_FLIGHT",
      outcome: null,
      deflectionCount: 0,
      lastInteractionPlayerId: null,
      goalkeeperDecision:null,
      goalkeeperReactionTime:null,
    };

    attacking.noteShotTaken(matchSecond, SHOT_CALIBRATION.cooldownSeconds);
    player.hasBall = false;
    match.ball.noteTouch(player.player.id);
    match.ball.release();
    match.ball.activeShot = execution;
    BallMotionPlanner.start(match.ball, {
      kind: "SHOT",
      origin: player.position,
      target: targetBeyondLine,
      speed,
      startHeight: origin.z,
      targetHeight: targetHeightBeyond,
      peakHeight,
      curve,
      hasExplicitEffect: curve !== 0,
    });

    const started: ShotStartedEvent = {
      id: `${shotId}-started`, type: "SHOT_STARTED", shotId,
      timestamp: (matchSecond * 1000) as Milliseconds, period, teamId, playerId,
      originX: origin.x, originY: origin.y,
      intendedTargetY: intendedTarget.y, intendedTargetZ: intendedTarget.z,
      shotType,
    };
    const taken: ShotTakenEvent = {
      id: `${shotId}-taken`, type: "SHOT_TAKEN", shotId,
      timestamp: (matchSecond * 1000) as Milliseconds, period, teamId, playerId,
      actualTargetY: actualTarget.y, actualTargetZ: actualTarget.z,
      initialSpeed: speed, executionQuality: quality, pressureLevel: pressure,
    };
    const shot: ShotEvent = {
      id: shotId, type: "SHOT", timestamp: (matchSecond * 1000) as Milliseconds,
      period, teamId, playerId, result: "IN_FLIGHT",
      targetX: intendedTarget.x, targetY: intendedTarget.y,
    };

    return {
      actorId: player.player.id,
      type: DecisionType.SHOT,
      success: true,
      events: [started, taken, shot],
    };
  }

  private pressureLevel(shooter: PlayerMatchState, opponents: readonly PlayerMatchState[]): number {
    let pressure = 0;
    for (const opponent of opponents) {
      const distance = shooter.position.distanceTo(opponent.position);
      if (distance < 1.3) pressure += .42;
      else if (distance < 2.5) pressure += .24;
      else if (distance < 4) pressure += .08;
    }
    return Math.max(0, Math.min(1, pressure));
  }

  private executionQuality(shooter: PlayerMatchState, pressure: number): number {
    const attributes = shooter.player.attributes;
    const technical = attributes.technical.finishing * .42
      + attributes.technical.technique * .25
      + attributes.mental.composure * .23
      + attributes.physical.balance * .1;
    const fatigue = 1 - Math.min(.25, shooter.fatigue / 400);
    const posture = shooter.bodyState === "BALANCED" || shooter.bodyState === "STANDING" ? 1 : .78;
    return Math.max(.08, Math.min(.98, technical / 20 * fatigue * posture * (1 - pressure * .42)));
  }

  private selectShotType(
    shooter: PlayerMatchState,
    goalkeeper: PlayerMatchState | null,
    goalX: number,
    quality: number,
  ): ShotType {
    const goalDistance = Math.abs(shooter.position.x - goalX);
    const keeperAdvanced = goalkeeper ? Math.abs(goalkeeper.position.x - goalX) > 4.5 : false;
    if (keeperAdvanced && goalDistance < 22 && shooter.player.attributes.technical.technique >= 14) return "CHIP";
    if (quality >= .62 && goalDistance <= 24) return "PLACED";
    return "POWER";
  }

  private selectTarget(
    context: ActionContext,
    goalkeeper: PlayerMatchState | null,
    shotType: ShotType,
    quality: number,
    centreY: number,
    goalWidth: number,
    goalHeight: number,
  ): Vector3 {
    const keeperY = goalkeeper?.position.y ?? centreY;
    const technique = context.player.player.attributes.technical.technique / 20;
    // Aim inside the frame rather than at the post itself. Execution error may
    // still produce a miss or woodwork, but a nominal high-quality target must
    // leave room for the complete ball to cross the plane.
    const placement = Math.min(
      goalWidth / 2 - shotTypeBallMargin(shotType),
      SHOT_CALIBRATION.aimLateralBaseMeters
        + technique * SHOT_CALIBRATION.aimTechniqueScaleMeters
        + quality * SHOT_CALIBRATION.aimQualityScaleMeters,
    );
    const targetY = keeperY <= centreY
      ? centreY + placement
      : centreY - placement;
    const targetZ = shotType === "CHIP"
      ? Math.min(goalHeight - .18, 1.55 + technique * .6)
      : shotType === "PLACED" ? .35 + technique * 1.05 : .55 + technique * .55;
    const goalX = context.attackingDirection === 1 ? context.pitch.length : 0;
    return new Vector3(goalX, targetY, targetZ);
  }

  private applyExecutionError(
    context: ActionContext,
    target: Vector3,
    quality: number,
    shotType: ShotType,
  ): Vector3 {
    const baseError = shotType === "POWER"
      ? SHOT_CALIBRATION.powerErrorMeters
      : shotType === "CHIP" ? SHOT_CALIBRATION.chipErrorMeters : SHOT_CALIBRATION.placedErrorMeters;
    const errorScale = baseError * (1.08 - quality);
    // Triangular noise avoids a uniform wall of extreme misses and remains seeded.
    const lateralNoise = (context.random.nextFloat(-1, 1) + context.random.nextFloat(-1, 1)) / 2;
    const heightNoise = (context.random.nextFloat(-1, 1) + context.random.nextFloat(-1, 1)) / 2;
    return new Vector3(
      target.x,
      target.y + lateralNoise * errorScale * SHOT_CALIBRATION.lateralErrorMultiplier,
      Math.max(-.15, target.z + heightNoise * errorScale * SHOT_CALIBRATION.heightErrorMultiplier),
    );
  }

  private initialSpeed(shooter: PlayerMatchState, shotType: ShotType, quality: number): number {
    const finishing = shooter.player.attributes.technical.finishing / 20;
    const technique = shooter.player.attributes.technical.technique / 20;
    const typeBonus = shotType === "POWER" ? 5 : shotType === "CHIP" ? -5 : 0;
    return Math.max(16, 22 + finishing * 7 + technique * 4 + quality * 3 + typeBonus);
  }

  private footUsed(shooter: PlayerMatchState, targetY: number, centreY: number): PreferredFoot {
    if (shooter.player.preferredFoot !== "BOTH") return shooter.player.preferredFoot;
    return targetY < centreY ? "RIGHT" : "LEFT";
  }
}

function shotTypeBallMargin(shotType: ShotType): number {
  return shotType === "POWER" ? .55 : .70;
}
