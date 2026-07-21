import { Tactic, Team } from "../../domain";
import { PlayerMatchState } from "./PlayerMatchState";

export class TeamMatchState {

  constructor(

    public readonly team: Team,
    public players: PlayerMatchState[],
    public tactic: Tactic,
    public score = 0

  ) {}

}