import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { PossessionCandidate } from "../../domain";
import { ReachCalculator } from "./ReachCalculator";
import { BallState } from "./BallMatchState";
import { Random } from "../random/Random";

/** Hard distance (m) within which a player can always contest a free ball. */
const CLAIM_RADIUS = 4.5;

export class PossessionSystem {

  constructor(
    private readonly random: Random,
    private readonly reachCalculator: ReachCalculator
  ) {}

  public update(state: MatchState): void {
    const ball = state.ball;

    if (ball.state === BallState.CONTROLLED && ball.owner) {
      this.syncOwnerFlags(state, ball.owner);
      ball.position = ball.owner.position;
      ball.velocity = ball.owner.velocity;
      return;
    }

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

  private syncOwnerFlags(state: MatchState, owner: PlayerMatchState): void {
    for (const p of [...state.home.players, ...state.away.players]) {
      p.hasBall = p === owner;
    }
  }

  private getCandidates(state: MatchState): PossessionCandidate[] {
    const players = [...state.home.players, ...state.away.players];
    const candidates: PossessionCandidate[] = [];

    for (const player of players) {
      const distance = player.position.distanceTo(state.ball.position);
      const reach = this.reachCalculator.calculateReachTime(player, state.ball);

      // Either close in absolute distance OR can reach soon.
      if (distance > CLAIM_RADIUS && reach > 3.5) continue;

      candidates.push({
        player,
        distance,
        score: this.calculateControlScore(player, reach, distance),
      });
    }

    return candidates;
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
