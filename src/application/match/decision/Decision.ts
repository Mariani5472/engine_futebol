import { DecisionType } from "./DecisionType";

export class Decision {
  constructor(
    public readonly type: DecisionType,
    public readonly utility: number,
    public readonly targetId?: string
  ) {}
}

