import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { PossessionCandidate } from "../../domain";
import { ReachCalculator } from "./ReachCalculator";
import { BallState } from "./BallMatchState";
import { Random } from "../random/Random";

/** Primary contest radius around a free ball. */
const CLAIM_RADIUS = 7;

/**
 * If nobody is inside CLAIM_RADIUS, still hand the ball to the nearest player
 * within this secondary radius so FREE balls after shots/failed passes do not
 * sit unowned for hundreds of ticks (ownership collapse ~0.5%).
 */
const FALLBACK_CLAIM_RADIUS = 16;

const SLOW_BALL_SPEED = 3;
const EMERGENCY_RECLAIM_AFTER_SECONDS = 6;

export class PossessionSystem {

  private freeBallSinceSecond: number | null = null;

  constructor(
    private readonly random: Random,
    private readonly reachCalculator: ReachCalculator
  ) {}

  public update(state: MatchState): void {
    const ball = state.ball;

    if (ball.state === BallState.CONTROLLED && ball.owner) {
      this.freeBallSinceSecond = null;
      this.syncOwnerFlags(state, ball.owner);
      ball.position = ball.owner.position;
      ball.velocity = ball.owner.velocity;
      return;
    }

    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      ball.state = BallState.FREE;
    }

    if (
      ball.state === BallState.IN_FLIGHT &&
      ball.velocity.magnitude() < SLOW_BALL_SPEED &&
      (ball.height ?? 0) < 1.5
    ) {
      ball.state = BallState.FREE;
      ball.height = 0;
    }

    if (ball.state === BallState.FREE && this.freeBallSinceSecond === null) {
      this.freeBallSinceSecond = state.currentSecond;
    }

    // Only contest FREE (or slow) balls.
    if (ball.state === BallState.IN_FLIGHT && ball.velocity.magnitude() > SLOW_BALL_SPEED) {
      return;
    }

    let candidates = this.getCandidates(state, CLAIM_RADIUS);

    // Fallback: never leave a stationary/slow FREE ball without an owner.
    if (candidates.length === 0 && ball.state === BallState.FREE) {
      candidates = this.getCandidates(state, FALLBACK_CLAIM_RADIUS);
    }

    if (candidates.length === 0 && ball.state === BallState.FREE) {
      // Emergency fallback only after the ball has remained unclaimed.
      const freeForSeconds =
        state.currentSecond - (this.freeBallSinceSecond ?? state.currentSecond);
      if (freeForSeconds < EMERGENCY_RECLAIM_AFTER_SECONDS) return;

      const nearest = this.nearestPlayer(state);
      if (nearest) {
        this.givePossession(state, nearest);
      }
      return;
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.score - a.score);

    const winner =
      candidates.length === 1
        ? candidates[0].player
        : this.resolveDuel(candidates[0], candidates[1]);

    this.givePossession(state, winner);
  }

  private givePossession(state: MatchState, player: PlayerMatchState): void {
    this.freeBallSinceSecond = null;
    this.syncOwnerFlags(state, player);

    state.ball.owner = player;
    state.ball.state = BallState.CONTROLLED;
    state.ball.position = player.position;
    state.ball.velocity = player.velocity;
    state.ball.height = 0;
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
    const ballSpeed = state.ball.velocity.magnitude();

    for (const player of players) {
      const distance = player.position.distanceTo(state.ball.position);
      const reach = this.reachCalculator.calculateReachTime(player, state.ball);

      if (
        state.ball.state === BallState.IN_FLIGHT &&
        ballSpeed > SLOW_BALL_SPEED &&
        distance > 2.5
      ) {
        continue;
      }

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

  private nearestPlayer(state: MatchState): PlayerMatchState | null {
    const players = [...state.home.players, ...state.away.players];
    if (players.length === 0) return null;

    let best = players[0];
    let bestDist = best.position.distanceTo(state.ball.position);
    for (let i = 1; i < players.length; i++) {
      const d = players[i].position.distanceTo(state.ball.position);
      if (d < bestDist) {
        best = players[i];
        bestDist = d;
      }
    }
    return best;
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
