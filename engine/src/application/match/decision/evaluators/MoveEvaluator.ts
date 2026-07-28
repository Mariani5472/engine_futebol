import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

/**
 * Evaluates off-ball movement.
 *
 * MOVE is the default structural action when a player is not directly pressing,
 * covering, tackling, or preparing to receive. It should be common, but not so
 * valuable that it suppresses more specific tactical actions.
 */
export class MoveEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const score = this.calculateUtility(context);

    if (score.total < 8) return [];

    return [new Decision(DecisionType.MOVE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const target = player.targetPosition;
    const distanceToTarget = player.position.distanceTo(target);
    const nearestOpponent = this.getNearestDistance(player.position, opponents);
    const nearestTeammate = this.getNearestTeammateDistance(player, team.players);
    const ballDistance = player.position.distanceTo(match.ball.position);

    const roleBonus = PositionInfluenceCalculator.isAttackingRole(player.currentRole)
      ? 6
      : 4;

    const spacingBonus = Math.max(0, Math.min(8, nearestTeammate / 4));
    const separationBonus = Math.max(0, Math.min(8, nearestOpponent / 5));
    const targetUrgency = Math.max(0, Math.min(10, distanceToTarget * 1.2));
    const ballRelation = Math.max(0, Math.min(6, ballDistance / 18));
    const fatigueModifier = Math.max(0.7, 1 - player.fatigue / 180);

    const teamPossessionBonus = match.ball.owner
      ? (team.players.includes(match.ball.owner) ? 2 : 4)
      : 3;

    const total = Math.max(
      0,
      (6 + roleBonus + spacingBonus + separationBonus + targetUrgency + ballRelation + teamPossessionBonus) *
        fatigueModifier -
        this.calculatePressurePenalty(nearestOpponent)
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "SPACING", value: spacingBonus },
      { code: "SEPARATION", value: separationBonus },
      { code: "TARGET_URGENCY", value: targetUrgency },
      { code: "BALL_RELATION", value: ballRelation },
      { code: "TEAM_POSSESSION", value: teamPossessionBonus },
    ]);
  }

  private getNearestDistance(
    position: { distanceTo(other: { x: number; y: number }): number },
    opponents: Array<PlayerMatchState>
  ): number {
    return opponents.reduce(
      (nearest, opponent) => Math.min(nearest, position.distanceTo(opponent.position)),
      Infinity
    );
  }

  private getNearestTeammateDistance(
    player: PlayerMatchState,
    teammates: Array<PlayerMatchState>
  ): number {
    return teammates.reduce((nearest, teammate) => {
      if (teammate === player) return nearest;
      const distance = player.position.distanceTo(teammate.position);
      return Math.min(nearest, distance);
    }, Infinity);
  }

  private calculatePressurePenalty(nearestOpponent: number): number {
    if (!Number.isFinite(nearestOpponent)) return 0;
    if (nearestOpponent < 2) return 12;
    if (nearestOpponent < 4) return 8;
    if (nearestOpponent < 6) return 4;
    return 0;
  }
}
