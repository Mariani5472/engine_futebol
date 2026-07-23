import {
  Vector2,
} from "../../../../core/geometry/Vector2";
import { PlayerMatchState } from "../../../../domain";



import {
  MemoryDecay,
} from "./MemoryDecay";

const MAX_VISION = 20;

const BASE_SPATIAL_ERROR_GROWTH_RATE = 0.45;

interface MemoryRecord {

  estimatedPosition: Vector2;

  estimatedVelocity: Vector2;

  certainty: number;

  lastSeenTick: number;

  lastUpdatedTick: number;

  spatialError: number;
}

export class MemoryModel {

  constructor(
    private readonly decay =
      new MemoryDecay()
  ) {}

  public refreshPlayer(
    memory: MemoryRecord,
    observedPosition: Vector2,
    tick: number
  ): void {

    const previousPosition = memory.estimatedPosition;
    const velocity = observedPosition.subtract(
      previousPosition
    );

    memory.estimatedPosition = observedPosition;

    memory.estimatedVelocity = velocity;

    memory.certainty = 1;

    memory.spatialError = 0;

    memory.lastSeenTick = tick;

    memory.lastUpdatedTick = tick;
  }

  public refreshBall(
    memory: MemoryRecord,
    observedPosition: Vector2,
    tick: number
  ): void {

    this.refreshPlayer(
      memory,
      observedPosition,
      tick
    );
  }

  public decayPlayer(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {

    this.decayMemory(
      player,
      memory,
      deltaTime,
      tick
    );
  }

  public decayBall(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {

    this.decayMemory(
      player,
      memory,
      deltaTime,
      tick
    );
  }

  private decayMemory(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {

    const concentration =
      player.attributes.mental.concentration;

    const vision =
      player.player.attributes.mental.vision;

    memory.certainty =
      this.decay.calculateCertainty(
        memory.certainty,
        concentration,
        deltaTime
      );

    memory.spatialError +=
      BASE_SPATIAL_ERROR_GROWTH_RATE *
      (1 - vision / MAX_VISION) *
      deltaTime;

    memory.estimatedPosition =
      memory.estimatedPosition.add(
        memory.estimatedVelocity.multiply(
          deltaTime
        )
      );

    memory.lastUpdatedTick =
      tick;
  }
}