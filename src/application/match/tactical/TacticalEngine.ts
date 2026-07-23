import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { TacticalShapeAssignment } from "../../../domain";

/** Fraction of pitch length that is "attacking half". */
const ATTACKING_HALF_THRESHOLD = 0.5;

/**
 * Computes tactical target positions for all players based on:
 * - Current match phase (attacking / defending)
 * - Tactical shape assignments (defensive/attacking anchors)
 * - Tactic familiarity (reduces discipline / spread)
 * - Ball position
 */
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
    const familiarity = team.tactic.familiarity / 100; // 0–1

    for (let i = 0; i < team.players.length; i++) {
      const player = team.players[i];

      // Skip the ball carrier — they execute their own action.
      if (player.hasBall) continue;

      const assignment = assignments[i] ?? assignments[assignments.length - 1];
      if (!assignment) continue;

      const anchor = this.resolveAnchor(state, team, assignment);
      const compactFactor = this.compactnessFactor(state, team, player);
      const target = this.applyFamiliarity(anchor, player.position, familiarity, compactFactor);

      player.setTarget(target);
    }

  }

  /**
   * Returns the active tactical shape assignments.
   * Selects defensive shape when defending, attacking shape otherwise.
   */
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

  /**
   * Resolves the anchor position to actual pitch coordinates,
   * mirroring for the away team (attacking in the -x direction).
   */
  private resolveAnchor(
    state: MatchState,
    team: TeamMatchState,
    assignment: TacticalShapeAssignment
  ): Vector2 {

    const isAttacking = state.attackingTeam === team;
    const base = isAttacking ? assignment.attackingAnchor : assignment.defensiveAnchor;

    if (team.attackingDirection === 1) {
      return new Vector2(base.x, base.y);
    } else {
      // Mirror: home attacks right (x = pitch.length), away attacks left (x = 0).
      return new Vector2(state.pitch.length - base.x, base.y);
    }

  }

  /**
   * Compactness: pulls players toward ball zone when defending.
   * Returns a value [0, 1] representing how compact the team should be.
   */
  private compactnessFactor(
    state: MatchState,
    team: TeamMatchState,
    _player: PlayerMatchState
  ): number {

    const isAttacking = state.attackingTeam === team;
    if (isAttacking) return 0.1;

    // When defending, increase compactness based on tactic instructions.
    const instructions = team.tactic.teamInstructions.instructions;
    const hasLowBlock = instructions.includes("LOW_BLOCK");
    const hasHighPress = instructions.includes("HIGH_PRESS");

    if (hasLowBlock) return 0.5;
    if (hasHighPress) return 0.15;
    return 0.25;

  }

  /**
   * Blends the anchor with the player's current position based on
   * tactic familiarity. Low familiarity → players are less disciplined.
   */
  private applyFamiliarity(
    anchor: Vector2,
    current: Vector2,
    familiarity: number,
    compactFactor: number
  ): Vector2 {

    // Higher familiarity → player is closer to the anchor.
    // Lower familiarity → player drifts toward current position.
    const weight = familiarity * (1 - compactFactor * 0.3);

    return new Vector2(
      anchor.x * weight + current.x * (1 - weight),
      anchor.y * weight + current.y * (1 - weight)
    );

  }

  /**
   * Determines whether the ball is in the attacking half (relative to team).
   */
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
