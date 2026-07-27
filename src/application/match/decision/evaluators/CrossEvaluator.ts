import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Evaluates crosses from wide attacking areas.
 *
 * A cross should not compete with PASS everywhere on the pitch. It becomes a
 * candidate only when the ball carrier is in an advanced wide channel and a
 * teammate offers a plausible attacking target.
 */
export class CrossEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (!player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.3)) return [];

    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const attackingDirection = team.attackingDirection;

    const forwardDistance = (match.pitch.length - player.position.x) * attackingDirection;
    const lateralDistance = Math.abs(player.position.y - match.pitch.width / 2);

    if (forwardDistance < 18) return [];
    if (lateralDistance < match.pitch.width * 0.18) return [];

    const teammates = team.players.filter((teammate) => teammate !== player);
    const decisions: Decision[] = [];

    for (const teammate of teammates) {
      const targetScore = this.scoreTarget(context, teammate.position, attackingDirection);
      if (targetScore.total <= 0) continue;

      decisions.push(
        new Decision(
          DecisionType.CROSS,
          targetScore.total,
          teammate.player.id
        )
      );
    }

    return decisions;
  }

  private scoreTarget(
    context: DecisionContext,
    targetPosition: { x: number; y: number },
    attackingDirection: 1 | -1
  ): UtilityScore {
    const { player, match } = context;
    const attrs = player.player.attributes;

    const forwardTargetDistance = (targetPosition.x - player.position.x) * attackingDirection;
    if (forwardTargetDistance < -5) return new UtilityScore(0, 0, 0, 0, []);

    const distance = player.position.distanceTo(
      new Vector2(targetPosition.x, targetPosition.y)
    );
    if (distance > 45) return new UtilityScore(0, 0, 0, 0, []);

    const targetForwardDistance = (targetPosition.x - match.pitch.length) * attackingDirection;
    const isNearGoal = targetForwardDistance > -22;
    const targetLateralDistance = Math.abs(targetPosition.y - match.pitch.width / 2);

    const crossing = attrs.technical.crossing / 20;
    const technique = attrs.technical.technique / 20;
    const vision = attrs.mental.vision / 20;
    const decisions = attrs.mental.decisions / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(
      player.currentRole
    );

    const distanceScore = Math.max(0, 18 - distance * 0.35);
    const targetZoneBonus = isNearGoal ? 18 : 0;
    const centralTargetBonus = Math.max(
      0,
      10 - targetLateralDistance * 0.18
    );

    const pressure = this.calculatePressure(context);

    const desiredDirection = new Vector2(
      targetPosition.x - player.position.x,
      targetPosition.y - player.position.y
    );
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.55 + bodyQuality * 0.45
    );

    const base = (
      crossing * 28 +
      technique * 10 +
      vision * 8 +
      decisions * 6 +
      distanceScore +
      targetZoneBonus +
      centralTargetBonus -
      pressure * 12
    ) * roleQuality * executionQuality;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "CROSSING", value: crossing * 28 },
      { code: "TECHNIQUE", value: technique * 10 },
      { code: "VISION", value: vision * 8 },
      { code: "TARGET_DISTANCE", value: distanceScore },
      { code: "TARGET_ZONE", value: targetZoneBonus },
      { code: "PRESSURE", value: -pressure * 12 },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "BODY_QUALITY", value: bodyQuality },
      { code: "ORIENTATION", value: orientationQuality },
      { code: "EXECUTION_QUALITY", value: executionQuality },
    ]);
  }

  private calculatePressure(context: DecisionContext): number {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const opponents = isHome ? match.away.players : match.home.players;

    let pressureCount = 0;
    for (const opponent of opponents) {
      if (player.position.distanceTo(opponent.position) < 3) {
        pressureCount++;
      }
    }

    return Math.min(1, pressureCount * 0.35);
  }
}
