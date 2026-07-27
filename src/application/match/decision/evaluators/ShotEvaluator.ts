import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Scale tuned so clear box chances beat DRIBBLE (~80) while not returning
 * to the 300–600 shots/game regime. Lock (20s) + 1/possession remain the
 * primary volume control.
 */
const SHOT_UTILITY_SCALE = 0.95;

/** Strong boost inside the box so finishing wins the selector. */
const BOX_FLAT_BOOST = 48;

/** One finishing attempt per continuous possession spell. */
const MAX_SHOTS_PER_POSSESSION = 1;

export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

    const team = this.ownTeam(context);
    if (team?.isShotLocked(context.match.currentSecond)) return [];
    if ((team?.shotsThisPossession ?? 0) >= MAX_SHOTS_PER_POSSESSION) return [];

    // Outside the box need a reasonable window; inside 14m always eligible.
    if (context.world.goalDistance > 20 && context.world.shotWindow < 0.40) {
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
      world.fieldThird === FieldThird.ATTACKING ? 28 : 0;
    const angleBonus = world.goalAngleQuality * 10;

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

    const windowBoost = 0.70 + world.shotWindow * 0.50;

    const space = distanceBase * windowBoost;
    const techniqueComp = attrScore * distanceBase * 0.35 * windowBoost;
    const role = roleQuality * 20 * windowBoost;
    const pressureComp = -pressure * distanceBase * 0.32 * windowBoost;
    const body = (executionQuality - 0.25) / 0.75 * 12;
    const tactical = (angleBonus + attackingBonus) * executionQuality;

    // Box priority: must clear DRIBBLE (~80) on clear chances at ~9m.
    const proximityBoost =
      distance <= 18 ? BOX_FLAT_BOOST * (1 - distance / 36) : 0;

    const repeatPlayerPenalty =
      player.lastActionType === DecisionType.SHOT ? -20 : 0;

    const raw = UtilityScore.fromComponents({
      SPACE: space * executionQuality * 0.42,
      TECHNIQUE: techniqueComp * executionQuality,
      ROLE: role * executionQuality * 0.32,
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
    if (distance <= 6) return 120;
    if (distance <= 12) return 90 + finishing * 1.4;
    if (distance <= 16) return 65 + finishing * 1.0;
    if (distance <= 20) return 40 + finishing * 0.7;
    if (distance <= 25) return 18 + finishing * 0.4;

    const longBonus = Math.max(0, (longShots - 12) * 1.2);
    if (distance <= 32) return Math.max(0, 6 + longBonus);

    return 0;
  }

  private ownTeam(context: DecisionContext) {
    const isHome = context.match.home.players.includes(context.player);
    return isHome ? context.match.home : context.match.away;
  }
}
