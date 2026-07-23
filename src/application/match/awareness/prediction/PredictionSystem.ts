import { CognitiveContext } from "../../cognitive/CognitiveContext";
import { PlayerPrediction } from "./PlayerPrediction";
import {
  PredictionFactory,
} from "./PredictionFactory";

const DEFAULT_PREDICTION_HORIZON = 1;
export class PredictionSystem {

  private readonly horizon = DEFAULT_PREDICTION_HORIZON;

  public update(context: CognitiveContext): void {

    const ball = this.predictBall(
      context
    );

    const players = new Map<string, PlayerPrediction>();

    this.predictPlayers(
      context.awareness.teammates,
      players,
      context
    );

    this.predictPlayers(
      context.awareness.opponents,
      players,
      context
    );

    const result = PredictionFactory.create(
      this.horizon,
      players,
      ball
    );

    context.awareness.ballPrediction = result.ball;
  }
}