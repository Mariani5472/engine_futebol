import { Vector2 } from "../../../core/geometry/Vector2";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { Random } from "../../../core/random/Random";
import { PerceivedEntity } from "../perception/PerceivedEntity";
import { Visibility } from "../perception/Visibility";
import { CognitiveContext } from "./CognitiveContext";
import { NoiseResult } from "./NoiseResult";

export class NoiseSystem {
  constructor(
    private readonly random: Random
  ) {}
  public update(
    context: CognitiveContext
  ): void {
    this.updateBall(context);

    this.updatePlayers(
      context.perception.teammates,
      context
    );

    this.updatePlayers(
      context.perception.opponents,
      context
    );

  }

  private updateBall(
    context: CognitiveContext
  ): void {

    const ball =
      context.perception.ball;

    if (
      ball.visibility !==
      Visibility.VISIBLE
    ) {
      return;
    }

    const noise =
      this.calculateNoise(

        context.player,

        ball.position

      );

    ball.position =
      noise.position;

  }

  private updatePlayers(
    players: PerceivedEntity[],
    context: CognitiveContext
  ): void {

    for (const perceived of players) {

      if (
        perceived.visibility !==
        Visibility.VISIBLE
      ) {
        continue;
      }

      const noise =
        this.calculateNoise(

          context.player,

          perceived.position

        );

      perceived.position =
        noise.position;

    }

  }

  private calculateNoise(
    player: PlayerMatchState,
    target: Vector2
  ): NoiseResult {

    const radius = this.calculateNoiseRadius(player);

    const angle =
      this.random.nextFloat(
        0,
        Math.PI * 2
      );

    const distance =
      this.random.nextFloat(
        0,
        radius
      );

    const offset =
      Vector2
        .fromAngle(angle)
        .multiply(distance);

    return new NoiseResult(

      target.add(offset),

      angle,

      distance

    );

  }

  private calculateNoiseRadius(
    player: PlayerMatchState
  ): number {

    const mental = player.player.attributes.mental;
    const hidden = player.player.attributes.hidden;

    const perceptionScore =
      mental.vision * 0.35 +
      mental.concentration * 0.25 +
      mental.anticipation * 0.20 +
      hidden.pressure * 0.10 +
      hidden.consistency * 0.10;

    const normalized = perceptionScore / 20;

    const maxNoise = 3.0;
    const minNoise = 0.2;

    return (
      maxNoise -
      (maxNoise - minNoise) *
      normalized
    );
  }
}