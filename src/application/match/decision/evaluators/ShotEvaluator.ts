import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Shot evaluator — produces a utility score for attempting a shot on goal.
 *
 * Spatial / pressure perception comes from WorldAwareness.
 * This class only combines those signals with attribute and body quality.
 */
export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.SHOT, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, world } = context;
    const attrs = player.player.attributes;

    const distance = world.goalDistance;
    const distanceBase = this.distanceBase(
      distance,
      attrs.technical.finishing,
      attrs.technical.longShots
    );

    const roleQuality = PositionInfluenceCalculator.shootingQuality(player.currentRole);

    const finishing = attrs.technical.finishing / 20;
    const composure = attrs.mental.composure / 20;
    const technique = attrs.technical.technique / 20;
    const attrScore = finishing * 0.55 + composure * 0.30 + technique * 0.15;

    const pressure = world.pressure;

    const attackingBonus =
      world.fieldThird === FieldThird.ATTACKING ? 28 : 0;

    const angleBonus = world.goalAngleQuality * 8;

    const desiredDirection = world.goalCenter.subtract(player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      player.facingDirection,
      desiredDirection
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.50 + bodyQuality * 0.50
    );

    // shotWindow amplifies when the composite tactical window is open.
    const windowBoost = 0.75 + world.shotWindow * 0.50;

    const base = (
      distanceBase * roleQuality * attrScore * (1 - pressure * 0.4) +
      angleBonus +
      attackingBonus
    ) * executionQuality * windowBoost;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "DISTANCE_BASE", value: distanceBase },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "ATTR_SCORE", value: attrScore },
      { code: "PRESSURE", value: -pressure },
      { code: "ANGLE_BONUS", value: angleBonus },
      { code: "SHOT_WINDOW", value: world.shotWindow },
      { code: "BODY_QUALITY", value: bodyQuality },
      { code: "ORIENTATION", value: orientationQuality },
      { code: "EXECUTION_QUALITY", value: executionQuality },
    ]);
  }

  private distanceBase(
    distance: number,
    finishing: number,
    longShots: number
  ): number {
    if (distance <= 6) return 130;
    if (distance <= 12) return 95 + finishing * 1.6;
    if (distance <= 20) return 72 + finishing * 1.2;
    if (distance <= 28) return 48 + finishing * 0.9;

    const longBonus = Math.max(0, (longShots - 8) * 1.4);
    if (distance <= 38) return 18 + longBonus;

    return Math.max(0, longBonus * 0.6 - 8);
  }
}
