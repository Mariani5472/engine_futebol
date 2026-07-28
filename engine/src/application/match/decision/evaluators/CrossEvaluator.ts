import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { SupportPlayer } from "../../awareness/WorldAwareness";
import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Evaluates crosses from wide attacking areas.
 *
 * Gate-keeping (advanced + wide) comes from WorldAwareness.crossOpportunity.
 * Target scoring uses pre-built supportPlayers.
 */
export class CrossEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, world } = context;

    if (!player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.3)) return [];

    // crossOpportunity already encodes advanced-wide + central target presence.
    if (world.crossOpportunity < 0.25) return [];

    const decisions: Decision[] = [];

    for (const support of world.supportPlayers) {
      const targetScore = this.scoreTarget(context, support);
      if (targetScore.total <= 0) continue;

      decisions.push(
        new Decision(
          DecisionType.CROSS,
          targetScore.total * (0.7 + world.crossOpportunity * 0.5),
          support.playerId,
        ),
      );
    }

    return decisions;
  }

  private scoreTarget(
    context: DecisionContext,
    support: SupportPlayer,
  ): UtilityScore {
    const { player, world, match } = context;
    const attrs = player.player.attributes;

    if (support.forwardProgress < -5) {
      return new UtilityScore(0, 0, 0, 0, []);
    }

    if (support.distance > 45) {
      return new UtilityScore(0, 0, 0, 0, []);
    }

    const targetForwardFromGoal =
      world.attackingDirection === 1
        ? match.pitch.length - support.position.x
        : support.position.x;
    const isNearGoal = targetForwardFromGoal < 22;
    const targetLateralDistance = Math.abs(
      support.position.y - match.pitch.width / 2,
    );

    const crossing = attrs.technical.crossing / 20;
    const technique = attrs.technical.technique / 20;
    const vision = attrs.mental.vision / 20;
    const decisions = attrs.mental.decisions / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(
      player.currentRole,
    );

    const distanceScore = Math.max(0, 18 - support.distance * 0.35);
    const targetZoneBonus = isNearGoal ? 18 : 0;
    const centralTargetBonus = Math.max(0, 10 - targetLateralDistance * 0.18);

    const pressure = world.pressure;

    const desiredDirection = new Vector2(
      support.position.x - player.position.x,
      support.position.y - player.position.y,
    );
    const orientationQuality = ActionReadiness.orientationQuality(
      player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.55 + bodyQuality * 0.45,
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
      { code: "CROSS_OPPORTUNITY", value: world.crossOpportunity },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "BODY_QUALITY", value: bodyQuality },
      { code: "ORIENTATION", value: orientationQuality },
      { code: "EXECUTION_QUALITY", value: executionQuality },
    ]);
  }
}
