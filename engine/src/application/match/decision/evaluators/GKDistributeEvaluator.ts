import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * GK_DISTRIBUTE evaluates goalkeeper distribution after claiming the ball.
 */
export class GKDistributeEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player } = context;
    if (!player.hasBall) return [];

    if (!this.isGoalkeeper(player.currentRole)) return [];

    const score = this.calculateUtility(context);
    if (score.total < 12) return [];

    return [new Decision(DecisionType.GK_DISTRIBUTE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const teammates = match.home.players.includes(player)
      ? match.home.players
      : match.away.players;

    const passing = player.player.attributes.technical.passing / 20;
    const vision = player.player.attributes.mental.vision / 20;
    const composure = player.player.attributes.mental.composure / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const kicking = player.player.attributes.technical.kicking / 20;

    const openTeammateBonus = this.countOpenTeammates(player, teammates) * 2.2;
    const calmBonus = Math.max(0, 10 - player.fatigue / 10);
    const total = Math.max(
      0,
      passing * 18 + vision * 14 + composure * 12 + decisions * 10 + kicking * 8 + openTeammateBonus + calmBonus
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "PASSING", value: passing * 18 },
      { code: "VISION", value: vision * 14 },
      { code: "COMPOSURE", value: composure * 12 },
      { code: "DECISIONS", value: decisions * 10 },
      { code: "KICKING", value: kicking * 8 },
      { code: "OPEN_TEAMMATES", value: openTeammateBonus },
    ]);
  }

  private countOpenTeammates(player: DecisionContext["player"], teammates: Array<DecisionContext["player"]>): number {
    let count = 0;
    for (const teammate of teammates) {
      if (teammate === player) continue;
      if (player.position.distanceTo(teammate.position) < 35) count++;
    }
    return count;
  }

  private isGoalkeeper(role: unknown): boolean {
    const value = String(role).toUpperCase();
    return value.includes("GK") || value.includes("GOALKEEPER") || value.includes("KEEPER");
  }
}
