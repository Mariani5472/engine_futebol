export class MemoryDecay {
  public calculate(
    certainty: number,
    elapsedTicks: number
  ): number {
    const decayRate = 0.985;
    return Math.max(
      0,
      certainty * Math.pow(
        decayRate,
        elapsedTicks
      )
    );
  }
}