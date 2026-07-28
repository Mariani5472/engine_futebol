import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * FAKE represents a deceptive action with the ball: body feint, stop-start,
 * and other false cues to shift the defender before the real move.
 */
export class FakeEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player } = context;
    if (!player.hasBall) return [];

    const score = this.calculateUtility(context);
    if (score.total < 16) return [];

    return [new Decision(DecisionType.FAKE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const opponents = isHome ? match.away.players : match.home.players;

    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      const distance = player.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    const dribbling = player.player.attributes.technical.dribbling / 20;
    const technique = player.player.attributes.technical.technique / 20;
    const flair = player.player.attributes.mental.flair / 20;
    const composure = player.player.attributes.mental.composure / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const agility = player.player.attributes.physical.agility / 20;

    const pressureBonus = Number.isFinite(nearestOpponentDistance)
      ? Math.max(0, 16 - nearestOpponentDistance * 2.2)
      : 0;
    const laneBonus = Math.max(0, 10 - Math.abs(player.position.y - match.pitch.width / 2) * 0.15);
    const roleBonus = this.calculateRoleBonus(player);
    const fatigueModifier = Math.max(0.7, 1 - player.fatigue / 180);

    const total = Math.max(
      0,
      (
        dribbling * 18 +
        technique * 16 +
        flair * 14 +
        composure * 8 +
        decisions * 6 +
        agility * 8 +
        pressureBonus +
        laneBonus +
        roleBonus
      ) * fatigueModifier
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling * 18 },
      { code: "TECHNIQUE", value: technique * 16 },
      { code: "FLAIR", value: flair * 14 },
      { code: "PRESSURE", value: pressureBonus },
      { code: "ROLE_BONUS", value: roleBonus },
    ]);
  }

  private calculateRoleBonus(player: DecisionContext["player"]): number {
    const role = String(player.currentRole).toUpperCase();
    if (role.includes("ST") || role.includes("AM")) return 8;
    if (role.includes("WING") || role.includes("WB")) return 7;
    if (role.includes("CM")) return 5;
    return 3;
  }
}
