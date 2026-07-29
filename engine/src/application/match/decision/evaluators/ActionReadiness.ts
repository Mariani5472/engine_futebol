import { DecisionType } from "../DecisionType";
import { DecisionContext } from "../DecisionContext";
import { Vector2 } from "../../../../core/geometry/Vector2";
import { getActionExecutionProfile } from "../../action/ActionExecutionProfile";
import { ActionExecutionPhase } from "../../action/ActionExecution";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

export class ActionReadiness {
  public static isLocked(context: DecisionContext): boolean {
    return this.currentTime(context) < (context.player.actionLockUntil ?? 0);
  }

  public static isRecovering(context: DecisionContext): boolean {
    return this.currentTime(context) < (context.player.recoveryUntil ?? 0);
  }

  public static currentTime(context: DecisionContext): number {
    return context.currentTick * context.deltaTime;
  }

  public static canStartAction(
    context: DecisionContext,
    minimumStability = 0
  ): boolean {
    if (this.currentTime(context) < context.player.possessionControlUntil) return false;
    const stability = context.player.stability ?? 100;
    if (stability < minimumStability) return false;

    if (!this.isLocked(context) && !this.isRecovering(context)) {
      return true;
    }

    const previousAction = context.player.lastActionType;
    const previousProfile = previousAction
      ? getActionExecutionProfile(previousAction)
      : undefined;

    return previousProfile?.canInterrupt === true;
  }

  public static bodyQuality(context: DecisionContext): number {
    const bodyState = context.player.bodyState ?? "STANDING";
    const stateQuality = {
      STANDING: 1.0,
      BALANCED: 1.0,
      LEANING: 0.78,
      FALLING: 0.25,
      GROUND: 0.0,
    }[bodyState] ?? 1.0;

    const balance = this.normalize(context.player.balance ?? 100);
    const stability = this.normalize(context.player.stability ?? 100);

    return Math.max(
      0,
      Math.min(1, stateQuality * 0.45 + balance * 0.30 + stability * 0.25)
    );
  }

  /** Body quality for an arbitrary player (not necessarily the decision subject). */
  public static bodyQualityOf(player: PlayerMatchState): number {
    const bodyState = player.bodyState ?? "STANDING";
    const stateQuality = {
      STANDING: 1.0,
      BALANCED: 1.0,
      LEANING: 0.78,
      FALLING: 0.25,
      GROUND: 0.0,
    }[bodyState] ?? 1.0;

    const balance = this.normalize(player.balance ?? 100);
    const stability = this.normalize(player.stability ?? 100);

    return Math.max(
      0,
      Math.min(1, stateQuality * 0.45 + balance * 0.30 + stability * 0.25)
    );
  }

  public static orientationQuality(
    playerFacingDirection: Vector2,
    desiredDirection: Vector2
  ): number {
    if (!desiredDirection || desiredDirection.magnitude() === 0) return 1;
    if (!playerFacingDirection || playerFacingDirection.magnitude() === 0) return 0.5;

    const dot = playerFacingDirection.normalize().dot(desiredDirection.normalize());
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  public static opponentPressure(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    let pressure = 0;

    for (const opponent of opponents) {
      const distance = player.position.distanceTo(opponent.position);
      if (distance > 8) continue;

      const proximity = Math.max(0, 1 - distance / 8);
      pressure = Math.max(pressure, proximity);

      if (opponent.activeAction?.type === DecisionType.TACKLE) {
        pressure = Math.max(pressure, Math.max(0.75, proximity));
      }
    }

    return Math.max(0, Math.min(1, pressure));
  }

  public static preparationExposure(
    player: PlayerMatchState,
    currentTime: number
  ): number {
    const action = player.activeAction;
    if (!action || action.phase !== ActionExecutionPhase.PREPARING) return 0;

    const duration = action.executeAt - action.startedAt;
    if (duration <= 0) return 1;

    const elapsed = Math.max(
      0,
      Math.min(duration, currentTime - action.startedAt)
    );
    const progress = elapsed / duration;

    return Math.max(0.15, 1 - progress * 0.85);
  }

  public static interruptionOpportunity(
    target: PlayerMatchState,
    defender: PlayerMatchState,
    currentTime: number
  ): number {
    const exposure = this.preparationExposure(target, currentTime);
    if (exposure <= 0) return 0;

    const distance = defender.position.distanceTo(target.position);
    const proximity = Math.max(0, 1 - distance / 5);

    return Math.max(0, Math.min(1, exposure * proximity));
  }

  private static normalize(value: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}
