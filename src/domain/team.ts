import {
  PlayerId,
  TeamId,
} from "./common";

import {
  Player,
} from "./player";

export type TeamSide =
  | "HOME"
  | "AWAY";

export interface TeamProps {

  readonly id: TeamId;

  readonly name: string;

  readonly players: readonly Player[];
}

export interface TeamInstructions {

  readonly pressingIntensity: number;

  readonly defensiveLineHeight: number;

  readonly tempo: number;

  readonly width: number;

  readonly riskTaking: number;
}

export interface TeamChemistry {

  readonly familiarity: number;

  readonly tacticalFamiliarity: number;
}

export class Team {

  public readonly id: TeamId;

  public readonly name: string;

  private readonly roster:
    readonly Player[];

  private constructor(
    props: TeamProps
  ) {

    this.id =
      props.id;

    this.name =
      props.name;

    this.roster =
      Object.freeze(
        [
          ...props.players,
        ]
      );
  }

  public static create(
    props: TeamProps
  ): Team {

    if (
      !props.name.trim()
    ) {
      throw new Error(
        "Team name cannot be empty."
      );
    }

    if (
      props.players.length === 0
    ) {
      throw new Error(
        "Team must have at least one player."
      );
    }

    const uniqueIds =
      new Set<PlayerId>();

    for (
      const player
      of props.players
    ) {

      if (
        uniqueIds.has(
          player.id
        )
      ) {
        throw new Error(
          `Duplicate player id found in team: ` +
          `${String(player.id)}`
        );
      }

      uniqueIds.add(
        player.id
      );
    }

    return new Team(
      props
    );
  }

  public get players():
    readonly Player[] {

    return this.roster;
  }

  public getPlayerById(
    playerId: PlayerId
  ): Player | undefined {

    return this.roster.find(
      player =>
        player.id === playerId
    );
  }

  public getGoalkeepers():
    readonly Player[] {

    return this.roster.filter(
      player =>
        player.positions.includes(
          "GK"
        )
    );
  }

  public hasPlayer(
    playerId: PlayerId
  ): boolean {

    return this.roster.some(
      player =>
        player.id === playerId
    );
  }
}