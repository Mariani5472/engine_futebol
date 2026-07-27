import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Global scale applied after component sum.
 * Calibration showed ~1 shot/game — pass/hold were winning the selector.
 * This bias makes finishing competitive inside the final third.
 */
const SHOT_UTILITY_SCALE = 1.85;

/** Extra flat boost when inside ~18m of goal. */
const BOX_FLAT_BOOST = 55;

export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

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

    // Outside long-shot range with no base → do not propose a shot.
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
      world.fieldThird === FieldThird.ATTACKING ? 42 : 0;
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

    const windowBoost = 0.85 + world.shotWindow * 0.55;

    const space = distanceBase * windowBoost;
    const techniqueComp = attrScore * distanceBase * 0.40 * windowBoost;
    const role = roleQuality * 28 * windowBoost;
    // Softer pressure penalty so a closed-down striker still prefers shot over endless hold.
    const pressureComp = -pressure * distanceBase * 0.22 * windowBoost;
    const body = (executionQuality - 0.25) / 0.75 * 14;
    const tactical = (angleBonus + attackingBonus) * executionQuality;
    const proximityBoost = distance <= 18 ? BOX_FLAT_BOOST * (1 - distance / 36) : 0;

    const raw = UtilityScore.fromComponents({
      SPACE: space * executionQuality * 0.45,
      TECHNIQUE: techniqueComp * executionQuality,
      ROLE: role * executionQuality * 0.35,
      PRESSURE: pressureComp * executionQuality,
      BODY: body,
      TACTICAL: tactical + proximityBoost,
    });

    // Scale total via an extra component so debug still shows the boost.
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
    if (distance <= 6) return 150;
    if (distance <= 12) return 110 + finishing * 1.8;
    if (distance <= 18) return 88 + finishing * 1.4;
    if (distance <= 25) return 58 + finishing * 1.0;
    if (distance <= 32) return 28 + finishing * 0.6;

    const longBonus = Math.max(0, (longShots - 8) * 1.6);
    if (distance <= 40) return 12 + longBonus;

    return Math.max(0, longBonus * 0.5 - 10);
  }
}
