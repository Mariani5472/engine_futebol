import { BallPrediction } from "./BallPrediction";
import { PlayerPrediction } from "./PlayerPrediction";

export class PredictionResult {
  constructor(
    public readonly players: Map<string, PlayerPrediction>,
    public readonly ball: BallPrediction
  ) {}
}