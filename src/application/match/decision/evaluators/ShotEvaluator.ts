import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/** Toward ~25–35 shots/game with tick=2s + 30s lock. */
const SHOT_UTILITY_SCALE = 0.35;

const BOX_FLAT_BOOST = 12;

/** One finishing attempt per continuous possession spell. */
const MAX_SHOTS_PER_POSSESSION = 1;

export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

    const team = this.ownTeam(context);
    if (team?.isShotLocked(context.match.currentSecond)) return [];
    if ((team?.shotsThisPossession ?? 0) >= MAX_SHOTS_PER_POSSESSION) return [];

    // Stricter window: only clear chances beyond close range.
    if (context.world.goalDistance > 18 && context.world.shotWindow < 0.50) {
      return [];
    }
    if (context.world.goalDistance > 14 && context.world.shotWindow < 0.28) {
      return [];
    }

    const score = this.calculateUtility(context);
    if (score.total <= 0) return [];

    return [
      new Decision(
        DecisionType.SHOT,
        score.total,
        undefined,
        score.reasons,
        score.components,
      ),
    ];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, world } = context;
    const attrs = player.player.attributes;

    const distance = world.goalDistance;
    const distanceBase = this.distanceBase(
      distance,
      attrs.technical.finishing ?? 10,
      attrs.technical.longShots ?? 10,
    );

    if (distanceBase <= 0) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }

    const roleQuality = PositionInfluenceCalculator.shootingQuality(player.currentRole);

    const finishing = (attrs.technical.finishing ?? 10) / 20;
    const composure = (attrs.mental.composure ?? 10) / 20;
    const technique = (attrs.technical.technique ?? 10) / 20;
    const attrScore = finishing * 0.55 + composure * 0.30 + technique * 0.15;

    const pressure = world.pressure;
    const attackingBonus =
      world.fieldThird === FieldThird.ATTACKING ? 16 : 0;
    const angleBonus = world.goalAngleQuality * 6;

    const desiredDirection = world.goalCenter.subtract(player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.50 + bodyQuality * 0.50,
    );

    const windowBoost = 0.55 + world.shotWindow * 0.50;

    const space = distanceBase * windowBoost;
    const techniqueComp = attrScore * distanceBase * 0.30 * windowBoost;
    const role = roleQuality * 14 * windowBoost;
    const pressureComp = -pressure * distanceBase * 0.48 * windowBoost;
    const body = (executionQuality - 0.25) / 0.75 * 8;
    const tactical = (angleBonus + attackingBonus) * executionQuality;
    const proximityBoost =
      distance <= 14 ? BOX_FLAT_BOOST * (1 - distance / 28) : 0;

    const repeatPlayerPenalty =
      player.lastActionType === DecisionType.SHOT ? -30 : 0;

    const raw = UtilityScore.fromComponents({
      SPACE: space * executionQuality * 0.38,
      TECHNIQUE: techniqueComp * executionQuality,
      ROLE: role * executionQuality * 0.28,
      PRESSURE: pressureComp * executionQuality,
      BODY: body,
      TACTICAL: tactical + proximityBoost + repeatPlayerPenalty,
    });

    const scaledTotal = raw.total * SHOT_UTILITY_SCALE;
    const scaleAdj = scaledTotal - raw.total;

    return UtilityScore.fromComponents({
      ...raw.components,
      PRIORITY_SCALE: scaleAdj,
    });
  }

  private distanceBase(
    distance: number,
    finishing: number,
    longShots: number
  ): number {
    if (distance <= 6) return 88;
    if (distance <= 12) return 62 + finishing * 1.0;
    if (distance <= 16) return 42 + finishing * 0.7;
    if (distance <= 20) return 24 + finishing * 0.45;
    if (distance <= 25) return 10 + finishing * 0.25;

    const longBonus = Math.max(0, (longShots - 14) * 1.0);
    if (distance <= 30) return Math.max(0, 2 + longBonus);

    return 0;
  }

  private ownTeam(context: DecisionContext) {
    const isHome = context.match.home.players.includes(context.player);
    return isHome ? context.match.home : context.match.away;
  }
}
