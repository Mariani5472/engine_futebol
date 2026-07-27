import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

/**
 * Evaluates interception opportunities.
 *
 * INTERCEPT represents anticipation of a pass lane rather than an immediate
 * tackle. The player should be close enough to the opponent ball carrier and
 * positioned on a plausible passing line to justify stepping in.
 */
export class InterceptEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (player.hasBall) return [];

    const ballOwner = match.ball.owner;
    if (!ballOwner) return [];

    const isHome = match.home.players.includes(player);
    const ownerIsOpponent = isHome
      ? match.away.players.includes(ballOwner)
      : match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const distanceToOwner = player.position.distanceTo(ballOwner.position);
    if (distanceToOwner > 10) return [];

    const score = this.calculateUtility(context, ballOwner, distanceToOwner);
    if (score.total < 12) return [];

    return [new Decision(DecisionType.INTERCEPT, score.total)];
  }

  private calculateUtility(
    context: DecisionContext,
    ballOwner: PlayerMatchState,
    distanceToOwner: number
  ): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const ownerTeam = isHome ? match.away : match.home;
    const opponents = isHome ? match.away.players : match.home.players;

    const nearestPotentialReceiver = this.getNearestTeammateToOwner(
      ballOwner,
      ownerTeam.players
    );

    const laneScore = nearestPotentialReceiver
      ? this.calculatePassingLaneScore(
          player.position,
          ballOwner.position,
          nearestPotentialReceiver.position
        )
      : 0;

    const anticipation = player.player.attributes.mental.anticipation / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const positioning = player.player.attributes.mental.positioning / 20;
    const aggression = player.player.attributes.mental.aggression / 20;
    const tackling = player.player.attributes.technical.tackling / 20;

    const proximityScore = Math.max(0, 18 - distanceToOwner * 1.5);
    const pressureScore = this.calculatePressureScore(player, opponents);
    const roleBonus = this.calculateRoleBonus(player);
    const laneBonus = laneScore * 18;
    const anticipationBonus = anticipation * 14;
    const positioningBonus = positioning * 10;
    const decisionsBonus = decisions * 8;
    const aggressionBonus = aggression * 5;
    const tacklingBonus = tackling * 4;
    const staminaModifier = Math.max(0.65, 1 - player.fatigue / 170);

    const total = Math.max(
      0,
      (
        proximityScore +
        pressureScore +
        laneBonus +
        anticipationBonus +
        positioningBonus +
        decisionsBonus +
        aggressionBonus +
        tacklingBonus +
        roleBonus
      ) * staminaModifier
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "PROXIMITY", value: proximityScore },
      { code: "PRESSURE", value: pressureScore },
      { code: "LANE", value: laneBonus },
      { code: "ANTICIPATION", value: anticipationBonus },
      { code: "POSITIONING", value: positioningBonus },
      { code: "DECISIONS", value: decisionsBonus },
      { code: "ROLE_BONUS", value: roleBonus },
    ]);
  }

  private getNearestTeammateToOwner(
    owner: PlayerMatchState,
    teammates: PlayerMatchState[]
  ): PlayerMatchState | null {
    const candidates = teammates.filter((teammate) => teammate !== owner);
    if (candidates.length === 0) return null;

    return candidates.reduce((nearest, candidate) => {
      if (!nearest) return candidate;
      const candidateDistance = owner.position.distanceTo(candidate.position);
      const nearestDistance = owner.position.distanceTo(nearest.position);
      return candidateDistance < nearestDistance ? candidate : nearest;
    }, candidates[0] ?? null);
  }

  private calculatePassingLaneScore(
    interceptor: { x: number; y: number },
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number {
    const distance = this.distancePointToSegment(interceptor, from, to);

    if (distance < 0.75) return 1;
    if (distance < 1.5) return 0.85;
    if (distance < 2.5) return 0.65;
    if (distance < 4) return 0.35;
    return 0;
  }

  private distancePointToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;

    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    const closestX = a.x + t * abx;
    const closestY = a.y + t * aby;
    const dx = p.x - closestX;
    const dy = p.y - closestY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculatePressureScore(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      const distance = player.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    if (!Number.isFinite(nearestOpponentDistance)) return 0;
    if (nearestOpponentDistance < 2) return 12;
    if (nearestOpponentDistance < 4) return 9;
    if (nearestOpponentDistance < 6) return 5;
    return 1;
  }

  private calculateRoleBonus(player: PlayerMatchState): number {
    const role = String(player.currentRole).toUpperCase();

    if (role.includes("CB") || role.includes("DEF") || role.includes("DM")) return 10;
    if (role.includes("FB") || role.includes("WB")) return 8;
    if (role.includes("CM")) return 6;
    return 4;
  }
}
