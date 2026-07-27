import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { TacticalShapeAssignment } from "../../../domain";

const ATTACKING_HALF_THRESHOLD = 0.5;

/** Extra metres attackers push ahead of the ball when their team has possession. */
const BALL_LINE_PUSH = 12;
/** Cap how far a support run may go beyond the base attacking anchor. */
const MAX_ANCHOR_PUSH = 22;

export class TacticalEngine {

  public update(state: MatchState): void {
    this.updateTeam(state, state.home);
    this.updateTeam(state, state.away);
  }

  private updateTeam(
    state: MatchState,
    team: TeamMatchState
  ): void {

    const assignments = this.getActiveAssignments(state, team);
    const familiarity = team.tactic.familiarity / 100;

    for (let i = 0; i < team.players.length; i++) {
      const player = team.players[i];

      if (player.hasBall) continue;

      const assignment = assignments[i] ?? assignments[assignments.length - 1];
      if (!assignment) continue;

      const anchor = this.resolveAnchor(state, team, assignment, player);
      const compactFactor = this.compactnessFactor(state, team, player);
      const target = this.applyFamiliarity(anchor, player.position, familiarity, compactFactor);

      player.setTarget(target);
    }
  }

  private getActiveAssignments(
    state: MatchState,
    team: TeamMatchState
  ): readonly TacticalShapeAssignment[] {

    const isAttacking = state.attackingTeam === team;
    const shape = isAttacking
      ? team.tactic.attackingShape
      : team.tactic.defensiveShape;

    return shape.assignments;
  }

  private resolveAnchor(
    state: MatchState,
    team: TeamMatchState,
    assignment: TacticalShapeAssignment,
    player: PlayerMatchState,
  ): Vector2 {

    const isAttacking = state.attackingTeam === team;
    let base = isAttacking ? assignment.attackingAnchor : assignment.defensiveAnchor;

    if (isAttacking) {
      base = this.pushAttackingAnchor(state, team, assignment, base, player);
    }

    if (team.attackingDirection === 1) {
      return new Vector2(
        Math.max(0, Math.min(state.pitch.length, base.x)),
        Math.max(0, Math.min(state.pitch.width, base.y)),
      );
    }

    return new Vector2(
      Math.max(0, Math.min(state.pitch.length, state.pitch.length - base.x)),
      Math.max(0, Math.min(state.pitch.width, base.y)),
    );
  }

  /**
   * When the team has the ball, shift attacking anchors toward and beyond the
   * ball line so teammates offer progressive passing options ahead of possession.
   */
  private pushAttackingAnchor(
    state: MatchState,
    team: TeamMatchState,
    assignment: TacticalShapeAssignment,
    base: Vector2,
    _player: PlayerMatchState,
  ): Vector2 {
    const dir = team.attackingDirection;
    const ballX = state.ball.position.x;

    // Always edge the block forward a bit while attacking.
    let push = 6;

    const role = String(assignment.role);
    const isForward =
      role.includes("STRIKER") ||
      role.includes("FORWARD") ||
      role.includes("WINGER") ||
      role.includes("ATTACKING_MID");
    const isMid =
      role.includes("MIDFIELD") ||
      role.includes("BOX_TO_BOX") ||
      role.includes("WIDE_MID");

    if (isForward) push = BALL_LINE_PUSH + 6;
    else if (isMid) push = BALL_LINE_PUSH;

    // Support run: if the ball is deeper than this player's natural anchor,
    // step up to (or just beyond) the ball line.
    const naturalX = team.attackingDirection === 1 ? base.x : state.pitch.length - base.x;
    const ballAheadOfNatural =
      dir === 1 ? ballX > naturalX - 5 : ballX < naturalX + 5;

    let x = base.x + dir * Math.min(push, MAX_ANCHOR_PUSH);

    if (ballAheadOfNatural && (isForward || isMid)) {
      // Offer for progressive pass: target slightly ahead of the ball.
      const supportX =
        dir === 1
          ? Math.min(state.pitch.length - 8, ballX + 10)
          : Math.max(8, ballX - 10);

      // Blend natural pushed anchor with ball-relative support.
      const pitchX =
        dir === 1 ? x : state.pitch.length - x;
      const blended =
        dir === 1
          ? pitchX * 0.35 + supportX * 0.65
          : pitchX * 0.35 + supportX * 0.65;

      x = dir === 1 ? blended : state.pitch.length - blended;
    }

    return new Vector2(x, base.y);
  }

  private compactnessFactor(
    state: MatchState,
    team: TeamMatchState,
    _player: PlayerMatchState
  ): number {

    const isAttacking = state.attackingTeam === team;
    if (isAttacking) return 0.05;

    const instructions = team.tactic.teamInstructions.instructions;
    const hasLowBlock = instructions.includes("LOW_BLOCK");
    const hasHighPress = instructions.includes("HIGH_PRESS");

    if (hasLowBlock) return 0.5;
    if (hasHighPress) return 0.15;
    return 0.25;
  }

  private applyFamiliarity(
    anchor: Vector2,
    current: Vector2,
    familiarity: number,
    compactFactor: number
  ): Vector2 {

    const weight = Math.max(0.55, familiarity * (1 - compactFactor * 0.3));

    return new Vector2(
      anchor.x * weight + current.x * (1 - weight),
      anchor.y * weight + current.y * (1 - weight)
    );
  }

  public isBallInAttackingHalf(
    state: MatchState,
    team: TeamMatchState
  ): boolean {

    const normalizedX = state.ball.position.x / state.pitch.length;
    const attackingX = team.attackingDirection === 1
      ? normalizedX
      : 1 - normalizedX;

    return attackingX >= ATTACKING_HALF_THRESHOLD;
  }
}
