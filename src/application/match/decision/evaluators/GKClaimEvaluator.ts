import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * GK_CLAIM evaluates goalkeeper collection of loose or aerial balls.
 */
export class GKClaimEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (player.hasBall) return [];
    if (!this.isGoalkeeper(player.currentRole)) return [];
    if (match.ball.state !== BallState.IN_FLIGHT && match.ball.state !== BallState.FREE) return [];

    const score = this.calculateUtility(context);
    if (score.total < 14) return [];

    return [new Decision(DecisionType.GK_CLAIM, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;

    const distanceToBall = player.position.distanceTo(match.ball.position);
    const ballHeight = match.ball.height;
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const composure = player.player.attributes.mental.composure / 20;
    const positioning = player.player.attributes.mental.positioning / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const jumpingReach = player.player.attributes.physical.jumpingReach / 20;

    const distanceScore = Math.max(0, 22 - distanceToBall * 5.5);
    const heightScore = ballHeight > 1 ? 10 : 4;
    const jumpingScore = jumpingReach * 12;
    const anticipationScore = anticipation * 12;
    const composureScore = composure * 8;
    const positioningScore = positioning * 6;
    const decisionsScore = decisions * 6;

    const total = Math.max(
      0,
      distanceScore + heightScore + jumpingScore + anticipationScore + composureScore + positioningScore + decisionsScore
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "DISTANCE", value: distanceScore },
      { code: "HEIGHT", value: heightScore },
      { code: "JUMPING", value: jumpingScore },
      { code: "ANTICIPATION", value: anticipationScore },
      { code: "COMPOSURE", value: composureScore },
      { code: "POSITIONING", value: positioningScore },
      { code: "DECISIONS", value: decisionsScore },
    ]);
  }

  private isGoalkeeper(role: unknown): boolean {
    const value = String(role).toUpperCase();
    return value.includes("GK") || value.includes("GOALKEEPER") || value.includes("KEEPER");
  }
}
