import { Vector2 } from "../../../../core/geometry/Vector2";
import type { MatchState } from "../../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";

export class TacticalInstructionTargetModifier {
  public apply(state: MatchState, team: TeamMatchState, player: PlayerMatchState, target: Vector2): Vector2 {
    const centre = state.pitch.width / 2;
    const role = String(player.currentRole);
    let x = target.x;
    let y = target.y;
    const phase = team.collectivePhase;
    const inPossession = phase === "BUILD_UP" || phase === "PROGRESSION" || phase === "FINAL_THIRD" || phase === "SET_PIECE";
    const inTransition = phase === "ATTACKING_TRANSITION" || phase === "COUNTER_ATTACK" || phase === "DEFENSIVE_TRANSITION";

    if (inPossession) {
      const instructions = team.tactic.inPossession;
      const widthFactor = instructions.width === "WIDE" ? 1.18 : instructions.width === "NARROW" ? .78 : 1;
      y = centre + (y - centre) * widthFactor;
      if (instructions.focus.length === 1) {
        if (instructions.focus[0] === "LEFT") y -= 5;
        if (instructions.focus[0] === "RIGHT") y += 5;
        if (instructions.focus[0] === "CENTRE") y = centre + (y - centre) * .72;
      }
      const isWideDefender = role.includes("FULL_BACK") || role.includes("WING_BACK");
      if (isWideDefender && ((y < centre && instructions.overlapLeft) || (y >= centre && instructions.overlapRight))) x += 8;
    }

    if (!inPossession && !inTransition) {
      const instructions = team.tactic.outOfPossession;
      const lineShift = instructions.defensiveLine === "HIGH" ? 8 : instructions.defensiveLine === "LOW" ? -7 : 0;
      const blockShift = instructions.block === "HIGH" ? 6 : instructions.block === "LOW" ? -6 : 0;
      if (role.includes("BACK") || role.includes("DEFENDER")) x += lineShift;
      else x += blockShift;
      const isPressingPlayer = role.includes("STRIKER") || role.includes("FORWARD") || role.includes("WINGER") || role.includes("ATTACKING_MID");
      if (isPressingPlayer) x += instructions.pressLine === "HIGH" ? 7 : instructions.pressLine === "LOW" ? -7 : 0;
      if (instructions.block === "LOW") y = centre + (y - centre) * .82;
    }

    if (inTransition) {
      const instructions = team.tactic.transition;
      if ((phase === "ATTACKING_TRANSITION" || phase === "COUNTER_ATTACK") && instructions.counterAttack) x += 8;
      if (phase === "DEFENSIVE_TRANSITION" && instructions.regroup) x -= 9;
      if (instructions.holdShape) {
        x = target.x * .75 + x * .25;
        y = target.y * .75 + y * .25;
      }
    }

    return new Vector2(Math.max(1, Math.min(state.pitch.length - 1, x)), Math.max(2, Math.min(state.pitch.width - 2, y)));
  }
}
