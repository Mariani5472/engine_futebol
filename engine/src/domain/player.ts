import {
  AttributeValue,
  LanguageCode,
  PlayerId,
  createAttributeValue,
} from "./common";

export type PreferredFoot = "LEFT" | "RIGHT" | "BOTH";

export const PLAYER_COLLISION_RADIUS = 0.35;

export type PlayerPosition =
  | "GK"
  | "DC"
  | "DL"
  | "DR"
  | "WBL"
  | "WBR"
  | "DM"
  | "MC"
  | "ML"
  | "MR"
  | "AMC"
  | "WL"
  | "WR"
  | "ST";

export type PlayerRole =
  | "GOALKEEPER"
  | "CENTRE_BACK"
  | "FULL_BACK"
  | "WING_BACK"
  | "DEFENSIVE_MIDFIELDER"
  | "CENTRAL_MIDFIELDER"
  | "WIDE_MIDFIELDER"
  | "ATTACKING_MIDFIELDER"
  | "WINGER"
  | "STRIKER";

export interface PositionFamiliarity {
  readonly position: PlayerPosition;
  readonly familiarity: AttributeValue;
}

export interface MentalAttributes {
  readonly aggression: AttributeValue;
  readonly anticipation: AttributeValue;
  readonly bravery: AttributeValue;
  readonly composure: AttributeValue;
  readonly concentration: AttributeValue;
  readonly decisions: AttributeValue;
  readonly determination: AttributeValue;
  readonly flair: AttributeValue;
  readonly leadership: AttributeValue;
  readonly offTheBall: AttributeValue;
  readonly positioning: AttributeValue;
  readonly teamwork: AttributeValue;
  readonly vision: AttributeValue;
  readonly workRate: AttributeValue;
}

export interface PhysicalAttributes {
  readonly acceleration: AttributeValue;
  readonly agility: AttributeValue;
  readonly balance: AttributeValue;
  readonly jumpingReach: AttributeValue;
  readonly naturalFitness: AttributeValue;
  readonly pace: AttributeValue;
  readonly strength: AttributeValue;
  readonly stamina: AttributeValue;
}

export interface TechnicalAttributes {
  readonly corners: AttributeValue;
  readonly crossing: AttributeValue;
  readonly dribbling: AttributeValue;
  readonly finishing: AttributeValue;
  readonly firstTouch: AttributeValue;
  readonly freeKickTaking: AttributeValue;
  readonly heading: AttributeValue;
  readonly longShots: AttributeValue;
  readonly longThrows: AttributeValue;
  readonly marking: AttributeValue;
  readonly passing: AttributeValue;
  readonly penaltyTaking: AttributeValue;
  readonly tackling: AttributeValue;
  readonly technique: AttributeValue;
}

export interface GoalkeepingAttributes {
  readonly aerialReach: AttributeValue;
  readonly commandOfArea: AttributeValue;
  readonly communication: AttributeValue;
  readonly eccentricity: AttributeValue;
  readonly handling: AttributeValue;
  readonly kicking: AttributeValue;
  readonly oneOnOnes: AttributeValue;
  readonly reflexes: AttributeValue;
  readonly rushingOut: AttributeValue;
  readonly tendencyToPunch: AttributeValue;
  readonly throwing: AttributeValue;
}

export interface HiddenAttributes {
  readonly adaptability: AttributeValue;
  readonly ambition: AttributeValue;
  readonly consistency: AttributeValue;
  readonly dirtiness: AttributeValue;
  readonly importantMatches: AttributeValue;
  readonly injuryProneness: AttributeValue;
  readonly loyalty: AttributeValue;
  readonly pressure: AttributeValue;
  readonly professionalism: AttributeValue;
  readonly sportsmanship: AttributeValue;
  readonly temperament: AttributeValue;
  readonly versatility: AttributeValue;
}

export interface PlayerAttributes {
  readonly mental: MentalAttributes;
  readonly physical: PhysicalAttributes;
  readonly technical: TechnicalAttributes;
  readonly goalkeeping: GoalkeepingAttributes;
  readonly hidden: HiddenAttributes;
}

export interface PlayerRelationship {
  readonly playerId: PlayerId;
  readonly chemistry: AttributeValue; // 1-20
}

export interface PlayerPersonality {
  readonly adaptability: AttributeValue;
  readonly ambition: AttributeValue;
  readonly loyalty: AttributeValue;
  readonly professionalism: AttributeValue;
  readonly pressure: AttributeValue;
  readonly sportsmanship: AttributeValue;
  readonly temperament: AttributeValue;
}

export interface PlayerProps {
  readonly id: PlayerId;
  readonly name: string;
  readonly age: number;
  readonly preferredFoot: PreferredFoot;
  readonly positions: readonly PlayerPosition[];
  readonly positionFamiliarity: readonly PositionFamiliarity[];
  readonly attributes: PlayerAttributes;
  readonly languages: readonly LanguageCode[];
  readonly personality: PlayerPersonality;
  readonly relationships: readonly PlayerRelationship[];
}

export class Player {
  public readonly id: PlayerId;
  public readonly name: string;
  public readonly age: number;
  public readonly preferredFoot: PreferredFoot;
  public readonly positions: readonly PlayerPosition[];
  public readonly positionFamiliarity: readonly PositionFamiliarity[];
  public readonly attributes: PlayerAttributes;
  public readonly languages: readonly LanguageCode[];
  public readonly personality: PlayerPersonality;
  public readonly relationships: readonly PlayerRelationship[];

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.name = props.name;
    this.age = props.age;
    this.preferredFoot = props.preferredFoot;
    this.positions = props.positions;
    this.positionFamiliarity = props.positionFamiliarity;
    this.attributes = props.attributes;
    this.languages = props.languages;
    this.personality = props.personality;
    this.relationships = props.relationships;
  }

  public static create(props: PlayerProps): Player {
    if (!props.name.trim()) {
      throw new Error("Player name cannot be empty.");
    }

    if (!Number.isInteger(props.age) || props.age < 14 || props.age > 50) {
      throw new Error("Player age must be between 14 and 50.");
    }

    if (props.positions.length === 0) {
      throw new Error("Player must have at least one position.");
    }

    return new Player(props);
  }

  public getPrimaryPosition(): PlayerPosition {
    return this.positions[0];
  }

  public getFamiliarityFor(position: PlayerPosition): number {
    const item = this.positionFamiliarity.find((p) => p.position === position);
    return item ? item.familiarity : createAttributeValue(1);
  }

  public getRelationshipWith(playerId: PlayerId): PlayerRelationship | undefined {
    return this.relationships.find((relationship) => relationship.playerId === playerId);
  }

  public hasLanguage(language: LanguageCode): boolean {
    return this.languages.includes(language);
  }
}