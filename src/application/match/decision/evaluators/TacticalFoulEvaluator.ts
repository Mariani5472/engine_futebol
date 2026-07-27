import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * TACTICAL_FOUL is a deliberate foul to stop a dangerous transition.
 */
export class TacticalFoulEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    if (player.hasBall) return [];

    const ballOwner = match.ball.owner;
    if (!ballOwner) return [];

    const isHome = match.home.players.includes(player);
    const ownerIsOpponent = isHome
      ? match.away.players.includes(ballOwner)
      : match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const score = this.calculateUtility(context, ballOwner.position.distanceTo(player.position));
    if (score.total < 18) return [];

    return [new Decision(DecisionType.TACTICAL_FOUL, score.total)];
  }

  private calculateUtility(context: DecisionContext, distance: number): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const defendingTeam = isHome ? match.home : match.away;

    const aggression = player.player.attributes.mental.aggression / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const positioning = player.player.attributes.mental.positioning / 20;
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const stamina = player.stamina / 100;

    const proximityScore = Math.max(0, 18 - distance * 4.2);
    const ownGoalUrgency = this.calculateOwnGoalUrgency(
      player.position.x,
      defendingTeam.attackingDirection,
      match.pitch.length
    );
    const counterAttackThreat = this.calculateCounterAttackThreat(match, player);
    const tacticalAwareness = positioning * 10 + anticipation * 8 + decisions * 6;
    const foulWillingness = aggression * 16;
    const staminaModifier = Math.max(0.65, 0.5 + stamina * 0.5);

    const total = Math.max(
      0,
      (proximityScore + ownGoalUrgency + counterAttackThreat + tacticalAwareness + foulWillingness) *
        staminaModifier
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "PROXIMITY", value: proximityScore },
      { code: "OWN_GOAL_URGENCY", value: ownGoalUrgency },
      { code: "COUNTER_THREAT", value: counterAttackThreat },
      { code: "TACTICAL_AWARENESS", value: tacticalAwareness },
      { code: "FOUL_WILLINGNESS", value: foulWillingness },
    ]);
  }

  private calculateOwnGoalUrgency(
    x: number,
    attackingDirection: 1 | -1,
    pitchLength: number
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(x - ownGoalX);

    if (distanceToOwnGoal < 18) return 14;
    if (distanceToOwnGoal < 30) return 10;
    if (distanceToOwnGoal < 42) return 6;
    return 2;
  }

  private calculateCounterAttackThreat(match: DecisionContext["match"], player: DecisionContext["player"]): number {
    if (!match.ball.owner) return 0;

    const opponentGoalSide = match.home.players.includes(player)
      ? match.away
      : match.home;

    const ballOwner = match.ball.owner;
    const distanceToGoalSide = Math.abs(ballOwner.position.x - (opponentGoalSide.attackingDirection === 1 ? match.pitch.length : 0));

    if (distanceToGoalSide < 25) return 12;
    if (distanceToGoalSide < 40) return 8;
    if (distanceToGoalSide < 55) return 4;
    return 1;
  }
}
