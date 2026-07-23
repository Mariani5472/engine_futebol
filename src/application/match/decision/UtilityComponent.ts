import { UtilityReason } from "./UtilityReason";
export class UtilityComponent {
  constructor(
    public readonly value: number,
    public readonly reasons: UtilityReason[]
  ) {}
}