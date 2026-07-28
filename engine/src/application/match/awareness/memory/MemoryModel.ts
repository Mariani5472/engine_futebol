import { Vector2 } from "../../../../core/geometry/Vector2";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { MemoryDecay } from "./MemoryDecay";

const FRESH_SIGHTING_CERTAINTY = 1;
const FRESH_SIGHTING_SPATIAL_ERROR = 0;
const BASE_SPATIAL_ERROR_GROWTH_RATE = 0.45;
const MAX_VISION = 20;

/**
 * A believedstate record about the ball or a player, as tracked
 * by PlayerMemory / BallMemory. MemoryModel operates on this shape
 * structurally so the same refresh/decay logic serves both.
 */
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
    private readonly decay: MemoryDecay = new MemoryDecay()
  ) {}

  /**
   * The player actually perceived this entity/ball on this tick:
   * replace the believed state with what was observed and restore
   * full confidence in it.
   */
  public refreshPlayer(
    memory: MemoryRecord,
    observedPosition: Vector2,
    tick: number,
    deltaTime: number
  ): void {
    this.refresh(memory, observedPosition, tick, deltaTime);
  }

  public refreshBall(
    memory: MemoryRecord,
    observedPosition: Vector2,
    tick: number,
    deltaTime: number
  ): void {

    this.refresh(memory, observedPosition, tick, deltaTime);
  }

  /**
   * The player did NOT perceive this entity/ball on this tick:
   * the belief ages, becoming less certain and less precise.
   */
  public decayPlayer(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {

    this.applyDecay(player, memory, deltaTime, tick);
  }

  public decayBall(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {

    this.applyDecay(player, memory, deltaTime, tick);
  }

  private refresh(
    memory: MemoryRecord,
    observedPosition: Vector2,
    tick: number,
    deltaTime: number
  ): void {

    memory.estimatedVelocity =
      this.estimateVelocity(
        memory.estimatedPosition,
        observedPosition,
        memory.lastSeenTick,
        tick,
        deltaTime
      );

    memory.estimatedPosition = observedPosition;
    memory.certainty = FRESH_SIGHTING_CERTAINTY;
    memory.spatialError = FRESH_SIGHTING_SPATIAL_ERROR;
    memory.lastSeenTick = tick;
    memory.lastUpdatedTick = tick;
  }

  private applyDecay(
    player: PlayerMatchState,
    memory: MemoryRecord,
    deltaTime: number,
    tick: number
  ): void {
    memory.certainty = this.decay.calculateCertainty(
      memory.certainty,
      player.player.attributes.mental.concentration,
      deltaTime
    );

    memory.lastUpdatedTick = tick;
  }

  /**
   * Estimates velocity from two confirmed sightings of the same
   * entity. Only meaningful between two *observations*; a decayed
   * belief never updates velocity on its own.
   */
  private estimateVelocity(
    previousPosition: Vector2,
    observedPosition: Vector2,
    previousSeenTick: number,
    currentTick: number,
    deltaTime: number
  ): Vector2 {
    const elapsedTicks = currentTick - previousSeenTick;

    if (elapsedTicks <= 0) {
      return Vector2.zero();
    }

    const elapsedSeconds = elapsedTicks * deltaTime;

    if (elapsedSeconds <= 0) {
      return Vector2.zero();
    }

    return observedPosition
      .subtract(previousPosition)
      .divide(elapsedSeconds);

  }

  private calculateSpatialError(
    player: PlayerMatchState,
    error: number,
    deltaTime: number
  ): number {
    const vision = player.player.attributes
      .mental
      .vision;

    const modifier = 1 - (vision / MAX_VISION);

    return (
      error + (BASE_SPATIAL_ERROR_GROWTH_RATE + modifier) * deltaTime
    );
  }
}
