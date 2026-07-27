import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { PossessionCandidate } from "../../domain";
import { ReachCalculator } from "./ReachCalculator";
import { BallState } from "./BallMatchState";
import { Random } from "../random/Random";

export class PossessionSystem {

  constructor(
    private readonly random: Random,
    private readonly reachCalculator: ReachCalculator
  ) {}

  public update(state: MatchState): void {
    const ball = state.ball;

    // Controlled with a living owner → keep owner and ball glued together.
    if (ball.state === BallState.CONTROLLED && ball.owner) {
      this.syncOwnerFlags(state, ball.owner);
      ball.position = ball.owner.position;
      ball.velocity = ball.owner.velocity;
      return;
    }

    // Orphan CONTROLLED (owner lost / null) → treat as free and contest.
    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      ball.state = BallState.FREE;
    }

    const candidates = this.getCandidates(state);
    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.score - a.score);

    const winner =
      candidates.length === 1
        ? candidates[0].player
        : this.resolveDuel(candidates[0], candidates[1]);

    this.givePossession(state, winner);
  }

  private givePossession(state: MatchState, player: PlayerMatchState): void {
    this.syncOwnerFlags(state, player);

    state.ball.owner = player;
    state.ball.state = BallState.CONTROLLED;
    state.ball.position = player.position;
    state.ball.velocity = player.velocity;
  }

  /** Exactly one player may have hasBall=true. */
  private syncOwnerFlags(state: MatchState, owner: PlayerMatchState): void {
    for (const p of [...state.home.players, ...state.away.players]) {
      p.hasBall = p === owner;
    }
  }

  private getCandidates(state: MatchState): PossessionCandidate[] {
    const players = [...state.home.players, ...state.away.players];
    const candidates: PossessionCandidate[] = [];

    for (const player of players) {
      const reach = this.reachCalculator.calculateReachTime(player, state.ball);

      // Slightly more generous contest window so loose balls are recovered.
      if (reach > 2.8) continue;

      candidates.push({
        player,
        distance: player.position.distanceTo(state.ball.position),
        score: this.calculateControlScore(player, reach),
      });
    }

    return candidates;
  }

  private calculateControlScore(
    player: PlayerMatchState,
    reachTime: number,
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
    score -= reachTime * 15;

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
