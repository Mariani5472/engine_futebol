import { Tactic, Team, TacticalPhase } from "../../domain";
import { PlayerMatchState } from "./PlayerMatchState";

export class TeamMatchState {

  public collectivePhase: TacticalPhase = "DEFENSIVE_BLOCK";
  public collectivePhaseSince = 0;

  /** Match second until which non-progressive passes are demoted. */
  public progressiveHoldUntil = 0;
  /** Last successful pass forward gain (m) along attack axis. */
  public lastPassForwardGain = 0;

  /**
   * Match second until which this team cannot select/execute SHOT.
   * Prevents tick=2s from producing hundreds of shots per match.
   */
  public shotLockUntil = 0;
  /** Shots taken while the current continuous ownership spell lasts. */
  public shotsThisPossession = 0;

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
      this.progressiveHoldUntil = Math.max(
        this.progressiveHoldUntil,
        matchSecond + 6,
      );
    }
  }

  public inProgressiveHold(matchSecond: number): boolean {
    return matchSecond < this.progressiveHoldUntil;
  }

  public isShotLocked(matchSecond: number): boolean {
    return matchSecond < this.shotLockUntil;
  }

  /**
   * After a shot is executed: lock further shots for a cool-down window and
   * count this possession's attempts.
   */
  public noteShotTaken(matchSecond: number, cooldownSeconds = 14): void {
    this.shotsThisPossession += 1;
    this.shotLockUntil = Math.max(
      this.shotLockUntil,
      matchSecond + cooldownSeconds,
    );
  }

  /** Call when this team loses or regains a fresh possession spell. */
  public resetPossessionShotCount(): void {
    this.shotsThisPossession = 0;
  }
}
