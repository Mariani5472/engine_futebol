import { DecisionContext } from "../DecisionContext";
import { Vector2 } from "../../../../core/geometry/Vector2";

export class ActionReadiness {
  public static isLocked(context: DecisionContext): boolean {
    return context.currentTick < context.player.actionLockUntil;
  }

  public static isRecovering(context: DecisionContext): boolean {
    return context.currentTick < context.player.recoveryUntil;
  }

  public static canStartAction(
    context: DecisionContext,
    minimumStability = 0
  ): boolean {
    if (this.isLocked(context)) return false;
    if (this.isRecovering(context)) return false;
    if (context.player.stability < minimumStability) return false;

    return true;
  }

  /**
   * General quality of the player's current body state for technical actions.
   * This is intentionally not an attribute: it is the transient physical state
   * created by movement and previous actions.
   */
  public static bodyQuality(context: DecisionContext): number {
    const { player } = context;

    const stateQuality = {
      STANDING: 1.0,
      BALANCED: 1.0,
      LEANING: 0.78,
      FALLING: 0.25,
      GROUND: 0.0,
    }[player.bodyState];

    const balance = this.normalize(player.balance);
    const stability = this.normalize(player.stability);

    return Math.max(
      0,
      Math.min(1, stateQuality * 0.45 + balance * 0.30 + stability * 0.25)
    );
  }

  /**
   * How well the player is facing a desired direction.
   * 1 = perfectly aligned, 0 = facing the opposite direction.
   */
  public static orientationQuality(
    playerFacingDirection: Vector2,
    desiredDirection: Vector2
  ): number {
    if (desiredDirection.magnitude() === 0) return 1;
    if (playerFacingDirection.magnitude() === 0) return 0.5;

    const dot = playerFacingDirection.normalize().dot(desiredDirection.normalize());
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  private static normalize(value: number): number {
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}
