export type TeamPossessionState =
  | "controlledPossession"
  | "probablePossession"
  | "contestedPossession"
  | "transitionToAttack"
  | "transitionToDefense"
  | "defending";

export interface PossessionPrediction {
  readonly likelyTeamId?: string;
  readonly likelyReceiverId?: string;
  readonly confidence: number;
  readonly estimatedControlTime?: number;
  readonly interceptionRisk: number;
  readonly state: "controlled" | "probable" | "contested" | "likelyTurnover";
  readonly estimatedArrivalTimes: Readonly<Record<string, number>>;
  readonly transitionReason: string;
}

