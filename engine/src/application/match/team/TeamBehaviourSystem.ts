import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { BallState } from "../../../core/movement/BallMatchState";

/** Distance within which a player presses the ball carrier. */
const PRESS_DISTANCE = 12;
/** Minimum marking distance. */
const MARK_DISTANCE = 3;
/** Covering position depth offset. */
const COVER_DEPTH_OFFSET = 5;

/**
 * Coordinates collective team behaviour each tick:
 * - Pressing triggers when the ball carrier is nearby and in range
 * - Marking assigns a defender to each threatening attacker
 * - Covering adjusts defensive shape depth
 */
export class TeamBehaviourSystem {

  public update(state: MatchState): void {
    this.updateTeamBehaviour(state, state.home, state.away);
    this.updateTeamBehaviour(state, state.away, state.home);
  }

  private updateTeamBehaviour(
    state: MatchState,
    team: TeamMatchState,
    opponents: TeamMatchState
  ): void {

    const isDefending = state.defendingTeam === team;

    if (isDefending) {
      this.assignMarking(state, team, opponents);
      if (team.collectivePhase === "DEFENSIVE_TRANSITION") {
        if (team.tactic.transition.counterPress && !team.tactic.transition.regroup) {
          this.coordinateCounterPress(state, team, opponents);
        }
      } else {
        this.coordinatePressing(state, team, opponents);
      }
    } else {
      this.supportAttack(state, team);
    }

  }

  /** First two nearby players counter-press; the remaining block recomposes. */
  private coordinateCounterPress(
    state: MatchState,
    team: TeamMatchState,
    opponents: TeamMatchState,
  ): void {
    const owner = state.ball.owner;
    if (!owner || !opponents.players.includes(owner)) return;
    team.players
      .filter(player => player.currentRole !== "GOALKEEPER" && !player.hasBall)
      .sort((a, b) => a.position.distanceTo(owner.position) - b.position.distanceTo(owner.position))
      .slice(0, 2)
      .filter(player => player.position.distanceTo(owner.position) <= 18)
      .forEach(player => player.setTarget(owner.position));
  }

  /**
   * Pressing: designates the closest available outfield player to
   * press the ball carrier when pressing is instructed or naturally triggered.
   */
  private coordinatePressing(
    state: MatchState,
    team: TeamMatchState,
    opponents: TeamMatchState
  ): void {

    const ball = state.ball;
    if (ball.state === BallState.IN_FLIGHT || !ball.owner) return;

    const ballCarrier = ball.owner;
    const isOpponentBall = opponents.players.includes(ballCarrier);
    if (!isOpponentBall) return;

    const instructions = team.tactic.teamInstructions.instructions;
    const targeted = team.tactic.opposition.players.find(item => item.opponentPlayerId === ballCarrier.player.id)?.press ?? false;
    const preventShort = team.tactic.outOfPossession.preventShortDistribution && ballCarrier.currentRole.includes("GOALKEEPER");
    const shouldPress = instructions.includes("HIGH_PRESS") || targeted || preventShort ||
      this.isBallInOwnHalf(state, team);

    if (!shouldPress) return;

    // Find the closest outfield player not already assigned.
    const outfield = team.players.filter(p => p.currentRole !== "GOALKEEPER" && !p.hasBall);
    if (outfield.length === 0) return;

    const presser = this.findClosest(outfield, ballCarrier.position);
    if (!presser) return;

    const dist = presser.position.distanceTo(ballCarrier.position);
    const intensity = team.tactic.outOfPossession.intensity;
    const pressDistance = PRESS_DISTANCE * (intensity === "HIGH" ? 1.45 : intensity === "LOW" ? .72 : 1);
    if (dist <= pressDistance) {
      const centreY = state.pitch.width / 2;
      const side = ballCarrier.position.y < centreY ? -1 : 1;
      const direction = team.tactic.outOfPossession.showDirection;
      const yOffset = direction === "INSIDE" ? side * 2 : direction === "OUTSIDE" ? side * -2 : 0;
      presser.setTarget(new Vector2(ballCarrier.position.x, ballCarrier.position.y + yOffset));
    }

  }

  /**
   * Marking: for each dangerous opponent (within PRESS_DISTANCE of our goal),
   * assign the closest available defender.
   */
  private assignMarking(
    _state: MatchState,
    team: TeamMatchState,
    opponents: TeamMatchState
  ): void {

    const defenders = team.players.filter(
      p => p.currentRole.includes("CENTRE_BACK") ||
        p.currentRole.includes("FULL_BACK") ||
        p.currentRole === "WING_BACK" ||
        p.currentRole === "DEFENSIVE_MIDFIELDER"
    );

    const threats = opponents.players.filter(
      p => p.currentRole === "STRIKER" || p.currentRole === "FALSE_NINE" ||
        p.currentRole === "ATTACKING_MIDFIELDER" ||
        p.currentRole === "WINGER" || p.currentRole === "INSIDE_FORWARD"
    ).sort((a, b) => this.markingPriority(team, b) - this.markingPriority(team, a));

    const used = new Set<PlayerMatchState>();

    for (const threat of threats) {
      const available = defenders.filter(d => !used.has(d));
      if (available.length === 0) break;

      const instruction = team.tactic.opposition.players.find(item => item.opponentPlayerId === threat.player.id);
      const instructedMarker = instruction?.markWithPlayerId
        ? available.find(player => player.player.id === instruction.markWithPlayerId)
        : undefined;
      const marker = instructedMarker ?? this.findClosest(available, threat.position);
      if (!marker) continue;

      used.add(marker);

      // Stand MARK_DISTANCE metres from the threat, between threat and our goal.
      const markPos = this.computeMarkPosition(marker, threat, team);
      marker.setTarget(markPos);

      if (instruction?.doubleMark) {
        const second = this.findClosest(defenders.filter(defender => !used.has(defender)), threat.position);
        if (second) {
          used.add(second);
          second.setTarget(this.computeMarkPosition(second, threat, team));
        }
      }
    }

  }

  /**
   * Support attack: players without the ball move to create passing options.
   * Off-ball movement is handled primarily by the tactical engine;
   * here we add dynamic support runs.
   */
  private supportAttack(
    state: MatchState,
    team: TeamMatchState
  ): void {

    const ball = state.ball;
    if (!ball.owner) return;

    const ballCarrierIsOurs = team.players.includes(ball.owner);
    if (!ballCarrierIsOurs) return;

    const instructions = team.tactic.teamInstructions.instructions;
    const widePlay = instructions.includes("WIDE_PLAY");
    const narrowPlay = instructions.includes("NARROW_PLAY");

    for (const player of team.players) {
      if (player.hasBall) continue;

      // Adjust the lateral spread based on instructions.
      const currentTarget = player.targetPosition;
      const centerY = state.pitch.width / 2;

      let adjustedX = currentTarget.x;
      let adjustedY = currentTarget.y;

      if (widePlay) {
        // Push wide: amplify lateral distance from center.
        const offsetY = adjustedY - centerY;
        adjustedY = centerY + offsetY * 1.2;
      } else if (narrowPlay) {
        // Tighten toward center.
        adjustedY = adjustedY * 0.7 + centerY * 0.3;
      }

      const role = String(player.currentRole);
      const runner = role.includes("WINGER") || role.includes("STRIKER") || role.includes("BOX_TO_BOX");
      if (runner && (team.collectivePhase === "ATTACKING_TRANSITION" || team.collectivePhase === "COUNTER_ATTACK")) {
        adjustedX += team.attackingDirection * 8;
      }

      // Clamp to pitch bounds.
      adjustedX = Math.max(0, Math.min(state.pitch.length, adjustedX));
      adjustedY = Math.max(0, Math.min(state.pitch.width, adjustedY));

      player.setTarget(new Vector2(adjustedX, adjustedY));
    }

  }

  private isBallInOwnHalf(state: MatchState, team: TeamMatchState): boolean {
    const normalizedX = state.ball.position.x / state.pitch.length;
    const attackingX = team.attackingDirection === 1 ? normalizedX : 1 - normalizedX;
    return attackingX < 0.5;
  }

  private findClosest(
    players: PlayerMatchState[],
    target: Vector2
  ): PlayerMatchState | null {

    let closest: PlayerMatchState | null = null;
    let minDist = Infinity;

    for (const p of players) {
      const d = p.position.distanceTo(target);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }

    return closest;

  }

  private computeMarkPosition(
    _marker: PlayerMatchState,
    threat: PlayerMatchState,
    _team: TeamMatchState
  ): Vector2 {

    // Position slightly behind and to the side of the threat.
    // Simple version: stand MARK_DISTANCE behind the threat in the direction of our goal.
    const tight = _team.tactic.outOfPossession.tightMarking ||
      _team.tactic.opposition.players.some(item => item.opponentPlayerId === threat.player.id && item.tightMark);
    const distance = tight ? MARK_DISTANCE * .55 : MARK_DISTANCE;
    return new Vector2(
      threat.position.x - distance * _team.attackingDirection,
      threat.position.y
    );

  }

  private markingPriority(team: TeamMatchState, player: PlayerMatchState): number {
    const instruction = team.tactic.opposition.players.find(item => item.opponentPlayerId === player.player.id);
    return instruction ? (instruction.doubleMark ? 3 : instruction.tightMark ? 2 : 1) : 0;
  }

}
