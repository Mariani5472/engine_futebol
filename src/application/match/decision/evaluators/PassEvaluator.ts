import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { PlayerMemory } from "../../awareness/memory/PlayerMemory";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { Vector2 } from "../../../../core/geometry/Vector2";

export class PassEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    const decisions: Decision[] = [];

    // Primary: use awareness memory (more accurate — includes noise/prediction).
    for (const teammate of context.awareness.teammates.values()) {
      const score = this.scorePassFromMemory(context, teammate);
      decisions.push(new Decision(DecisionType.PASS, score.total, teammate.playerId));
    }

    // Fallback: awareness is empty on the first tick (memory not yet seeded).
    // Use actual match state to find visible teammates.
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

    // Position influence: midfielders pass better.
    const roleQuality = PositionInfluenceCalculator.passingQuality(context.player.currentRole);

    const playerPosition = context.player.position;
    const distance = playerPosition.distanceTo(teammatePosition);

    // Short passes are safer and generally preferable.
    const distanceScore = Math.max(0, 20 - distance * 0.6);

    // Progress bonus (UNCLAMPED): forward passes earn a bonus; backward passes
    // incur a penalty. This strongly discourages recycling backward.
    const isHome = context.match.home.players.includes(context.player);
    const attackingDir = (isHome ? context.match.home : context.match.away).attackingDirection;
    const forwardProgress = (teammatePosition.x - playerPosition.x) * attackingDir;
    // Scale: +1m forward = +0.8, -1m backward = -0.8. Cap at ±20.
    const progressBonus = Math.max(-20, Math.min(20, forwardProgress * 0.8));

    // Certainty: less certain about teammate position = riskier pass.
    const certaintyBonus = certainty * 5;

    const base = (
      vision * 12 +
      passing * 8 +
      decisions * 5 +
      distanceScore +
      progressBonus +
      certaintyBonus
    ) * roleQuality;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "PASSING", value: passing * 8 },
      { code: "DISTANCE", value: distanceScore },
      { code: "PROGRESS", value: progressBonus },
      { code: "ROLE_QUALITY", value: roleQuality }
    ]);
  }
}
