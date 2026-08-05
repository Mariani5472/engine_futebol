import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import type { PossessionCandidate } from "./contracts/PossessionCandidate";
import { ReachCalculator } from "./ReachCalculator";
import { BallState, type PossessionAcquisitionReason } from "./BallMatchState";
import { Random } from "../random/Random";
import { Vector2 } from "../geometry/Vector2";
import { DecisionType } from "../../application/match/decision/DecisionType";

const GROUND_CONTROL_RADIUS = 1.15;
const INTERCEPTION_RADIUS = 0.85;
const INTENDED_RECEPTION_RADIUS = 1.5;
const MAX_CONTROL_HEIGHT = 2.6;

export class PossessionSystem {

  constructor(
    private readonly random: Random,
    private readonly reachCalculator: ReachCalculator
  ) {}

  public update(state: MatchState): void {
    const ball = state.ball;

    // A shot is resolved exclusively by BallPhysicsSystem. Letting the generic
    // control contest acquire it here cancels BallMotion while leaving the
    // ShotExecution alive, producing an orphan shot with no terminal outcome.
    // Defender blocks and goalkeeper contacts are segment-based interactions;
    // possession may be contested again only after a rebound/deflection clears
    // activeShot.
    if (ball.activeShot !== null) return;

    if (ball.state === BallState.CONTROLLED && ball.owner) {
      this.syncOwnerFlags(state, ball.owner);
      return;
    }

    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      ball.state = BallState.FREE;
    }

    if (ball.height > MAX_CONTROL_HEIGHT) return;
    const intendedReceiverId = ball.intendedReceiverId;
    const candidates = this.getCandidates(state);

    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.score - a.score);

    const winner =
      candidates.length === 1
        ? candidates[0].player
        : this.resolveDuel(candidates[0], candidates[1]);
    const winnerTeam = state.home.players.includes(winner) ? state.home : state.away;
    const opponent = candidates
      .map(candidate => candidate.player)
      .find(candidate => candidate !== winner && !winnerTeam.players.includes(candidate)) ?? null;

    if (ball.state === BallState.IN_FLIGHT) {
      ball.position = this.closestPointOnSegment(winner.position, ball.previousPosition, ball.position);
    }

    if (!this.controlsBall(winner, state, intendedReceiverId === winner.player.id)) {
      // Completion and control are separate facts. If the pass physically
      // reaches a teammate, record the pass as completed even when a poor
      // first touch spills the ball and possession is subsequently lost.
      const pending = ball.pendingPass;
      if (pending && (pending.teammateIds ?? [pending.intendedReceiverId]).includes(winner.player.id)) {
        const intended = [...state.home.players, ...state.away.players]
          .find(player => player.player.id === pending.intendedReceiverId);
        ball.noteTouch(winner.player.id);
        ball.resolvePendingPass(
          winner.player.id,
          state.currentSecond,
          intended?.position.distanceTo(ball.position) ?? null,
        );
      }
      winner.controlAttemptLockUntil = state.currentSecond + .65;
      this.deflectAfterFailedControl(state);
      return;
    }
    const reason: PossessionAcquisitionReason = intendedReceiverId === winner.player.id
      ? "INTENDED_RECEPTION"
      : ball.state === BallState.IN_FLIGHT ? "INTERCEPTION" : "PHYSICAL_CLAIM";
    this.givePossession(
      state, winner, reason, opponent !== null, opponent?.player.id ?? null,
      opponent && ball.height > .9 ? "AERIAL" : opponent ? "LOOSE_BALL" : undefined,
    );
  }

  private givePossession(
    state: MatchState,
    player: PlayerMatchState,
    reason: PossessionAcquisitionReason,
    contested: boolean,
    opponentId: string | null,
    duelKind?: "LOOSE_BALL" | "AERIAL" | "SHOULDER",
  ): void {
    this.syncOwnerFlags(state, player);

    const incomingSpeed = state.ball.velocity.subtract(player.velocity).magnitude();
    const controlSeconds = Math.min(1.1, .38 + incomingSpeed * .022 + state.ball.height * .12);
    const intended=state.ball.pendingPass
      ? [...state.home.players,...state.away.players].find(candidate=>candidate.player.id===state.ball.pendingPass!.intendedReceiverId)
      : undefined;
    const causalActionId = state.ball.pendingPass?.actionId;
    state.ball.resolvePendingPass(player.player.id,state.currentSecond,intended?.position.distanceTo(state.ball.position)??null);
    state.ball.acquirePossession(player, reason, state.currentSecond, contested, causalActionId, opponentId, duelKind);
    player.possessionControlUntil = state.currentSecond + controlSeconds;
    player.possessionProtectedUntil = state.currentSecond + Math.min(.65, controlSeconds * .7);
    player.actionLockUntil = Math.max(player.actionLockUntil, player.possessionControlUntil);
    state.ball.state = BallState.CONTROLLED;
    state.ball.velocity = state.ball.velocity.multiply(.2);
    state.ball.height = 0;
    player.lastActionType = DecisionType.RECEIVE;
  }

  private syncOwnerFlags(state: MatchState, owner: PlayerMatchState): void {
    for (const p of [...state.home.players, ...state.away.players]) {
      p.hasBall = p === owner;
    }
  }

  private getCandidates(
    state: MatchState,
  ): PossessionCandidate[] {
    const players = [...state.home.players, ...state.away.players];
    const candidates: PossessionCandidate[] = [];
    for (const player of players) {
      if (state.ball.restrictedTouchPlayerId === player.player.id) continue;
      if (state.ball.state === BallState.IN_FLIGHT
        && state.ball.pendingPass?.passerId === player.player.id) continue;
      if (state.currentSecond < player.controlAttemptLockUntil) continue;
      if (state.ball.height > 1.5) {
        const jumping = Number(player.player.attributes.physical.jumpingReach ?? 10) / 20;
        const heading = Number(player.player.attributes.technical.heading ?? 10) / 20;
        const verticalReach = 1.55 + jumping * .75 + heading * .25;
        if (state.ball.height > verticalReach) continue;
      }
      const distance = state.ball.state === BallState.IN_FLIGHT
        ? this.distanceToSegment(player.position, state.ball.previousPosition, state.ball.position)
        : player.position.distanceTo(state.ball.position);
      const intended = state.ball.intendedReceiverId === player.player.id && state.ball.pendingPass !== null;
      const radius = state.ball.state === BallState.IN_FLIGHT
        ? intended ? INTENDED_RECEPTION_RADIUS : INTERCEPTION_RADIUS
        : intended ? INTENDED_RECEPTION_RADIUS : GROUND_CONTROL_RADIUS;
      const reach = this.reachCalculator.calculateReachTime(player, state.ball);

      if (distance > radius) continue;

      // Soften reach gate: far-but-in-radius players still contest slowly.
      if (reach > 6 && distance > radius * 0.6) continue;

      candidates.push({
        player,
        distance,
        score: this.calculateControlScore(player, reach, distance) + (intended ? 24 : 0),
      });
    }

    return candidates;
  }

  private controlsBall(player: PlayerMatchState, state: MatchState, intended: boolean): boolean {
    const a = player.player.attributes;
    const relativeSpeed = state.ball.velocity.subtract(player.velocity).magnitude();
    // A well-aimed pass must not be subjected to the same control lottery as
    // an interception. Ground-pass speed is expected and the receiver has
    // already adjusted body/route to the causal destination.
    const speedPenalty = intended
      ? Math.min(.35, Math.max(0, relativeSpeed - 10) / 30 * .35)
      : Math.min(.86, Math.max(0, relativeSpeed - 4) / 22 * .86);
    const heightPenalty = state.ball.height * (intended ? .10 : .16);
    const incoming = state.ball.velocity.magnitude() > .01 ? state.ball.velocity.multiply(-1).normalize() : player.facingDirection;
    const orientation = (player.facingDirection.normalize().dot(incoming) + 1) / 2;
    const orientationPenalty = (1 - orientation) * (intended ? .08 : .28);
    const quality = a.technical.firstTouch / 20 * .32 + a.mental.composure / 20 * .18 + a.mental.anticipation / 20 * .12;
    const floor = intended ? .55 : state.ball.state === BallState.IN_FLIGHT ? .015 : .1;
    const probability = Math.max(floor, Math.min(.97, .28 + quality + (intended ? .26 : 0) - speedPenalty - heightPenalty - orientationPenalty));
    return this.random.nextFloat(0, 1) < probability;
  }

  private deflectAfterFailedControl(state: MatchState): void {
    const ball = state.ball;
    const speed = Math.max(2, ball.velocity.magnitude() * .35);
    const direction = ball.velocity.magnitude() > .01 ? ball.velocity.normalize() : new Vector2(1, 0);
    ball.release();
    ball.motion = null;
    ball.intendedReceiverId = null;
    ball.state = BallState.DEFLECTED;
    ball.velocity = direction.rotate(this.random.nextFloat(-.45, .45)).multiply(speed);
    ball.height = Math.min(.5, ball.height * .3);
  }

  private distanceToSegment(point: Vector2, start: Vector2, end: Vector2): number {
    return point.distanceTo(this.closestPointOnSegment(point, start, end));
  }

  private closestPointOnSegment(point: Vector2, start: Vector2, end: Vector2): Vector2 {
    const segment = end.subtract(start);
    const lengthSquared = segment.dot(segment);
    if (lengthSquared === 0) return end;
    const t = Math.max(0, Math.min(1, point.subtract(start).dot(segment) / lengthSquared));
    return start.add(segment.multiply(t));
  }

  private calculateControlScore(
    player: PlayerMatchState,
    reachTime: number,
    distance: number,
  ): number {
    const a = player.player.attributes;

    let score = 0;
    score += a.technical.firstTouch * 3;
    score += a.mental.anticipation * 2;
    score += a.mental.composure * 2;
    score += a.physical.balance * 1.5;
    score += a.physical.agility * 1.5;
    score += a.physical.acceleration;
    score += a.hidden.consistency;

    score *= 1 - player.fatigue / 100;
    score -= reachTime * 12;
    score -= distance * 2;

    return score;
  }

  private resolveDuel(
    first: PossessionCandidate,
    second: PossessionCandidate,
  ): PlayerMatchState {
    const total = first.score + second.score;
    const probability = total > 0 ? first.score / total : 0.5;

    return this.random.nextFloat(0, 1) < probability
      ? first.player
      : second.player;
  }
}
