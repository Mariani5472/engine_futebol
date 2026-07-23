import {
  BallPrediction,
} from "./BallPrediction";

import {
  PlayerPrediction,
} from "./PlayerPrediction";

export class PredictionResult {
  constructor(
    public readonly horizon: number,
    public readonly players: ReadonlyMap<string, PlayerPrediction>,
    public readonly ball: BallPrediction
  ) {}

  public isExpired(
    currentTick: number,
    createdAtTick: number,
    tickDuration: number
  ): boolean {

    const elapsed = (currentTick - createdAtTick) * tickDuration;
    return elapsed > this.horizon;
  }
}