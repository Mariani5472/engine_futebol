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

    const lanes = context.world.passingLanes;
    if (lanes.length === 0) return [];

    const bestForward = Math.max(...lanes.map((l) => l.forwardProgress));
    const hasProgressiveOption = bestForward >= 6;

    const team = context.match.home.players.includes(context.player)
      ? context.match.home
      : context.match.away;
    const holdProgressive = team.inProgressiveHold(context.match.currentSecond);

    const decisions: Decision[] = [];

    for (const lane of lanes) {
      const score = this.scoreLane(
        context,
        lane,
        hasProgressiveOption,
        bestForward,
        holdProgressive,
      );
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

  private scoreLane(
    context: DecisionContext,
    lane: PassingLane,
    hasProgressiveOption: boolean,
    bestForward: number,
    holdProgressive: boolean,
  ): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;

    const passing = (attrs.technical.passing ?? 10) / 20;
    const vision = (attrs.mental.vision ?? 10) / 20;
    const decisionsAttr = (attrs.mental.decisions ?? 10) / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(
      context.player.currentRole,
    );

    // Very short passes inside a crowd perpetuate local pinball. Reward useful
    // separation (roughly 8-24m) and strongly discourage sub-4m recycling.
    const distanceScore = lane.distance < 4
      ? -22 + lane.distance * 2
      : lane.distance < 8
        ? (lane.distance - 4) * 4
        : lane.distance <= 24
          ? 18
          : Math.max(0, 18 - (lane.distance - 24) * .65);
    const nearbyOpponents = world.opponents.filter(opponent => opponent.position.distanceTo(lane.targetPosition) < 3).length;
    const nearbyTeammates = world.teammates.filter(teammate =>
      teammate.player.id !== lane.targetId && teammate.position.distanceTo(lane.targetPosition) < 2,
    ).length;
    const receiverCongestion = nearbyOpponents * -8 + nearbyTeammates * -4;
    const progressBonus = Math.max(-20, Math.min(55, lane.forwardProgress * 1.6));
    const certaintyBonus = lane.certainty * 6;
    const clearanceBonus = lane.clear ? 12 : -6;

    const desiredDirection = lane.targetPosition.subtract(context.player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const pressure = world.pressure;

    let pressureRelief = 0;
    if (pressure > 0.3) {
      pressureRelief = pressure * (lane.clear ? 24 : 8);
      if (lane.forwardProgress > 4) pressureRelief += 14;
    }

    let antiStagnation = 0;
    if (hasProgressiveOption || holdProgressive) {
      if (lane.forwardProgress < 0) {
        antiStagnation = holdProgressive ? -45 : -35;
      } else if (lane.forwardProgress < 3) {
        antiStagnation = holdProgressive ? -30 : -22;
      } else if (lane.forwardProgress < bestForward * 0.5) {
        antiStagnation = -10;
      }
    } else if (lane.forwardProgress < -2 && pressure < 0.3) {
      antiStagnation = -18;
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
      receiverCongestion +
      antiStagnation;

    const progressiveFloor =
      lane.forwardProgress >= 8 && lane.clear
        ? 28 * bodyExecutionQuality
        : lane.forwardProgress >= 4
          ? 12 * bodyExecutionQuality
          : 0;

    const raw = technique + space + pressureRelief + progressiveFloor;
    const phaseRisk = this.phaseRiskAdjustment(teamPhase(context), lane);
    const adjustedRaw = raw + phaseRisk;
    const scaled = Math.max(0, adjustedRaw * roleQuality * bodyExecutionQuality);
    const scale = adjustedRaw !== 0 ? scaled / adjustedRaw : 0;

    return UtilityScore.fromComponents({
      SPACE: space * scale,
      TECHNIQUE: technique * scale,
      PRESSURE: pressureRelief * scale,
      ROLE: roleQuality * 12 * bodyExecutionQuality * 0.35,
      BODY: bodyQuality * 8 * roleQuality * 0.3,
      TACTICAL: progressiveFloor * scale + Math.max(0, lane.forwardProgress) * 0.4 + phaseRisk * scale,
    });
  }

  private phaseRiskAdjustment(
    phase: "DEFENSIVE_BLOCK" | "DEFENSIVE_TRANSITION" | "BUILD_UP" | "PROGRESSION" | "FINAL_THIRD" | "ATTACKING_TRANSITION" | "COUNTER_ATTACK" | "SET_PIECE",
    lane: PassingLane,
  ): number {
    if (phase === "COUNTER_ATTACK" || phase === "ATTACKING_TRANSITION") {
      return Math.max(-4, Math.min(16, lane.forwardProgress * .45)) + (lane.clear ? 3 : -4);
    }
    if (phase === "FINAL_THIRD") return Math.max(-3, Math.min(10, lane.forwardProgress * .3));
    if (phase === "BUILD_UP") return lane.clear ? 3 : -8;
    return 0;
  }
}

function teamPhase(context: DecisionContext) {
  return (context.match.home.players.includes(context.player) ? context.match.home : context.match.away).collectivePhase;
}
