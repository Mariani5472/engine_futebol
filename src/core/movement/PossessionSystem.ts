import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { PossessionCandidate } from "../../domain";
import { ReachCalculator } from "./ReachCalculator";
import { BallState } from "./BallMatchState";

export class PossessionSystem {

  private readonly reachCalculator = new ReachCalculator();

  public update(
    state: MatchState
  ): void {

    if (state.ball.state === BallState.CONTROLLED) {
      return;
    }

    const candidates =
      this.getCandidates(state);

    if (candidates.length === 0) {
      return;
    }

    candidates.sort(
      (a, b) => b.score - a.score
    );

    let winner: PlayerMatchState;

    if (candidates.length === 1) {

      winner = candidates[0].player;

    } else {

      winner = this.resolveDuel(
        candidates[0],
        candidates[1]
      );

    }

    this.givePossession(
      state,
      winner
    );

  }

  private givePossession(
    state: MatchState,
    player: PlayerMatchState
  ): void {

    for (const p of [
      ...state.home.players,
      ...state.away.players
    ]) {

      p.hasBall = false;

    }

    player.hasBall = true;

    state.ball.owner = player;

    state.ball.state = BallState.CONTROLLED;

    state.ball.position = player.position;

    state.ball.velocity = player.velocity;

  }

  private getCandidates(
    state: MatchState
  ): PossessionCandidate[] {

    const players = [
      ...state.home.players,
      ...state.away.players
    ];

    const candidates: PossessionCandidate[] = [];

    for (const player of players) {

      const reach =
        this.reachCalculator.calculateReachTime(
          player,
          state.ball
        );

      if (reach > 2) {
        continue;
      }

      candidates.push({

        player,

        distance:
          player.position.distanceTo(
            state.ball.position
          ),

        score:
          this.calculateControlScore(
            player,
            reach
          )

      });

    }

    return candidates;

  }

  private calculateControlScore(
    player: PlayerMatchState,
    reachTime: number
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

    score *= (1 - player.fatigue / 100);

    score -= reachTime * 15;

    return score;

  }

  private resolveDuel(
    first: PossessionCandidate,
    second: PossessionCandidate
  ): PlayerMatchState {

    const total =
      first.score +
      second.score;

    const probability =
      first.score / total;

    return Math.random() < probability
      ? first.player
      : second.player;

  }

}