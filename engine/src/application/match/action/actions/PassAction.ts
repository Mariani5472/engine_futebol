import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { BallMotionPlanner } from "../../physics/BallMotionPlanner";
import { Milliseconds, PlayerId, TeamId, type PassAttemptedEvent } from "../../../../domain";

const MAX_PASS_SPEED = 30;
const MIN_PASS_SPEED = 11;
const MAX_RECEIVER_LEAD = 5;

export class PassAction {

  public execute(context: ActionContext): ActionResult {
    const { player, decision, match, random, matchSecond } = context;
    const targetId = decision.targetId;

    if (!targetId) {
      return this.fail(player.player.id, decision.type);
    }

    const target = this.findTeammate(context, targetId);
    if (!target) {
      return this.fail(player.player.id, decision.type);
    }

    const team = match.home.players.includes(player) ? match.home : match.away;
    const origin = match.ball.position;
    const dir = team.attackingDirection;
    const realForwardGain = (target.position.x - player.position.x) * dir;

    const accuracy = this.calculateSuccessProb(context, player, target);
    const receptionPoint = this.predictReceptionPoint(context, origin, target);
    const distance = origin.distanceTo(receptionPoint);
    const errorRadius = Math.pow(1 - accuracy, 2) * Math.min(6, distance * .15);
    const errorAngle = random.nextFloat(-Math.PI, Math.PI);
    const errorDistance = random.nextFloat(0, errorRadius);
    const destination = this.clampToPitch(
      receptionPoint.add(Vector2.fromAngle(errorAngle).multiply(errorDistance)),
      context,
    );
    match.ball.noteTouch(player.player.id);
    for (const teammate of [...match.home.players, ...match.away.players]) teammate.hasBall = false;
    this.startMotion(context, origin, destination, target);
    match.ball.pendingPass = {
      passerId: player.player.id,
      intendedReceiverId: target.player.id,
      teammateIds:team.players.filter(teammate=>teammate!==player).map(teammate=>teammate.player.id),
      startedAtSecond: matchSecond,
      realForwardGain,
      statisticalAttemptRecorded: true,
    };
    this.prepareOneTwo(player, target, team.attackingDirection, origin, destination, matchSecond, match.pitch.length, match.pitch.width);
    const flightSeconds = Math.max(.16, origin.distanceTo(destination) / this.calculatePower(origin.distanceTo(destination)));
    target.intent = {
      type: "receiveBall",
      targetPlayerId: player.player.id,
      targetPosition: destination,
      startedAt: matchSecond,
      expiresAt: matchSecond + flightSeconds + 1.2,
      confidence: accuracy,
      commitment: .9,
      possessionTeamId: team.team.id,
      cancelConditions: ["possessionChanged", "ballTrajectoryChanged", "higherPriorityThreat", "expired"],
      reason: `prepare body and arrive for pass from ${player.player.id}`,
    };
    target.setTarget(destination);
    target.facingDirection = origin.subtract(destination).normalize();
    const postPassTarget = player.oneTwoRunTarget ?? this.postPassTarget(context, player, target, realForwardGain);
    player.intent = {
      type: player.oneTwoRunTarget ? "completeOneTwo" : realForwardGain > 5 ? "attackSpace" : "supportCarrier",
      targetPlayerId: target.player.id,
      targetPosition: postPassTarget,
      startedAt: matchSecond,
      expiresAt: matchSecond + (player.oneTwoRunTarget ? 3.2 : 2.4),
      confidence: player.oneTwoRunTarget ? .82 : .68,
      commitment: player.oneTwoRunTarget ? .86 : .62,
      possessionTeamId: team.team.id,
      cancelConditions: ["possessionChanged", "spaceOccupied", "higherPriorityThreat", "expired"],
      reason: player.oneTwoRunTarget ? "continue after pass for possible one-two" : realForwardGain > 5 ? "continue into space after progressive pass" : "restore support angle after pass",
    };
    player.setTarget(postPassTarget);
    const passKind = decision.type === DecisionType.CROSS ? "CROSS" as const
      : decision.type === DecisionType.GK_DISTRIBUTE ? "GOALKEEPER_DISTRIBUTION" as const
      : "PASS" as const;
    const event: PassAttemptedEvent = {
      id: `pass-${player.player.id}-${matchSecond.toFixed(2)}`,
      type: "PASS_ATTEMPTED",
      timestamp: (matchSecond * 1000) as Milliseconds,
      period: matchSecond < 45 * 60 ? "FIRST_HALF" : "SECOND_HALF",
      teamId: team.team.id as TeamId,
      playerId: player.player.id as PlayerId,
      receiverId: target.player.id as PlayerId,
      originX: origin.x, originY: origin.y,
      targetX: destination.x, targetY: destination.y,
      passKind,
    };

    return {
      actorId: player.player.id,
      type: decision.type,
      success: true,
      events: [event],
      meta: {
        passRealForwardGain: realForwardGain,
        passReceiverId: target.player.id,
      },
    } as ActionResult;
  }

  private startMotion(context: ActionContext, origin: Vector2, destination: Vector2, target: PlayerMatchState): void {
    const distance = origin.distanceTo(destination);
    const power = this.calculatePower(distance);
    const isCross = context.decision.type === DecisionType.CROSS;
    const directGoalkeeperKick = context.decision.type === DecisionType.GK_DISTRIBUTE &&
      (context.match.home.players.includes(context.player) ? context.match.home : context.match.away)
        .tactic.transition.goalkeeperDistribution === "DIRECT";
    BallMotionPlanner.start(context.match.ball, {
      kind: isCross ? "CROSS" : directGoalkeeperKick ? "AERIAL_PASS" : "GROUND_PASS",
      origin,
      target: destination,
      speed: power,
      peakHeight: isCross ? 4.5 : directGoalkeeperKick ? 5.5 : 0,
      curve: isCross ? this.crossCurve(context, origin) : 0,
      hasExplicitEffect: isCross,
      intendedReceiverId: target.player.id,
    });
  }

  private prepareOneTwo(
    passer:PlayerMatchState,
    receiver:PlayerMatchState,
    direction:1|-1,
    origin:Vector2,
    destination:Vector2,
    second:number,
    pitchLength:number,
    pitchWidth:number,
  ):void {
    const distance=origin.distanceTo(destination);
    const forwardGain=(destination.x-origin.x)*direction;
    if(distance<6||distance>20||forwardGain<1||forwardGain>16)return;
    const runTarget=new Vector2(
      Math.max(1,Math.min(pitchLength-1,passer.position.x+direction*Math.min(10,5+forwardGain*.35))),
      Math.max(1,Math.min(pitchWidth-1,passer.position.y+(receiver.position.y-passer.position.y)*.35)),
    );
    passer.oneTwoPartnerId=receiver.player.id;
    passer.oneTwoAvailableUntil=second+3.2;
    passer.oneTwoRunTarget=runTarget;
    receiver.oneTwoReturnTargetId=passer.player.id;
    receiver.oneTwoAvailableUntil=second+3.2;
    passer.tacticalResponsibility="ONE_TWO_RUN";
    passer.responsibilityUntil=second+3.2;
    passer.setTarget(runTarget);
  }

  /** Aim at a bounded meeting point instead of the receiver's stale position. */
  private predictReceptionPoint(
    context: ActionContext,
    origin: Vector2,
    target: PlayerMatchState,
  ): Vector2 {
    const initialDistance = origin.distanceTo(target.position);
    const flightSeconds = Math.max(.16, Math.min(2.2, initialDistance / this.calculatePower(initialDistance)));
    const velocityLead = target.velocity.multiply(Math.min(1.25, flightSeconds));
    const lead = velocityLead.magnitude() > MAX_RECEIVER_LEAD
      ? velocityLead.normalize().multiply(MAX_RECEIVER_LEAD)
      : velocityLead;
    return this.clampToPitch(target.position.add(lead), context);
  }

  private clampToPitch(position: Vector2, context: ActionContext): Vector2 {
    return new Vector2(
      Math.max(1, Math.min(context.match.pitch.length - 1, position.x)),
      Math.max(1, Math.min(context.match.pitch.width - 1, position.y)),
    );
  }

  private crossCurve(context: ActionContext, origin: Vector2): number {
    const technique = context.player.player.attributes.technical.technique / 20;
    const side = origin.y < context.match.pitch.width / 2 ? 1 : -1;
    return side * (1 + technique * 1.5);
  }

  private postPassTarget(
    context: ActionContext,
    passer: PlayerMatchState,
    receiver: PlayerMatchState,
    forwardGain: number,
  ): Vector2 {
    const team = context.match.home.players.includes(passer) ? context.match.home : context.match.away;
    const forward = forwardGain > 5 ? Math.min(8, 3 + forwardGain * .25) : -2;
    const lateral = Math.sign(passer.position.y - receiver.position.y) || 1;
    return this.clampToPitch(passer.position.add(new Vector2(team.attackingDirection * forward, lateral * 4)), context);
  }

  private calculateSuccessProb(
    context: ActionContext,
    passer: PlayerMatchState,
    target: PlayerMatchState,
  ): number {
    const attrs = passer.player.attributes;
    const passing = (attrs.technical.passing ?? 10) / 20;
    const vision = (attrs.mental.vision ?? 10) / 20;
    const technique = (attrs.technical.technique ?? 10) / 20;

    const distance = passer.position.distanceTo(target.position);
    const distancePenalty = Math.min(1, distance / 45);

    const opponents = context.match.home.players.includes(passer)
      ? context.match.away.players
      : context.match.home.players;

    let pressure = 0;
    for (const opp of opponents) {
      if (passer.position.distanceTo(opp.position) < 5) {
        pressure += 0.15;
      }
    }
    pressure = Math.min(0.5, pressure);

    const fatigueModifier = 1 - ((passer.fatigue ?? 0) / 100) * 0.25;

    const raw =
      (passing * 0.5 + vision * 0.3 + technique * 0.2) *
      (1 - distancePenalty * 0.35) *
      (1 - pressure * 0.7) *
      fatigueModifier;

    return Math.max(0.35, Math.min(0.96, raw + 0.15));
  }

  private calculatePower(distance: number): number {
    const t = Math.min(1, distance / 40);
    return MIN_PASS_SPEED + t * (MAX_PASS_SPEED - MIN_PASS_SPEED);
  }

  private findTeammate(
    context: ActionContext,
    targetId: string,
  ): PlayerMatchState | undefined {
    const team = context.match.home.players.includes(context.player)
      ? context.match.home
      : context.match.away;

    return team.players.find((p) => p.player.id === targetId);
  }

  private fail(playerId: string, type: DecisionType): ActionResult {
    return {
      actorId: playerId,
      type,
      success: false,
      events: [],
    };
  }
}
