import type { LastCompletedPass } from "../../../core/movement/contracts/AssistTracking";
export type { AssistIntervention } from "../../../core/movement/contracts/AssistTracking";

export interface AssistPolicyConfig {
  readonly maxPassAgeSeconds: number;
  readonly allowDefenderDeflection: boolean;
  readonly allowGoalkeeperParry: boolean;
  readonly allowWoodworkRebound: boolean;
}

export class AssistPolicy {
  public constructor(private readonly config: AssistPolicyConfig) {}

  public resolve(lastPass: LastCompletedPass | null, scorerId: string, second: number): string | null {
    if (!lastPass || lastPass.receiverId !== scorerId || lastPass.passerId === scorerId) return null;
    if (second - lastPass.completedAtSecond > this.config.maxPassAgeSeconds) return null;
    for (const intervention of lastPass.interventions) {
      if (intervention === "CONTROL_CHANGE") return null;
      if (intervention === "DEFENDER_DEFLECTION" && !this.config.allowDefenderDeflection) return null;
      if (intervention === "GOALKEEPER_PARRY" && !this.config.allowGoalkeeperParry) return null;
      if (intervention === "WOODWORK" && !this.config.allowWoodworkRebound) return null;
    }
    return lastPass.passerId;
  }
}
