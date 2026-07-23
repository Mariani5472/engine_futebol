import { BallMatchState } from "./BallMatchState";
import { TeamMatchState } from "./TeamMatchState";
export class MatchState {
  constructor(
    public readonly home: TeamMatchState,
    public readonly away: TeamMatchState,
    public readonly ball: BallMatchState,
    public currentSecond = 0,
    public attackingTeam: TeamMatchState,
    public defendingTeam: TeamMatchState
  ) {}
}