import { Tactic, Team } from "../../domain";
import { PlayerMatchState } from "./PlayerMatchState";

export class TeamMatchState {

  /** Match second until which non-progressive passes are demoted. */
  public progressiveHoldUntil = 0;
  /** Last successful pass forward gain (m) along attack axis. */
  public lastPassForwardGain = 0;

  constructor(

    public readonly team: Team,
    public readonly attackingDirection: 1 | -1,
    public players: PlayerMatchState[],
    public tactic: Tactic,
    public score = 0

  ) {}

  public noteProgressivePass(matchSecond: number, forwardGain: number): void {
    this.lastPassForwardGain = forwardGain;
    if (forwardGain >= 8) {
      // Hold progressive intent for a few seconds of simulation time.
      this.progressiveHoldUntil = Math.max(
        this.progressiveHoldUntil,
        matchSecond + 6,
      );
    }
  }

  public inProgressiveHold(matchSecond: number): boolean {
    return matchSecond < this.progressiveHoldUntil;
  }
}
