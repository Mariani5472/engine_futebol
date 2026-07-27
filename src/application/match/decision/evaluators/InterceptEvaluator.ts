import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionReadiness } from "./ActionReadiness";

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
    if (distanceToOwner > 12) return [];

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

    const receiver = this.getNearestTeammateToOwner(ballOwner, ownerTeam.players);
    const laneScore = receiver
      ? this.calculatePassingLaneScore(player.position, ballOwner.position, receiver.position)
      : 0.5; // unknown lane — neutral opportunity

    const anticipation = (player.player.attributes.mental.anticipation ?? 10) / 20;
    const decisions = (player.player.attributes.mental.decisions ?? 10) / 20;
    const positioning = (player.player.attributes.mental.positioning ?? 10) / 20;
    const aggression = (player.player.attributes.mental.aggression ?? 10) / 20;
    const tackling = (player.player.attributes.technical.tackling ?? 10) / 20;

    const proximityScore = Math.max(0, 18 - distanceToOwner * 1.5);
    const pressureScore = this.calculatePressureScore(player, opponents);
    const roleBonus = this.calculateRoleBonus(player);
    const laneBonus = laneScore * 18;
    const preparationBonus = this.calculatePassPreparationBonus(
      context,
      ballOwner,
      receiver,
      laneScore,
    );
    const anticipationBonus = anticipation * 14;
    const positioningBonus = positioning * 10;
    const decisionsBonus = decisions * 8;
    const aggressionBonus = aggression * 5;
    const tacklingBonus = tackling * 4;
    const staminaModifier = Math.max(0.65, 1 - (player.fatigue ?? 0) / 170);

    return UtilityScore.fromComponents({
      SPACE: proximityScore,
      PRESSURE: pressureScore,
      TECHNIQUE: anticipationBonus + positioningBonus + decisionsBonus + tacklingBonus,
      ROLE: roleBonus,
      TACTICAL: laneBonus + preparationBonus + aggressionBonus,
      FATIGUE: (staminaModifier - 1) * (
        proximityScore + pressureScore + laneBonus + preparationBonus +
        anticipationBonus + positioningBonus + decisionsBonus +
        aggressionBonus + tacklingBonus + roleBonus
      ),
    });
  }

  private calculatePassPreparationBonus(
    context: DecisionContext,
    ballOwner: PlayerMatchState,
    receiver: PlayerMatchState | null,
    laneScore: number,
  ): number {
    if (ballOwner.activeAction?.type !== DecisionType.PASS) return 0;

    const opportunity = ActionReadiness.interruptionOpportunity(
      ballOwner,
      context.player,
      ActionReadiness.currentTime(context),
    );

    if (opportunity <= 0) return 0;

    // Even without a known receiver, preparing a pass is interceptable.
    const effectiveLane = receiver ? laneScore : Math.max(0.45, laneScore);
    return 24 * opportunity * effectiveLane;
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

    if (ab2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);

    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    const closestX = a.x + t * abx;
    const closestY = a.y + t * aby;

    return Math.hypot(p.x - closestX, p.y - closestY);
  }

  private calculatePressureScore(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      return Math.min(nearest, player.position.distanceTo(opponent.position));
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
