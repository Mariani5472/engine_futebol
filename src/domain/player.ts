import {
  PlayerBase,
  PlayerBaseProps,
  PlayerPosition,
  PlayerRole,
  PreferredFoot,
  PositionFamiliarity,
  PlayerAttributes,
  PlayerPersonality,
  PlayerRelationship,
} from "./PlayerBase";

import {
  LanguageCode,
  PlayerId,
} from "./common";

import {
  PlayerMatchState,
} from "../core/movement/PlayerMatchState";

export {
  PlayerBase,
  PlayerPosition,
  PlayerRole,
  PreferredFoot,
  PositionFamiliarity,
  PlayerAttributes,
  PlayerPersonality,
  PlayerRelationship,
};

export type {
  PlayerBaseProps,
};

export const PLAYER_COLLISION_RADIUS =
  0.35;

export interface PlayerProps
  extends PlayerBaseProps {

  readonly initialMatchState?: {
    readonly position: {
      readonly x: number;
      readonly y: number;
    };

    readonly role?: PlayerRole;
  };
}

export class Player {

  public readonly base: PlayerBase;

  public readonly matchState:
    PlayerMatchState;

  private constructor(
    base: PlayerBase,
    matchState: PlayerMatchState
  ) {
    this.base = base;
    this.matchState = matchState;
  }

  public static create(props: PlayerProps): Player {
    const base = PlayerBase.create(props);

    const matchState = PlayerMatchState.create(base, {
      position: props.initialMatchState?.position ?? {
        x: 0,
        y: 0,
      },
      currentRole: props.initialMatchState?.role ??
        Player.getDefaultRole(base.getPrimaryPosition()),
    }
    );

    return new Player(base, matchState);
  }

  public get id(): PlayerId {
    return this.base.id;
  }

  public get name(): string {
    return this.base.name;
  }

  public get age(): number {
    return this.base.age;
  }

  public get preferredFoot(): PreferredFoot {
    return this.base.preferredFoot;
  }

  public get positions(): readonly PlayerPosition[] {
    return this.base.positions;
  }

  public get positionFamiliarity(): readonly PositionFamiliarity[] {
    return this.base.positionFamiliarity;
  }

  public get attributes(): PlayerAttributes {
    return this.base.attributes;
  }

  public get languages(): readonly LanguageCode[] {
    return this.base.languages;
  }

  public get personality(): PlayerPersonality {
    return this.base.personality;
  }

  public get relationships(): readonly PlayerRelationship[] {
    return this.base.relationships;
  }

  public getPrimaryPosition(): PlayerPosition {
    return this.base.getPrimaryPosition();
  }

  public getFamiliarityFor(position: PlayerPosition): number {
    return this.base.getFamiliarityFor(position);
  }

  public getRelationshipWith(
    playerId: PlayerId
  ): PlayerRelationship | undefined {

    return this.base.getRelationshipWith(
      playerId
    );
  }

  public hasLanguage(language: LanguageCode): boolean {
    return this.base.hasLanguage(language);
  }

  private static getDefaultRole(position: PlayerPosition): PlayerRole {
    switch (position) {
      case "GK":
        return "GOALKEEPER";

      case "DC":
        return "CENTRE_BACK";

      case "DL":
      case "DR":
        return "FULL_BACK";

      case "WBL":
      case "WBR":
        return "WING_BACK";

      case "DM":
        return "DEFENSIVE_MIDFIELDER";

      case "MC":
        return "CENTRAL_MIDFIELDER";

      case "ML":
      case "MR":
        return "WIDE_MIDFIELDER";

      case "AMC":
        return "ATTACKING_MIDFIELDER";

      case "WL":
      case "WR":
        return "WINGER";

      case "ST":
        return "STRIKER";
    }
  }
}