import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { CognitiveContext } from "../../cognitive/CognitiveContext";
import { PlayerMemory } from "../memory/PlayerMemory";
import { BallPrediction } from "./BallPrediction";
import { PlayerPrediction } from "./PlayerPrediction";

export class PredictionSystem {
  public update(
    context: CognitiveContext
  ): void {

    this.predictBall(context);

    this.predictPlayers(
      context.awareness.teammates,
      context.awareness.teammatePredictions,
      context
    );

    this.predictPlayers(
      context.awareness.opponents,
      context.awareness.opponentPredictions,
      context
    );
  }

  private predictBall(
    context: CognitiveContext
  ): void {

    const memory =
      context.awareness.ball;

    const anticipation =
      this.getAnticipationFactor(
        context.player
      );

    const predictedPosition =

      memory.estimatedPosition.add(

        memory.estimatedVelocity.multiply(

          context.deltaTime *

          anticipation

        )

      );

    context.awareness.ballPrediction =
      new BallPrediction(
        predictedPosition,
        memory.estimatedVelocity,
        memory.certainty
      );
  }

  private predictPlayers(
    memories:
      Map<string, PlayerMemory>,
    predictions:
      Map<string, PlayerPrediction>,

    context: CognitiveContext

  ): void {

    const anticipation =

      this.getAnticipationFactor(

        context.player

      );

    for (

      const memory

      of memories.values()

    ) {

      const predictedPosition =

        memory.estimatedPosition.add(

          memory.estimatedVelocity.multiply(

            context.deltaTime *

            anticipation

          )

        );

      const direction =

        memory.estimatedVelocity.normalize();

      predictions.set(

        memory.playerId,

        new PlayerPrediction(
          memory.playerId,
          predictedPosition,
          direction,
          memory.certainty
        )

      );

    }

  }

  private getAnticipationFactor(
    player: PlayerMatchState
  ): number {

    const anticipation =

      player.player.attributes
        .mental
        .anticipation;

    return anticipation / 20;

  }
}