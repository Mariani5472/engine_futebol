export type AssistIntervention =
  | "DEFENDER_DEFLECTION"
  | "GOALKEEPER_PARRY"
  | "WOODWORK"
  | "CONTROL_CHANGE";

/** Causal pass provenance retained by the ball until analytics resolves a goal. */
export interface LastCompletedPass {
  readonly passerId: string;
  readonly receiverId: string;
  readonly completedAtSecond: number;
  readonly interventions: AssistIntervention[];
}
