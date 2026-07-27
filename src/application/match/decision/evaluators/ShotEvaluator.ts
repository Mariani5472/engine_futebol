import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { Vector2 } from "../../../../core/geometry/Vector2";
import { FieldThirdResolver } from "../../../../core/pitch/FieldThirdResolver";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Shot evaluator — produces a utility score for attempting a shot on goal.
 *
 * The score represents tactical value, but also incorporates the player's
 * transient ability to physically execute the shot from the current posture.
 */
export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.SHOT, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const attrs = player.player.attributes;

    const isHome = match.home.players.includes(player);
    const teamState = isHome ? match.home : match.away;
    const attackingDirection = teamState.attackingDirection;

    const goalCenter = this.getGoalCenter(match.pitch, attackingDirection);

    const distance = player.position.distanceTo(goalCenter);
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

    const pressure = this.calculatePressure(context);

    const fieldThird = this.getFieldThird(
      match.pitch.length,
      player.position,
      attackingDirection
    );
    const attackingBonus = fieldThird === "ATTACKING" ? 28 : 0;

    const angleBonus = this.calculateAngleBonus(player.position, goalCenter, match.pitch);

    const desiredDirection = goalCenter.subtract(player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.50 + bodyQuality * 0.50
    );

    const base = (
      distanceBase * roleQuality * attrScore * (1 - pressure * 0.4) +
      angleBonus +
      attackingBonus
    ) * executionQuality;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "DISTANCE_BASE", value: distanceBase },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "ATTR_SCORE", value: attrScore },
      { code: "PRESSURE", value: -pressure },
      { code: "ANGLE_BONUS", value: angleBonus },
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

  private calculateAngleBonus(
    playerPos: Vector2,
    _goalCenter: Vector2,
    pitch: { width: number }
  ): number {
    const pitchCentreY = pitch.width / 2;
    const yDeviation = Math.abs(playerPos.y - pitchCentreY);
    const maxDeviation = pitch.width / 2;
    return Math.max(0, 8 * (1 - yDeviation / maxDeviation));
  }

  private getGoalCenter(
    pitch: {
      length: number;
      width: number;
      geometry: {
        leftGoal: { center: { x: number; y: number } };
        rightGoal: { center: { x: number; y: number } };
      };
    },
    attackingDirection: 1 | -1
  ): Vector2 {
    const goal = attackingDirection === 1
      ? pitch.geometry.rightGoal
      : pitch.geometry.leftGoal;
    return new Vector2(goal.center.x, goal.center.y);
  }

  private getFieldThird(
    pitchLength: number,
    position: Vector2,
    attackingDirection: 1 | -1
  ): FieldThird {
    const third = new FieldThirdResolver(pitchLength);
    return third.resolve(position, attackingDirection);
  }
}
