import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { PassingLane } from "../../awareness/WorldAwareness";
import { ActionReadiness } from "./ActionReadiness";

export class PassEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.2)) return [];

    const decisions: Decision[] = [];

    for (const lane of context.world.passingLanes) {
      const score = this.scoreLane(context, lane);
      decisions.push(new Decision(DecisionType.PASS, score.total, lane.targetId));
    }

    return decisions;
  }

  private scoreLane(context: DecisionContext, lane: PassingLane): UtilityScore {
    const player = context.player.player;
    const attrs = player.attributes;
    const world = context.world;

    const passing = attrs.technical.passing / 20;
    const vision = attrs.mental.vision / 20;
    const decisions = attrs.mental.decisions / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(
      context.player.currentRole,
    );

    const distanceScore = Math.max(0, 18 - lane.distance * 0.55);
    const progressBonus = Math.max(-15, Math.min(25, lane.forwardProgress * 0.65));
    const certaintyBonus = lane.certainty * 5;
    const clearanceBonus = lane.clear ? 6 : -10;

    const desiredDirection = lane.targetPosition.subtract(context.player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);

    const pressure = world.pressure;
    let pressurePenalty = pressure * 12;

    if (
      world.nearestOpponent?.isTackling &&
      world.nearestOpponentDistance <= 4.5
    ) {
      pressurePenalty += 14;
    }

    if (context.player.activeAction?.phase === "PREPARING") {
      pressurePenalty += 5;
    }

    const bodyExecutionQuality = Math.max(
      0.25,
      orientationQuality * 0.55 + bodyQuality * 0.45,
    );

    const base = (
      vision * 12 +
      passing * 8 +
      decisions * 5 +
      distanceScore +
      progressBonus +
      certaintyBonus +
      clearanceBonus -
      pressurePenalty
    ) * roleQuality * bodyExecutionQuality;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "PASSING", value: passing * 8 },
      { code: "DISTANCE", value: distanceScore },
      { code: "PROGRESS", value: progressBonus },
      { code: "LANE_CLEAR", value: clearanceBonus },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "BODY_QUALITY", value: bodyQuality },
      { code: "ORIENTATION", value: orientationQuality },
      { code: "PRESSURE", value: pressure },
      { code: "PRESSURE_PENALTY", value: -pressurePenalty },
      { code: "EXECUTION_QUALITY", value: bodyExecutionQuality },
    ]);
  }
}
