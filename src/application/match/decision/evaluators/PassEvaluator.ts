import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { PlayerMemory } from "../../awareness/memory/PlayerMemory";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { Vector2 } from "../../../../core/geometry/Vector2";
import { ActionReadiness } from "./ActionReadiness";

export class PassEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.2)) return [];

    const decisions: Decision[] = [];

    // Primary: use awareness memory (more accurate — includes noise/prediction).
    for (const teammate of context.awareness.teammates.values()) {
      const score = this.scorePassFromMemory(context, teammate);
      decisions.push(new Decision(DecisionType.PASS, score.total, teammate.playerId));
    }

    // Fallback: awareness is empty on the first tick (memory not yet seeded).
    if (decisions.length === 0) {
      const isHome = context.match.home.players.includes(context.player);
      const teammatesInState = isHome
        ? context.match.home.players
        : context.match.away.players;

      for (const teammate of teammatesInState) {
        if (teammate === context.player) continue;
        const score = this.scorePass(context, teammate.position, teammate.player.id, 1.0);
        decisions.push(new Decision(DecisionType.PASS, score.total, teammate.player.id));
      }
    }

    return decisions;
  }

  private scorePassFromMemory(context: DecisionContext, teammate: PlayerMemory): UtilityScore {
    return this.scorePass(context, teammate.estimatedPosition, teammate.playerId, teammate.certainty);
  }

  private scorePass(
    context: DecisionContext,
    teammatePosition: Vector2,
    _teammateId: string,
    certainty: number
  ): UtilityScore {
    const player = context.player.player;
    const attrs = player.attributes;

    const passing = attrs.technical.passing / 20;
    const vision = attrs.mental.vision / 20;
    const decisions = attrs.mental.decisions / 20;

    const roleQuality = PositionInfluenceCalculator.passingQuality(context.player.currentRole);

    const playerPosition = context.player.position;
    const distance = playerPosition.distanceTo(teammatePosition);

    const distanceScore = Math.max(0, 18 - distance * 0.55);

    const isHome = context.match.home.players.includes(context.player);
    const attackingDir = (isHome ? context.match.home : context.match.away).attackingDirection;
    const forwardProgress = (teammatePosition.x - playerPosition.x) * attackingDir;
    const progressBonus = Math.max(-15, Math.min(25, forwardProgress * 0.65));

    const certaintyBonus = certainty * 5;

    // A pass is not just a tactical decision: the player must physically be
    // able to prepare the body and execute it from the current posture.
    const desiredDirection = teammatePosition.subtract(playerPosition);
    const orientationQuality = ActionReadiness.orientationQuality(
      context.player.facingDirection,
      desiredDirection
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);

    const bodyExecutionQuality = Math.max(
      0.25,
      orientationQuality * 0.55 + bodyQuality * 0.45
    );

    const base = (
      vision * 12 +
      passing * 8 +
      decisions * 5 +
      distanceScore +
      progressBonus +
      certaintyBonus
    ) * roleQuality * bodyExecutionQuality;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "PASSING", value: passing * 8 },
      { code: "DISTANCE", value: distanceScore },
      { code: "PROGRESS", value: progressBonus },
      { code: "ROLE_QUALITY", value: roleQuality },
      { code: "BODY_QUALITY", value: bodyQuality },
      { code: "ORIENTATION", value: orientationQuality },
      { code: "EXECUTION_QUALITY", value: bodyExecutionQuality },
    ]);
  }
}
