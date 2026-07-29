import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { PossessionCandidate } from "../../domain";
import { ReachCalculator } from "./ReachCalculator";
import { BallState, type PossessionAcquisitionReason } from "./BallMatchState";
import { Random } from "../random/Random";
import { Vector2 } from "../geometry/Vector2";
import { DecisionType } from "../../application/match/decision/DecisionType";

const GROUND_CONTROL_RADIUS = 1.15;
const INTERCEPTION_RADIUS = 1.25;
const MAX_CONTROL_HEIGHT = 1.5;

export class PossessionSystem {

  constructor(
    private readonly random: Random,
    private readonly reachCalculator: ReachCalculator
  ) {}

  public update(state: MatchState): void {
    const ball = state.ball;

    if (ball.state === BallState.CONTROLLED && ball.owner) {
      this.syncOwnerFlags(state, ball.owner);
      return;
    }

    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      ball.state = BallState.FREE;
    }

    if (ball.height > MAX_CONTROL_HEIGHT) return;
    const intendedReceiverId = ball.intendedReceiverId;
    const radius = ball.state === BallState.IN_FLIGHT ? INTERCEPTION_RADIUS : GROUND_CONTROL_RADIUS;
    const candidates = this.getCandidates(state, radius);

    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.score - a.score);

    const winner =
      candidates.length === 1
        ? candidates[0].player
        : this.resolveDuel(candidates[0], candidates[1]);

    if (ball.state === BallState.IN_FLIGHT) {
      ball.position = this.closestPointOnSegment(winner.position, ball.previousPosition, ball.position);
    }

    if (!this.controlsBall(winner, state, intendedReceiverId === winner.player.id)) {
      this.deflectAfterFailedControl(state);
      return;
    }
    const reason: PossessionAcquisitionReason = intendedReceiverId === winner.player.id
      ? "INTENDED_RECEPTION"
      : ball.state === BallState.IN_FLIGHT ? "INTERCEPTION" : "PHYSICAL_CLAIM";
    this.givePossession(state, winner, reason);
  }

  private givePossession(state: MatchState, player: PlayerMatchState, reason: PossessionAcquisitionReason): void {
    this.syncOwnerFlags(state, player);

    state.ball.resolvePendingPass(player.player.id, state.currentSecond);
    state.ball.acquirePossession(player, reason, state.currentSecond);
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
    radius: number,
  ): PossessionCandidate[] {
    const players = [...state.home.players, ...state.away.players];
    const candidates: PossessionCandidate[] = [];
    for (const player of players) {
      const distance = state.ball.state === BallState.IN_FLIGHT
        ? this.distanceToSegment(player.position, state.ball.previousPosition, state.ball.position)
        : player.position.distanceTo(state.ball.position);
      const reach = this.reachCalculator.calculateReachTime(player, state.ball);

      if (distance > radius) continue;

      // Soften reach gate: far-but-in-radius players still contest slowly.
      if (reach > 6 && distance > radius * 0.6) continue;

      candidates.push({
        player,
        distance,
        score: this.calculateControlScore(player, reach, distance),
      });
    }

    return candidates;
  }

  private controlsBall(player: PlayerMatchState, state: MatchState, intended: boolean): boolean {
    const a = player.player.attributes;
    const speedPenalty = Math.min(.45, state.ball.velocity.magnitude() * .012);
    const heightPenalty = state.ball.height * .12;
    const quality = a.technical.firstTouch / 20 * .32 + a.mental.composure / 20 * .18 + a.mental.anticipation / 20 * .12;
    const probability = Math.max(.12, Math.min(.96, .28 + quality + (intended ? .12 : 0) - speedPenalty - heightPenalty));
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
