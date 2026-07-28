import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";

/** Recovers physical stability only while the player has no active action. */
export function recoverIdleActionState(
  player: PlayerMatchState,
  deltaTime: number,
): void {
  if (player.isActionBusy()) return;

  const scale = player.balance <= 1 ? 1 : 100;
  const recoveryAmount = deltaTime * 0.08 * scale;

  player.balance = Math.min(scale, player.balance + recoveryAmount);
  player.stability = Math.min(
    scale,
    player.stability + recoveryAmount * 0.75,
  );

  if (player.bodyState === "GROUND" || player.bodyState === "FALLING") {
    player.bodyState = "STANDING";
  } else if (player.bodyState === "LEANING") {
    player.bodyState = "BALANCED";
  }
}
