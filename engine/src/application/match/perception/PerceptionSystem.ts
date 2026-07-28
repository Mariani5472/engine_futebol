import { LineOfSight } from "../../../core/geometry/LineOfSight";
import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PitchGrid } from "../../../core/pitch/PitchGrid";
import { CircleObstacle, PLAYER_COLLISION_RADIUS } from "../../../domain";
import { BallPerception } from "./BallPerception";
import { PerceivedEntity } from "./PerceivedEntity";
import { DEFAULT_PERCEPTION_CONFIG, PerceptionConfig } from "./PerceptionConfig";
import { PlayerPerception } from "./PlayerPerception";
import { Visibility } from "./Visibility";



export class PerceptionSystem {

  constructor(
    private readonly pitchGrid: PitchGrid,

    private readonly config: PerceptionConfig = DEFAULT_PERCEPTION_CONFIG
  ) {}

  public update(
    state: MatchState
  ): Map<string, PlayerPerception> {

    const perceptions =
      new Map<string, PlayerPerception>();

    const players = [

      ...state.home.players,

      ...state.away.players

    ];

    for (const player of players) {

      const perception = this.buildPlayerPerception(
        player,
        state
      );

      perceptions.set(
        player.player.id,
        perception
      );

    }

    return perceptions;

  }

  private buildPlayerPerception(
    player: PlayerMatchState,
    state: MatchState
  ): PlayerPerception {

    const currentZone =
      this.pitchGrid.getZoneAt(
        player.position
      );

    return {

      playerId:
        player.player.id,

      currentZone:
        currentZone.id,

      ball:
        this.perceiveBall(
          player,
          state
        ),

      teammates:
        this.perceiveTeammates(
          player,
          state
        ),

      opponents:
        this.perceiveOpponents(
          player,
          state
        )

    };

  }

  private perceiveBall(
    player: PlayerMatchState,
    state: MatchState
  ): BallPerception {

    const ball =
      state.ball;

    const distance =
      player.position.distanceTo(
        ball.position
      );

    const angle =
      this.calculateAngle(
        player,
        ball.position
      );

    const visibility =
      this.calculateVisibility(
        player,
        ball.position,
        distance,
        state,
        null
      );

    const zone =
      this.pitchGrid.getZoneAt(
        ball.position
      );

    return {

      position:
        ball.position,

      distance,

      angle,

      zone:
        zone.id,

      visibility,

      height:
        ball.height

    };

  }

  private perceiveTeammates(
    player: PlayerMatchState,
    state: MatchState
  ): PerceivedEntity[] {

    const team =
      this.getPlayerTeam(
        player,
        state
      );

    return team.players

      .filter(
        teammate =>
          teammate !== player
      )

      .map(
        teammate =>
          this.createEntityPerception(
            player,
            teammate,
            state
          )
      )

      .filter(
        perception =>
          perception !== null
      ) as PerceivedEntity[];

  }

  private perceiveOpponents(
    player: PlayerMatchState,
    state: MatchState
  ): PerceivedEntity[] {

    const opponentTeam =
      this.getOpponentTeam(
        player,
        state
      );

    return opponentTeam.players

      .map(
        opponent =>
          this.perceivePlayer(
            player,
            opponent,
            state
          )
      )

      .filter(
        entity =>
          entity.visibility !==
          Visibility.NOT_VISIBLE
      );

  }

  private perceivePlayer(
    observer: PlayerMatchState,
    target: PlayerMatchState,
    state: MatchState
  ): PerceivedEntity {

    const distance =
      observer.position.distanceTo(
        target.position
      );

    const angle =
      this.calculateAngle(
        observer,
        target.position
      );

    const visibility =
      this.calculateVisibility(
        observer,
        target.position,
        distance,
        state,
        target
      );

    const zone =
      this.pitchGrid.getZoneAt(
        target.position
      );

    return {

      entityId:
        target.player.id,

      position:
        target.position,

      distance,

      angle,

      zone:
        zone.id,

      visibility

    };

  }

  private createEntityPerception(
    observer: PlayerMatchState,
    target: PlayerMatchState,
    state: MatchState
  ): PerceivedEntity | null {

    const distance = observer.position.distanceTo(
      target.position
    );

    if (distance > this.config.maxPerceptionDistance) {
      return null;
    }

    const angle = this.calculateAngleToTarget(
      observer,
      target.position
    );

    const visibility = this.calculateVisibility(
      observer,
      target.position,
      distance,
      state,
      target
    );

    const zone = this.pitchGrid.getZoneAt(
      target.position
    );

    return {
      entityId: target.player.id,
      distance,
      angle,
      position: target.position,
      visibility,
      zone: zone.id
    };

  }

  private calculateAngle(
    player: PlayerMatchState,
    targetPosition: Vector2
  ): number {

    const direction =
      targetPosition
        .subtract(
          player.position
        )
        .normalize();

    const facing =
      player.facingDirection
        .normalize();

    return facing.angleTo(
      direction
    );

  }

  private canPerceiveTarget(
    observer: PlayerMatchState,
    targetPosition: Vector2,
    distance: number,
    state: MatchState,
    target: PlayerMatchState | null = null
  ): boolean {

    if (
      distance >
      this.config.maxPerceptionDistance
    ) {
      return false;
    }

    const angle =
      this.calculateAngleToTarget(
        observer,
        targetPosition
      );

    if (
      angle >
      this.config.maxVisionAngle
    ) {
      return false;
    }

    const obstacles =
      this.getVisionObstacles(
        observer,
        target,
        state
      );

    return LineOfSight.hasVision(
      observer.position,
      targetPosition,
      obstacles
    );

  }

  private getVisionObstacles(
    observer: PlayerMatchState,
    target: PlayerMatchState | null,
    state: MatchState
  ): CircleObstacle[] {

    const players = [
      ...state.home.players,
      ...state.away.players
    ];

    return players

      .filter(
        player =>
          player !== observer &&
          player !== target
      )

      .map(
        player => ({

          position:
            player.position,

          radius:
            this.config.playerCollisionRadius

        })

      );

  }

  private getPlayerTeam(
    player: PlayerMatchState,
    state: MatchState
  ) {

    if (
      state.home.players.includes(
        player
      )
    ) {

      return state.home;

    }

    return state.away;

  }

  private getOpponentTeam(
    player: PlayerMatchState,
    state: MatchState
  ) {

    if (
      state.home.players.includes(
        player
      )
    ) {

      return state.away;

    }

    return state.home;

  }

  private calculateVisibility(
    observer: PlayerMatchState,
    targetPosition: Vector2,
    distance: number,
    state: MatchState,
    target: PlayerMatchState | null
  ): Visibility {

    if (
      distance >
      this.config.maxPerceptionDistance
    ) {

      return Visibility.NOT_VISIBLE;

    }

    const angle =
      this.calculateAngle(
        observer,
        targetPosition
      );

    if (
      angle >
      this.config.maxVisionAngle
    ) {

      return Visibility.NOT_VISIBLE;

    }

    const obstacles =
      this.getVisionObstacles(
        observer,
        target,
        state
      );

    const hasLineOfSight =
      LineOfSight.hasVision(
        observer.position,
        targetPosition,
        obstacles
      );

    if (
      !hasLineOfSight
    ) {

      return Visibility.NOT_VISIBLE;

    }

    return Visibility.VISIBLE;

  }

  private calculateAngleToTarget(
    player: PlayerMatchState,
    target: Vector2
  ): number {

    const direction =
      target
        .subtract(
          player.position
        )
        .normalize();

    const facing =
      player.facingDirection
        .normalize();

    return facing.angleTo(
      direction
    );

  }
}