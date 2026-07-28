import { Pitch } from "../../domain";
import { BallMatchState } from "./BallMatchState";
import { TeamMatchState } from "./TeamMatchState";

export class MatchState {

  constructor(
    public readonly home: TeamMatchState,
    public readonly away: TeamMatchState,
    public readonly ball: BallMatchState,
    public readonly pitch: Pitch,
    public currentSecond: number = 0,
    public attackingTeam: TeamMatchState,
    public defendingTeam: TeamMatchState
  ) {}

}
