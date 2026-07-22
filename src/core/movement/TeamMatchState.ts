import { Tactic, Team } from "../../domain";
import { PlayerMatchState } from "./PlayerMatchState";

export class TeamMatchState {

  constructor(

    public readonly team: Team,
    public readonly attackingDirection: 1 | -1,
    public players: PlayerMatchState[],
    public tactic: Tactic,
    public score = 0

  ) {}

}