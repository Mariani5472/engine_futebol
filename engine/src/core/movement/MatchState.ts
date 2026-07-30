import { Pitch } from "../../domain";
import { BallMatchState } from "./BallMatchState";
import { TeamMatchState } from "./TeamMatchState";

export interface KickoffMatchState {
  readonly teamId: string;
  readonly takerId: string;
  readonly receiverId: string;
  readonly executeAt: number;
  launched: boolean;
}

export interface PendingGoalRestart {
  readonly concedingTeamId: string;
  readonly executeAt: number;
  readonly goalEventId: string;
}

export type RestartType = "THROW_IN" | "CORNER" | "GOAL_KICK";

export interface RestartMatchState {
  readonly type: RestartType;
  readonly teamId: string;
  readonly takerId: string;
  readonly receiverId: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly executeAt: number;
  launched: boolean;
}

export class MatchState {

  constructor(
    public readonly home: TeamMatchState,
    public readonly away: TeamMatchState,
    public readonly ball: BallMatchState,
    public readonly pitch: Pitch,
    public currentSecond: number = 0,
    public attackingTeam: TeamMatchState,
    public defendingTeam: TeamMatchState,
    public kickoff: KickoffMatchState | null = null,
    public pendingGoalRestart: PendingGoalRestart | null = null,
    public restart: RestartMatchState | null = null,
  ) {}

}
