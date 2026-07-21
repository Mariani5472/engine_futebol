import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { BallMemory } from "./BallMemory";
import { PlayerMemory } from "./PlayerMemory";

export class MemoryModel {

  public updateBall(
    player: PlayerMatchState,
    memory: BallMemory,
    deltaTime: number
  ): void {

    memory.certainty =
      this.calculateCertainty(
        player,
        memory.certainty,
        deltaTime
      );

    memory.spatialError =
      this.calculateSpatialError(
        player,
        memory.spatialError,
        deltaTime
      );

  }

  public updatePlayer(
    player: PlayerMatchState,
    memory: PlayerMemory,
    deltaTime: number
  ): void {

    memory.certainty =
      this.calculateCertainty(
        player,
        memory.certainty,
        deltaTime
      );

    memory.spatialError =
      this.calculateSpatialError(
        player,
        memory.spatialError,
        deltaTime
      );
  }

  private calculateCertainty(
    player: PlayerMatchState,
    certainty: number,
    deltaTime: number
  ): number {

    const concentration =
      player.player.attributes
        .mental
        .concentration;

    const modifier =
      concentration / 20;

    const decay =
      0.30 * (1 - modifier);

    return Math.max(
      0,
      certainty *
      Math.exp(
        -decay *
        deltaTime
      )
    );
  }

  private calculateSpatialError(

    player: PlayerMatchState,

    error: number,

    deltaTime: number

  ): number {

    const vision =

      player.player.attributes
        .mental
        .vision;

    const modifier =

      1 -

      (vision / 20);

    return (

      error +

      (

        0.45 +

        modifier

      )

      *

      deltaTime

    );

  }
}
