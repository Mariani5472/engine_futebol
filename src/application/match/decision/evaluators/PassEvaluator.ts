import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { PlayerMemory } from "../../awareness/memory/PlayerMemory";
import { UtilityScore } from "../UtilityScore";

export class PassEvaluator
  implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {

    const decisions: Decision[] = [];

    for (const teammate of context.awareness.teammates.values()) {

      const score = this.calculateUtility(
        context,
        teammate
      );

      decisions.push(
        new Decision(
          DecisionType.PASS,
          score.total,
          teammate.playerId
        )
      );
    }

    return decisions;
  }

  private calculateUtility(
    context: DecisionContext,
    teammate: PlayerMemory
  ): UtilityScore {

    const player = context.player.player;
    const vision = player.attributes
      .mental
      .vision;

    const teammatePosition = teammate.estimatedPosition;
    const playerPosition = context.player.position;

    const distance = playerPosition.distanceTo(teammatePosition);

    const distanceUtility = Math.max(0, 20 - distance);

    const base = vision * 2 + distanceUtility;

    return new UtilityScore(
      base,
      0,
      0,
      0,
      [
        {
          code: "VISION",
          value: vision * 2
        },
        {
          code: "PASS_DISTANCE",
          value: distanceUtility
        }
      ]
    );
  }
}