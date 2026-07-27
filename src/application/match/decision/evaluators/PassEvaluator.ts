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
      if (score.total <= 0) continue;
      decisions.push(
        new Decision(
          DecisionType.PASS,
          score.total,
          lane.targetId,
          score.reasons,
          score.components,
        ),
      );
    }

    return decisions;
  }

  private scoreLane(context: DecisionContext, lane: PassingLane): UtilityScore {
    const player = context.player.player;
    const attrs = player.attributes;
    const world = context.world;

    const passing = (attrs.technical.passing ?? 10) / 20;
    const vision = (attrs.mental.vision ?? 10) / 20;
    const decisionsAttr = (attrs.mental.decisions ?? 10) / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(
      context.player.currentRole,
    );

    const distanceScore = Math.max(0, 22 - lane.distance * 0.45);
    // Progressive passes are the primary antidote to dribble loops.
    const progressBonus = Math.max(-8, Math.min(42, lane.forwardProgress * 1.15));
    const certaintyBonus = lane.certainty * 6;
    const clearanceBonus = lane.clear ? 10 : -8;

    const desiredDirection = lane.targetPosition.subtract(context.player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);

    const pressure = world.pressure;

    // Under pressure, a clear progressive pass is highly attractive.
    let pressureRelief = 0;
    if (pressure > 0.35) {
      pressureRelief = pressure * (lane.clear ? 28 : 10);
      if (lane.forwardProgress > 5) pressureRelief += 12;
    }

    // Lateral / backward under no pressure is only a modest option.
    const backwardPenalty =
      lane.forwardProgress < -3 && pressure < 0.25 ? -14 : 0;

    if (
      world.nearestOpponent?.isTackling &&
      world.nearestOpponentDistance <= 4.5
    ) {
      pressureRelief += lane.clear ? 8 : -6;
    }

    const bodyExecutionQuality = Math.max(
      0.25,
      orientationQuality * 0.55 + bodyQuality * 0.45,
    );

    const technique = vision * 14 + passing * 12 + decisionsAttr * 6;
    const space =
      distanceScore +
      progressBonus +
      certaintyBonus +
      clearanceBonus +
      backwardPenalty;
    const pressureComp = pressureRelief;

    const raw = technique + space + pressureComp;
    const scaled = Math.max(0, raw * roleQuality * bodyExecutionQuality);
    const scale = raw !== 0 ? scaled / raw : 0;

    // Floor boost so progressive clear lanes compete with residual dribble scores.
    const progressiveFloor =
      lane.forwardProgress > 8 && lane.clear ? 18 * bodyExecutionQuality : 0;

    return UtilityScore.fromComponents({
      SPACE: space * scale + progressiveFloor * 0.4,
      TECHNIQUE: technique * scale,
      PRESSURE: pressureComp * scale,
      ROLE: roleQuality * 12 * bodyExecutionQuality * 0.35,
      BODY: bodyQuality * 8 * roleQuality * 0.3,
      TACTICAL: progressiveFloor * 0.6,
    });
  }
}
