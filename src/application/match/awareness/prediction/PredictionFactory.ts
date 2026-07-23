import {
  BallPrediction,
} from "./BallPrediction";

import {
  PlayerPrediction,
} from "./PlayerPrediction";

import {
  PredictionResult,
} from "./PredictionResult";

export class PredictionFactory {
  public static create(
    horizon: number,
    players: Map<string, PlayerPrediction>,
    ball: BallPrediction
  ): PredictionResult {
    if (horizon <= 0) {
      throw new Error("Prediction horizon must be greater than zero.");
    }

    return new PredictionResult(
      horizon,
      new Map(players),
      ball
    );
  }
}