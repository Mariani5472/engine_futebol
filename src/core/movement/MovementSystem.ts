import { PossessionCandidate } from "../../domain";
import { Vector2 } from "../geometry/Vector2";
import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";

export class MovementSystem {
  public update(
    state: MatchState,
    deltaTime: number
  ): void {

    this.movePlayers(state, deltaTime);

    this.moveBall(state, deltaTime);

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
          deltaTime
        );

        const speed =
          this.calculateSpeed(player);

        const movement = normalized.multiply(
          speed * deltaTime
        );

        if (movement.magnitude() >= distance) {

          player.position =
            player.targetPosition;

          player.velocity =
            new Vector2(0, 0);

          continue;

        }

        player.position =
          player.position.add(movement);

        player.velocity = movement.divide(deltaTime);

      }

    }

  }

  private moveBall(
    state: MatchState,
    deltaTime: number
  ): void {

    const ball = state.ball;

    if (ball.owner) {

      ball.position =
        ball.owner.position;

      ball.velocity =
        ball.owner.velocity;

      return;

    }

    const movement =
      ball.velocity.multiply(deltaTime);

    ball.position =
      ball.position.add(movement);

    // desaceleração simples

    ball.velocity =
      ball.velocity.multiply(0.985);

    if (ball.velocity.magnitude() < 0.05) {

      ball.velocity =
        new Vector2(0, 0);

    }

  }

  private calculateSpeed(
    player: PlayerMatchState
  ): number {

    const pace =
      player.player.attributes
        .physical
        .pace;

    const stamina =
      player.player.attributes
        .physical
        .stamina;

    const fatigueModifier =
      1 -
      (player.fatigue / 100);

    return (
      pace * 0.35 +
      stamina * 0.15
    ) * fatigueModifier;

  }

  private updateFacingDirection(
    player: PlayerMatchState,
    movementDirection: Vector2,
    deltaTime: number
  ): void {

    if (
      movementDirection.magnitude() === 0
    ) {
      return;
    }

    const currentAngle =
      player.facingDirection.angle();

    const targetAngle =
      movementDirection.angle();

    let difference =
      targetAngle - currentAngle;

    while (difference > Math.PI) {
      difference -= Math.PI * 2;
    }

    while (difference < -Math.PI) {
      difference += Math.PI * 2;
    }

    const maxRotation =
      this.getTurnSpeed(player) *
      deltaTime;

    const rotation =
      Math.max(
        -maxRotation,
        Math.min(
          maxRotation,
          difference
        )
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
      1 -
      player.fatigue / 100;

    const agility =
      physical.agility / 20;

    const balance =
      physical.balance / 20;

    return (

      2.5 +

      agility * 2 +

      balance * 1.5

    ) * fatigueModifier;

  }
}