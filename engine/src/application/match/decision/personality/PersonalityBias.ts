export class PersonalityBias {

  constructor(
    public readonly utilityModifier: number,
    public readonly riskToleranceModifier: number,
    public readonly reasons: readonly string[] = []
  ) {}
}