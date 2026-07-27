import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

/**
 * Evaluates marking behaviour for off-ball defenders.
 *
 * MARK becomes attractive when the team is out of possession, the opponent
 * closest to the player is dangerous, and the player is close enough to stay
 * connected to the duel without overcommitting.
 */
export class MarkEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (player.hasBall) return [];

    const score = this.calculateUtility(context);
    if (score.total < 10) return [];

    return [new Decision(DecisionType.MARK, score.total)];
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

    const ownGoalPressure = this.calculateOwnGoalPressure(
      player,
      team.attackingDirection,
      match.pitch.length
    );

    const ballPressure = this.calculateBallPressure(match, player, opponents);
    const roleBonus = this.calculateRoleBonus(player);
    const laneScore = this.calculateLaneScore(player, nearestOpponent);
    const staminaModifier = Math.max(0.7, 1 - player.fatigue / 160);

    const proximityScore = this.calculateProximityScore(nearestOpponentDistance);
    const teamOutOfPossessionBonus = match.ball.owner
      ? (team.players.includes(match.ball.owner) ? 0 : 10)
      : 6;

    const total = Math.max(
      0,
      (proximityScore + ownGoalPressure + ballPressure + roleBonus + laneScore + teamOutOfPossessionBonus) *
        staminaModifier
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "PROXIMITY", value: proximityScore },
      { code: "OWN_GOAL_PRESSURE", value: ownGoalPressure },
      { code: "BALL_PRESSURE", value: ballPressure },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "LANE_SCORE", value: laneScore },
      { code: "OUT_OF_POSSESSION", value: teamOutOfPossessionBonus },
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

  private calculateProximityScore(distance: number): number {
    if (!Number.isFinite(distance)) return 0;
    if (distance < 2) return 20;
    if (distance < 4) return 16;
    if (distance < 6) return 10;
    if (distance < 8) return 5;
    return 0;
  }

  private calculateOwnGoalPressure(
    player: PlayerMatchState,
    attackingDirection: 1 | -1,
    pitchLength: number
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(player.position.x - ownGoalX);
    const deepZone = Math.max(0, 1 - distanceToOwnGoal / 40);

    return deepZone * 14;
  }

  private calculateBallPressure(
    match: DecisionContext["match"],
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const ballOwner = match.ball.owner;

    if (!ballOwner) return 4;

    const ballOwnerDistance = player.position.distanceTo(ballOwner.position);
    const nearestOpponentToBallOwner = opponents.reduce(
      (nearest, opponent) =>
        Math.min(nearest, ballOwner.position.distanceTo(opponent.position)),
      Infinity
    );

    const pressure = Math.max(0, 12 - ballOwnerDistance * 1.2);
    const interceptionThreat = Number.isFinite(nearestOpponentToBallOwner)
      ? Math.max(0, 6 - nearestOpponentToBallOwner)
      : 0;

    return pressure + interceptionThreat;
  }

  private calculateRoleBonus(player: PlayerMatchState): number {
    const role = String(player.currentRole).toUpperCase();

    if (role.includes("CB") || role.includes("DEF") || role.includes("DM")) return 12;
    if (role.includes("FB") || role.includes("WB")) return 8;
    if (role.includes("CM") || role.includes("CDM")) return 6;
    return 3;
  }

  private calculateLaneScore(
    player: PlayerMatchState,
    nearestOpponent: PlayerMatchState | null
  ): number {
    if (!nearestOpponent) return 0;

    const lateralDistance = Math.abs(player.position.y - nearestOpponent.position.y);

    if (lateralDistance < 1.5) return 10;
    if (lateralDistance < 3) return 7;
    if (lateralDistance < 5) return 4;
    return 1;
  }
}
