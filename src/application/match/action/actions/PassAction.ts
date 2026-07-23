import { Vector2 } from "../../../../core/geometry/Vector2";
import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { Milliseconds, PlayerId, TeamId } from "../../../../domain";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";

/** Maximum pass speed in m/s. */
const MAX_PASS_SPEED = 28;
/** Minimum pass speed. */
const MIN_PASS_SPEED = 8;
/** Noise angle in radians added to direction on failed pass. */
const FAIL_NOISE_RADIANS = 0.6;

export class PassAction {

  public execute(context: ActionContext): ActionResult {

    const { player, decision, match, random, matchSecond, pitch } = context;
    const targetId = decision.targetId;

    if (!targetId) {
      return this.fail(player.player.id, "No target for pass");
    }

    const target = this.findTeammate(context, targetId);
    if (!target) {
      return this.fail(player.player.id, "Target teammate not found");
    }

    const successProb = this.calculateSuccessProb(context, player, target);
    const success = random.nextFloat(0, 1) < successProb;

    // Release ball from the carrier.
    player.hasBall = false;
    match.ball.owner = null;

    const distance = player.position.distanceTo(target.position);
    const power = this.calculatePower(distance);

    let direction = target.position.subtract(player.position).normalize();

    if (!success) {
      // Add noise to the pass direction.
      const noiseAngle = random.nextFloat(-FAIL_NOISE_RADIANS, FAIL_NOISE_RADIANS);
      direction = direction.rotate(noiseAngle);
    }

    // Launch ball.
    const velocity = direction.multiply(power);
    (match.ball as { velocity: Vector2 }).velocity = velocity;
    (match.ball as { position: Vector2 }).position = player.position;
    (match.ball as { state: BallState }).state = BallState.IN_FLIGHT;
    (match.ball as { height: number }).height = 0;

    void pitch; // pitch available in context if needed later
    void matchSecond;

    return {
      actorId: player.player.id,
      type: decision.type,
      success,
      events: []
    };

  }

  private calculateSuccessProb(
    context: ActionContext,
    passer: PlayerMatchState,
    target: PlayerMatchState
  ): number {

    const attrs = passer.player.attributes;
    const passing = attrs.technical.passing / 20;
    const vision = attrs.mental.vision / 20;
    const technique = attrs.technical.technique / 20;

    const distance = passer.position.distanceTo(target.position);
    const distancePenalty = Math.min(1, distance / 45);

    // Count nearby opponents as pressure.
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

    const fatigueModifier = 1 - (passer.fatigue / 100) * 0.25;

    const raw = (passing * 0.5 + vision * 0.3 + technique * 0.2)
      * (1 - distancePenalty * 0.4)
      * (1 - pressure)
      * fatigueModifier;

    return Math.max(0.05, Math.min(0.98, raw));

  }

  private calculatePower(distance: number): number {
    // Power proportional to distance, clamped to pass speed range.
    const t = Math.min(1, distance / 40);
    return MIN_PASS_SPEED + t * (MAX_PASS_SPEED - MIN_PASS_SPEED);
  }

  private findTeammate(
    context: ActionContext,
    targetId: string
  ): PlayerMatchState | undefined {

    const team = context.match.home.players.includes(context.player)
      ? context.match.home
      : context.match.away;

    return team.players.find(p => p.player.id === targetId);

  }

  private fail(
    playerId: string,
    _reason: string
  ): ActionResult {
    return {
      actorId: playerId,
      type: 1 /* DecisionType.PASS */,
      success: false,
      events: []
    };
  }

}
