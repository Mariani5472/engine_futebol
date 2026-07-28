import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { TacticalShapeAssignment } from "../../../domain";
import { RoleBehaviourRegistry } from "./roles/RoleBehaviourRegistry";
import { TacticalInstructionTargetModifier } from "./instructions/TacticalInstructionTargetModifier";

const ATTACKING_HALF_THRESHOLD = 0.5;

/** Extra metres attackers push ahead of the ball when their team has possession. */
const BALL_LINE_PUSH = 12;
/** Cap how far a support run may go beyond the base attacking anchor. */
const MAX_ANCHOR_PUSH = 22;

export class TacticalEngine {
  public constructor(
    private readonly roleBehaviours = new RoleBehaviourRegistry(),
    private readonly instructionTargets = new TacticalInstructionTargetModifier(),
  ) {}

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
      player.tacticalAnchorPosition = anchor;
      const compactFactor = this.compactnessFactor(state, team, player);
      const target = this.applyFamiliarity(anchor, player.position, familiarity, compactFactor);

      player.setTarget(target);
    }
  }

  private getActiveAssignments(
    state: MatchState,
    team: TeamMatchState
  ): readonly TacticalShapeAssignment[] {

    const isAttacking = this.isPossessionPhase(team.collectivePhase);
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

    const isAttacking = this.isPossessionPhase(team.collectivePhase);
    const assignmentAnchor = isAttacking ? assignment.attackingAnchor : assignment.defensiveAnchor;
    let base = new Vector2(assignmentAnchor.x, assignmentAnchor.y);

    if (isAttacking) {
      base = this.pushAttackingAnchor(state, team, assignment, base, player);
    }

    base = this.applyCollectivePhase(state, team, assignment, base);
    const behaviour = this.roleBehaviours.forRole(player.currentRole);
    const roleContext = { match: state, team, player, assignment, baseTarget: base };
    if (team.collectivePhase === "ATTACKING_TRANSITION" || team.collectivePhase === "DEFENSIVE_TRANSITION" || team.collectivePhase === "COUNTER_ATTACK") {
      base = behaviour.resolveTransitionTarget(roleContext);
    } else if (isAttacking) {
      base = behaviour.resolveInPossessionTarget(roleContext);
    } else {
      base = behaviour.resolveOutOfPossessionTarget(roleContext);
    }
    base = this.instructionTargets.apply(state, team, player, base);

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

    const isAttacking = this.isPossessionPhase(team.collectivePhase);
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

  private isPossessionPhase(phase: TeamMatchState["collectivePhase"]): boolean {
    return phase === "BUILD_UP" || phase === "PROGRESSION" || phase === "FINAL_THIRD"
      || phase === "ATTACKING_TRANSITION" || phase === "COUNTER_ATTACK" || phase === "SET_PIECE";
  }

  /** Converts a recognizable formation anchor into a phase/ball-relative target. */
  private applyCollectivePhase(
    state: MatchState,
    team: TeamMatchState,
    assignment: TacticalShapeAssignment,
    base: Vector2,
  ): Vector2 {
    const role = String(assignment.role);
    const isGoalkeeper = role === "GOALKEEPER";
    const isDefender = role.includes("BACK") || role.includes("DEFENDER");
    const isWide = role.includes("WINGER") || role.includes("WIDE") || role.includes("FULL_BACK") || role.includes("WING_BACK");
    const ballProgress = team.attackingDirection === 1
      ? state.ball.position.x
      : state.pitch.length - state.ball.position.x;

    const phaseHeight: Record<TeamMatchState["collectivePhase"], number> = {
      DEFENSIVE_BLOCK: 0,
      DEFENSIVE_TRANSITION: 3,
      BUILD_UP: 6,
      PROGRESSION: 14,
      FINAL_THIRD: 22,
      ATTACKING_TRANSITION: 10,
      COUNTER_ATTACK: 18,
      SET_PIECE: 8,
    };
    const widthFactor: Record<TeamMatchState["collectivePhase"], number> = {
      DEFENSIVE_BLOCK: .86,
      DEFENSIVE_TRANSITION: .9,
      BUILD_UP: .96,
      PROGRESSION: 1.04,
      FINAL_THIRD: 1.1,
      ATTACKING_TRANSITION: 1.02,
      COUNTER_ATTACK: 1.12,
      SET_PIECE: 1,
    };

    let x = base.x;
    if (!isGoalkeeper) {
      x += phaseHeight[team.collectivePhase];
      // Sustained attacks carry the defensive line near halfway.
      if (isDefender && (team.collectivePhase === "PROGRESSION" || team.collectivePhase === "FINAL_THIRD")) {
        x = Math.max(x, Math.min(49, ballProgress - 22));
      }
      if (!isDefender && team.collectivePhase === "COUNTER_ATTACK") {
        x = Math.max(x, Math.min(88, ballProgress + 14));
      }
    }

    const centreY = state.pitch.width / 2;
    const width = widthFactor[team.collectivePhase] * (isWide ? 1.08 : 1);
    const y = centreY + (base.y - centreY) * width;
    return new Vector2(
      Math.max(1, Math.min(state.pitch.length - 1, x)),
      Math.max(2, Math.min(state.pitch.width - 2, y)),
    );
  }
}
