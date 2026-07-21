import { BallMatchState } from "./BallMatchState";
import { PlayerMatchState } from "./PlayerMatchState";

export class ReachCalculator {


  public calculateReachTime(
    player: PlayerMatchState,
    ball: BallMatchState
  ): number {

    const distance =
      player.position.distanceTo(
        ball.position
      );

    const speed =
      this.calculatePlayerSpeed(player);

    if (speed <= 0.01) {
      return Number.MAX_VALUE;
    }

    const orientationModifier =
      this.calculateOrientationModifier(
        player,
        ball
      );

    return (
      distance /
      speed
    ) / orientationModifier;
  }


  private calculatePlayerSpeed(
    player: PlayerMatchState
  ): number {

    const physical =
      player.player.attributes.physical;

    const fatigue =
      1 - player.fatigue / 100;

    const pace =
      Number(physical.pace);

    const acceleration =
      Number(physical.acceleration);

    const stamina =
      Number(physical.stamina);

    const topSpeed =
      3.5 + (pace / 20) * 5;

    const accelerationFactor =
      0.7 + (acceleration / 20) * 0.3;

    const staminaFactor =
      0.8 + (stamina / 20) * 0.2;

    return (
      topSpeed *
      accelerationFactor *
      staminaFactor *
      fatigue
    );

  }

  private calculateOrientationModifier(
    player: PlayerMatchState,
    ball: BallMatchState
  ): number {

    const directionToBall =
      ball.position
        .subtract(player.position)
        .normalize();

    const facing =
      player.facingDirection
        .normalize();

    const dot =
      facing.dot(directionToBall);

    /*
      dot:
  
      1    = bola exatamente à frente
      0    = bola ao lado
      -1   = bola atrás
    */

    if (dot >= 0.7) {
      return 1;
    }

    if (dot >= 0) {
      return 0.85;
    }

    if (dot >= -0.5) {
      return 0.65;
    }

    return 0.45;

  }

}