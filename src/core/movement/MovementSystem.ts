import { Vector2 } from "../geometry/Vector2";
import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { ActionExecutionPhase } from "../../application/match/action/ActionExecution";

export class MovementSystem {
  public update(
    state: MatchState,
    deltaTime: number
  ): void {
    this.movePlayers(state, deltaTime);

    // this.moveBall(state, deltaTime);
  }

  private movePlayers(
    state: MatchState,
    deltaTime: number
  ): void {
    const teams = [
      state.home,
      state.away
    ];

    for (const team of teams) {
      for (const player of team.players) {
        const movementMultiplier = this.getMovementMultiplier(player);

        if (movementMultiplier === 0) {
          player.velocity = new Vector2(0, 0);
          continue;
        }

        const direction = player.targetPosition
          .subtract(player.position);

        const distance = direction.magnitude();

        if (distance < 0.05) {
          player.position = player.targetPosition;
          player.velocity = new Vector2(0, 0);
          continue;
        }

        const normalized = direction.normalize();

        this.updateFacingDirection(
          player,
          normalized,
          deltaTime,
          movementMultiplier
        );

        const speed =
          this.calculateSpeed(player) * movementMultiplier;

        const movement = normalized.multiply(
          speed * deltaTime
        );

        if (movement.magnitude() >= distance) {
          player.position = player.targetPosition;
          player.velocity = new Vector2(0, 0);
          continue;
        }

        player.position = player.position.add(movement);
        player.velocity = movement.divide(deltaTime);
      }
    }
  }

  private getMovementMultiplier(
    player: PlayerMatchState
  ): number {
    switch (player.bodyState) {
      case "FALLING":
      case "GROUND":
        return 0;

      case "LEANING":
        return 0.70;

      case "BALANCED":
        return 0.90;

      case "STANDING":
      default:
        break;
    }

    if (
      player.activeAction?.phase === ActionExecutionPhase.RECOVERING
    ) {
      return 0.65;
    }

    return 1;
  }

  private moveBall(
    state: MatchState,
    deltaTime: number
  ): void {
    const ball = state.ball;

    if (ball.owner) {
      ball.position = ball.owner.position;
      ball.velocity = ball.owner.velocity;
      return;
    }

    const movement = ball.velocity.multiply(deltaTime);
    ball.position = ball.position.add(movement);
    ball.velocity = ball.velocity.multiply(0.985);

    if (ball.velocity.magnitude() < 0.05) {
      ball.velocity = new Vector2(0, 0);
    }
  }

  private calculateSpeed(
    player: PlayerMatchState
  ): number {
    const pace =
      player.player.attributes.physical.pace;

    const stamina =
      player.player.attributes.physical.stamina;

    const fatigueModifier =
      1 - (player.fatigue / 100);

    return (
      pace * 0.35 +
      stamina * 0.15
    ) * fatigueModifier;
  }

  private updateFacingDirection(
    player: PlayerMatchState,
    movementDirection: Vector2,
    deltaTime: number,
    movementMultiplier: number
  ): void {
    if (movementDirection.magnitude() === 0) {
      return;
    }

    const currentAngle = player.facingDirection.angle();
    const targetAngle = movementDirection.angle();

    let difference = targetAngle - currentAngle;

    while (difference > Math.PI) {
      difference -= Math.PI * 2;
    }

    while (difference < -Math.PI) {
      difference += Math.PI * 2;
    }

    const maxRotation =
      this.getTurnSpeed(player) *
      movementMultiplier *
      deltaTime;

    const rotation = Math.max(
      -maxRotation,
      Math.min(maxRotation, difference)
    );

    player.facingDirection =
      player.facingDirection
        .rotate(rotation)
        .normalize();
  }

  private getTurnSpeed(
    player: PlayerMatchState
  ): number {
    const physical =
      player.player.attributes.physical;

    const fatigueModifier =
      1 - player.fatigue / 100;

    const agility = physical.agility / 20;
    const balance = physical.balance / 20;

    return (
      2.5 +
      agility * 2 +
      balance * 1.5
    ) * fatigueModifier;
  }
}
