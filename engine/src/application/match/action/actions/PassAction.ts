import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { BallMotionPlanner } from "../../physics/BallMotionPlanner";

const MAX_PASS_SPEED = 28;
const MIN_PASS_SPEED = 8;
const FAIL_NOISE_RADIANS = 0.6;

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
    const origin = player.position;
    const dir = team.attackingDirection;
    const realForwardGain = (target.position.x - player.position.x) * dir;

    const successProb = this.calculateSuccessProb(context, player, target);
    const success = random.nextFloat(0, 1) < successProb;

    player.hasBall = false;

    if (success) {
      this.deliverToReceiver(match, player, target);
      this.startMotion(context, origin, target.position, target);
      team.noteProgressivePass(matchSecond, realForwardGain);
      return {
        actorId: player.player.id,
        type: decision.type,
        success: true,
        events: [],
        // Diagnostic payload consumed by AttackFunnel when present.
        meta: {
          passRealForwardGain: realForwardGain,
          passReceiverId: target.player.id,
        },
      } as ActionResult;
    }

    this.releaseFailedPass(context, player, target, random, origin);

    return {
      actorId: player.player.id,
      type: decision.type,
      success: false,
      events: [],
      meta: {
        passRealForwardGain: realForwardGain,
        passReceiverId: target.player.id,
      },
    } as ActionResult;
  }

  private deliverToReceiver(
    match: ActionContext["match"],
    passer: PlayerMatchState,
    target: PlayerMatchState,
  ): void {
    for (const p of [...match.home.players, ...match.away.players]) {
      p.hasBall = false;
    }

    target.hasBall = true;
    match.ball.owner = target;
    match.ball.state = BallState.CONTROLLED;
    match.ball.position = target.position;
    match.ball.velocity = Vector2.zero();
    (match.ball as { height: number }).height = 0;

    target.lastActionType = DecisionType.RECEIVE;
    void passer;
  }

  private releaseFailedPass(
    context: ActionContext,
    passer: PlayerMatchState,
    target: PlayerMatchState,
    random: ActionContext["random"],
    origin: Vector2,
  ): void {
    const match = context.match;
    const distance = passer.position.distanceTo(target.position);
    const power = this.calculatePower(distance);

    let direction = target.position.subtract(passer.position).normalize();
    const noiseAngle = random.nextFloat(-FAIL_NOISE_RADIANS, FAIL_NOISE_RADIANS);
    direction = direction.rotate(noiseAngle);

    const landFraction = random.nextFloat(0.45, 0.85);
    const landPos = passer.position.add(
      target.position.subtract(passer.position).multiply(landFraction),
    );
    const jitter = new Vector2(
      random.nextFloat(-3, 3),
      random.nextFloat(-3, 3),
    );
    const finalPos = new Vector2(
      Math.max(0, Math.min(match.pitch.length, landPos.x + jitter.x)),
      Math.max(0, Math.min(match.pitch.width, landPos.y + jitter.y)),
    );

    match.ball.owner = null;
    match.ball.state = BallState.FREE;
    match.ball.position = finalPos;
    match.ball.velocity = direction.multiply(power * 0.25);
    (match.ball as { height: number }).height = 0;
    BallMotionPlanner.start(match.ball, {
      kind: context.decision.type === DecisionType.CROSS ? "CROSS" : "GROUND_PASS",
      origin,
      target: finalPos,
      speed: power,
      peakHeight: context.decision.type === DecisionType.CROSS ? 3.5 : 0,
      curve: context.decision.type === DecisionType.CROSS ? this.crossCurve(context, origin) : 0,
      hasExplicitEffect: context.decision.type === DecisionType.CROSS,
    });
  }

  private startMotion(context: ActionContext, origin: Vector2, destination: Vector2, _target: PlayerMatchState): void {
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
    });
  }

  private crossCurve(context: ActionContext, origin: Vector2): number {
    const technique = context.player.player.attributes.technical.technique / 20;
    const side = origin.y < context.match.pitch.width / 2 ? 1 : -1;
    return side * (1 + technique * 1.5);
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
