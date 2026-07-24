import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { Vector2 } from "../../../../core/geometry/Vector2";

/**
 * Shot evaluator — produces a utility score for attempting a shot on goal.
 *
 * Design principles (corrected):
 * 1. Distance to goal is the most important factor.
 *    — Inside the penalty box (<18m): high base score (40-80+)
 *    — Good range (18-30m): moderate base
 *    — Long range (30-40m): low base; requires high long-shot skill
 *    — Beyond 40m: near-zero unless exceptional longshots
 * 2. Role/position influence (FM26 guide): striker shooting quality = 1.0,
 *    defenders = 0.28, GK = 0.08.
 * 3. Shooting is ALWAYS a candidate for ball carriers — the filter handles
 *    legality. Utility just needs to reflect actual shot value so the selector
 *    picks it when it is the correct choice.
 */
export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.SHOT, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const attrs = player.player.attributes;

    const isHome = match.home.players.includes(player);
    const teamState = isHome ? match.home : match.away;
    const attackingDirection = teamState.attackingDirection;

    // Determine opponent goal position.
    const goalCenter = this.getGoalCenter(match.pitch, attackingDirection);

    // Distance-based base score — this is the dominant factor.
    const distance = player.position.distanceTo(goalCenter);
    const distanceBase = this.distanceBase(
      distance,
      attrs.technical.finishing,
      attrs.technical.longShots
    );

    // Position/role influence from FM26 guide.
    const roleQuality = PositionInfluenceCalculator.shootingQuality(player.currentRole);

    // Attribute quality — finishing + composure weighted.
    const finishing = attrs.technical.finishing / 20;
    const composure = attrs.mental.composure / 20;
    const technique = attrs.technical.technique / 20;
    const attrScore = finishing * 0.55 + composure * 0.30 + technique * 0.15;

    // Pressure from nearby opponents (penalises shooting under pressure).
    const pressure = this.calculatePressure(context);

    // Angle bonus: central shots better than wide angles.
    const angleBonus = this.calculateAngleBonus(player.position, goalCenter, match.pitch);

    const base = distanceBase * roleQuality * attrScore * (1 - pressure * 0.4) + angleBonus;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "DISTANCE_BASE", value: distanceBase },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "ATTR_SCORE", value: attrScore },
      { code: "PRESSURE", value: -pressure },
      { code: "ANGLE_BONUS", value: angleBonus }
    ]);
  }

  /**
   * Returns a base score purely from distance to goal.
   * Scale: 0-100 so it dominates over hold-ball (≈20-30).
   */
  private distanceBase(
    distance: number,
    finishing: number,
    longShots: number
  ): number {
    if (distance <= 6) {
      // Inside 6-yard box: tap-in, should almost always shoot.
      return 120;
    }
    if (distance <= 12) {
      // Penalty spot / close range: very high value.
      return 90 + finishing * 1.5;
    }
    if (distance <= 20) {
      // Inside penalty box: strong shot opportunity.
      return 65 + finishing * 1.0;
    }
    if (distance <= 30) {
      // Good shooting range.
      return 35 + finishing * 0.8;
    }
    if (distance <= 40) {
      // Long range — only worth it with good longShots skill.
      const longShotBonus = Math.max(0, longShots - 10) * 1.5;
      return 10 + longShotBonus;
    }
    // Beyond 40m — rarely worthwhile; only specialists.
    const longShotBonus = Math.max(0, longShots - 15) * 0.8;
    return Math.max(0, longShotBonus - 5);
  }

  private calculatePressure(context: DecisionContext): number {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const opponents = isHome ? match.away.players : match.home.players;

    let pressureCount = 0;
    for (const opp of opponents) {
      if (player.position.distanceTo(opp.position) < 3) {
        pressureCount++;
      }
    }
    return Math.min(1, pressureCount * 0.35);
  }

  /**
   * Central shots (small angle deviation) earn a bonus.
   */
  private calculateAngleBonus(
    playerPos: Vector2,
    goalCenter: Vector2,
    pitch: { width: number }
  ): number {
    const pitchCentreY = pitch.width / 2;
    const yDeviation = Math.abs(playerPos.y - pitchCentreY);
    const maxDeviation = pitch.width / 2;
    // 0 deviation = bonus 8; half-pitch wide = bonus 0.
    return Math.max(0, 8 * (1 - yDeviation / maxDeviation));
  }

  private getGoalCenter(
    pitch: { length: number; width: number; geometry: { leftGoal: { center: { x: number; y: number } }; rightGoal: { center: { x: number; y: number } } } },
    attackingDirection: 1 | -1
  ): Vector2 {
    const goal = attackingDirection === 1
      ? pitch.geometry.rightGoal
      : pitch.geometry.leftGoal;
    return new Vector2(goal.center.x, goal.center.y);
  }
}
