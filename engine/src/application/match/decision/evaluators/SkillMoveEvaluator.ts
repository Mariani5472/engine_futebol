import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";

/**
 * Evaluates skill moves (feints, step-overs, quick body shifts) in possession.
 *
 * SKILL_MOVE is a higher-risk dribbling variant. It should appear when the
 * player has enough technique/flair to beat pressure and when a direct pass or
 * shot is not clearly superior.
 */
export class SkillMoveEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);

    if (score.total < 18) return [];

    return [new Decision(DecisionType.SKILL_MOVE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const attrs = player.player.attributes;

    const dribbling = attrs.technical.dribbling / 20;
    const technique = attrs.technical.technique / 20;
    const flair = attrs.mental.flair / 20;
    const agility = attrs.physical.agility / 20;
    const decisions = attrs.mental.decisions / 20;
    const composure = attrs.mental.composure / 20;

    const isAttackingRole = PositionInfluenceCalculator.isAttackingRole(
      player.currentRole
    );

    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const attackingDirection = team.attackingDirection;

    const pressure = this.calculatePressure(context);
    const fieldAdvance = this.calculateFieldAdvance(
      player.position.x,
      match.pitch.length,
      attackingDirection
    );
    const spaceScore = this.calculateSpaceScore(context);

    const skillPotential =
      dribbling * 0.30 +
      technique * 0.25 +
      flair * 0.20 +
      agility * 0.15 +
      decisions * 0.05 +
      composure * 0.05;

    const roleBonus = isAttackingRole ? 10 : 3;
    const pressureBonus = pressure * 24;
    const fieldBonus = fieldAdvance * 14;
    const spaceBonus = spaceScore * 10;
    const riskPenalty = Math.max(0, 8 - composure * 8);

    const total = Math.max(
      0,
      skillPotential * 45 +
        roleBonus +
        pressureBonus +
        fieldBonus +
        spaceBonus -
        riskPenalty
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling * 30 },
      { code: "TECHNIQUE", value: technique * 25 },
      { code: "FLAIR", value: flair * 20 },
      { code: "AGILITY", value: agility * 15 },
      { code: "PRESSURE", value: pressure * 24 },
      { code: "FIELD_ADVANCE", value: fieldBonus },
      { code: "SPACE", value: spaceBonus },
      { code: "ROLE_BONUS", value: roleBonus },
    ]);
  }

  private calculatePressure(context: DecisionContext): number {
    const { player, match } = context;
    const opponents = match.home.players.includes(player)
      ? match.away.players
      : match.home.players;

    let pressure = 0;
    for (const opponent of opponents) {
      const distance = player.position.distanceTo(opponent.position);

      if (distance < 2) pressure += 0.55;
      else if (distance < 4) pressure += 0.25;
      else if (distance < 6) pressure += 0.1;
    }

    return Math.min(1, pressure);
  }

  private calculateFieldAdvance(
    playerX: number,
    pitchLength: number,
    attackingDirection: 1 | -1
  ): number {
    const pitchCentreX = pitchLength / 2;
    const attackingX =
      attackingDirection === 1 ? playerX - pitchCentreX : pitchCentreX - playerX;

    return Math.max(0, attackingX / pitchCentreX);
  }

  private calculateSpaceScore(context: DecisionContext): number {
    const { player, match } = context;
    const opponents = match.home.players.includes(player)
      ? match.away.players
      : match.home.players;

    const nearestOpponent = opponents.reduce(
      (nearest, opponent) =>
        Math.min(nearest, player.position.distanceTo(opponent.position)),
      Infinity
    );

    if (nearestOpponent >= 8) return 1;
    if (nearestOpponent >= 5) return 0.6;
    if (nearestOpponent >= 3) return 0.3;
    return 0;
  }
}
