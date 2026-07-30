export interface FoulRecord {
  readonly playerId: string;
  readonly teamId: string;
  yellowCards: number;
  redCard: boolean;
}
