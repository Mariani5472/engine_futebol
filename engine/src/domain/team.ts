import { PlayerId, TeamId } from "./common";
import { Player } from "./player";

export type TeamSide = "HOME" | "AWAY";

export interface TeamProps {
  readonly id: TeamId;
  readonly name: string;
  readonly players: readonly Player[];
}

export interface TeamInstructions {
  readonly pressingIntensity: number; // 0-100
  readonly defensiveLineHeight: number; // 0-100
  readonly tempo: number; // 0-100
  readonly width: number; // 0-100
  readonly riskTaking: number; // 0-100
}

export interface TeamChemistry {
  readonly familiarity: number; // 0-100
  readonly tacticalFamiliarity: number; // 0-100
}

export class Team {
  public readonly id: TeamId;
  public readonly name: string;
  public readonly players: readonly Player[];

  private constructor(props: TeamProps) {
    this.id = props.id;
    this.name = props.name;
    this.players = props.players;
  }

  public static create(props: TeamProps): Team {
    if (!props.name.trim()) {
      throw new Error("Team name cannot be empty.");
    }

    if (props.players.length === 0) {
      throw new Error("Team must have at least one player.");
    }

    const uniqueIds = new Set<PlayerId>();
    for (const player of props.players) {
      if (uniqueIds.has(player.id)) {
        throw new Error(`Duplicate player id found in team: ${String(player.id)}`);
      }
      uniqueIds.add(player.id);
    }

    return new Team(props);
  }

  public getPlayerById(playerId: PlayerId): Player | undefined {
    return this.players.find((player) => player.id === playerId);
  }

  public getGoalkeepers(): readonly Player[] {
    return this.players.filter((player) => player.positions.includes("GK"));
  }
}