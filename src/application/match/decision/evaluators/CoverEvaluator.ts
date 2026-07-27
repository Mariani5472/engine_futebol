import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

/**
 * COVER: defensive support that protects space behind the first pressure line.
 *
 * The player does not engage directly like PRESS or TACKLE; instead, they
 * shift to a covering lane to prevent progression, protect central channels,
 * and keep defensive structure compact.
 */
export class CoverEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const ball = context.match.ball;
    if (!ball.owner) return [];

    const score = this.calculateUtility(context);
    if (score.total < 12) return [];

    return [new Decision(DecisionType.COVER, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const nearestOpponent = this.getNearestOpponent(player, opponents);
    const nearestOpponentDistance = nearestOpponent
      ? player.position.distanceTo(nearestOpponent.position)
      : Infinity;

    const ballOwner = match.ball.owner;
    const ballOwnerDistance = ballOwner
      ? player.position.distanceTo(ballOwner.position)
      : Infinity;

    const ownGoalPressure = this.calculateOwnGoalPressure(
      player,
      team.attackingDirection,
      match.pitch.length
    );

    const centralLaneBonus = this.calculateCentralLaneBonus(player, match.pitch.width);
    const roleBonus = this.calculateRoleBonus(player);
    const compactnessBonus = this.calculateCompactnessBonus(player, team.players);
    const pressurePenalty = this.calculatePressurePenalty(nearestOpponentDistance);
    const ballRelationBonus = Number.isFinite(ballOwnerDistance)
      ? Math.max(0, 12 - ballOwnerDistance * 0.8)
      : 0;
    const staminaModifier = Math.max(0.7, 1 - player.fatigue / 170);

    const total = Math.max(
      0,
      (
        ownGoalPressure +
        centralLaneBonus +
        roleBonus +
        compactnessBonus +
        ballRelationBonus
      ) * staminaModifier - pressurePenalty
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "OWN_GOAL_PRESSURE", value: ownGoalPressure },
      { code: "CENTRAL_LANE", value: centralLaneBonus },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "COMPACTNESS", value: compactnessBonus },
      { code: "BALL_RELATION", value: ballRelationBonus },
      { code: "PRESSURE_PENALTY", value: -pressurePenalty },
    ]);
  }

  private getNearestOpponent(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): PlayerMatchState | null {
    if (opponents.length === 0) return null;

    return opponents.reduce((nearest, opponent) => {
      if (!nearest) return opponent;
      const currentDistance = player.position.distanceTo(opponent.position);
      const nearestDistance = player.position.distanceTo(nearest.position);
      return currentDistance < nearestDistance ? opponent : nearest;
    }, opponents[0] ?? null);
  }

  private calculateOwnGoalPressure(
    player: PlayerMatchState,
    attackingDirection: 1 | -1,
    pitchLength: number
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(player.position.x - ownGoalX);

    return Math.max(0, 18 - distanceToOwnGoal * 0.25);
  }

  private calculateCentralLaneBonus(player: PlayerMatchState, pitchWidth: number): number {
    const pitchCenterY = pitchWidth / 2;
    const lateralDistance = Math.abs(player.position.y - pitchCenterY);

    if (lateralDistance < pitchWidth * 0.10) return 10;
    if (lateralDistance < pitchWidth * 0.20) return 7;
    if (lateralDistance < pitchWidth * 0.30) return 4;
    return 1;
  }

  private calculateRoleBonus(player: PlayerMatchState): number {
    const role = String(player.currentRole).toUpperCase();

    if (role.includes("CB") || role.includes("DEF") || role.includes("DM")) return 12;
    if (role.includes("FB") || role.includes("WB")) return 9;
    if (role.includes("CM")) return 6;
    if (role.includes("GK")) return 5;
    return 3;
  }

  private calculateCompactnessBonus(
    player: PlayerMatchState,
    teammates: PlayerMatchState[]
  ): number {
    const nearestTeammateDistance = teammates.reduce((nearest, teammate) => {
      if (teammate === player) return nearest;
      const distance = player.position.distanceTo(teammate.position);
      return Math.min(nearest, distance);
    }, Infinity);

    if (!Number.isFinite(nearestTeammateDistance)) return 0;
    if (nearestTeammateDistance < 6) return 10;
    if (nearestTeammateDistance < 10) return 7;
    if (nearestTeammateDistance < 14) return 4;
    return 1;
  }

  private calculatePressurePenalty(nearestOpponentDistance: number): number {
    if (!Number.isFinite(nearestOpponentDistance)) return 0;
    if (nearestOpponentDistance < 2) return 16;
    if (nearestOpponentDistance < 4) return 10;
    if (nearestOpponentDistance < 6) return 5;
    return 0;
  }
}
