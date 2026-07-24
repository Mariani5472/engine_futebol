import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";

export class DribbleEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.DRIBBLE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const dribbling = attrs.technical.dribbling / 20;
    const pace = attrs.physical.pace / 20;
    const flair = attrs.mental.flair / 20;
    const agility = attrs.physical.agility / 20;

    // Attacking roles dribble more effectively (FM26: wingers/AMs have dribbling as KEY).
    const isAttacking = PositionInfluenceCalculator.isAttackingRole(context.player.currentRole);

    // Compute how far into the attacking half the player is.
    const isHome = context.match.home.players.includes(context.player);
    const attackingDir = isHome
      ? context.match.home.attackingDirection
      : context.match.away.attackingDirection;
    const pitchLength = context.match.pitch.length;
    const pitchCentreX = pitchLength / 2;

    // forwardX: progress from centre toward the opponent goal (0 at centre, 1 at goal).
    const playerX = context.player.position.x;
    const attackingX = attackingDir === 1 ? playerX - pitchCentreX : pitchCentreX - playerX;
    const fieldAdvanceFactor = Math.max(0, attackingX / pitchCentreX); // 0 to 1

    // Role bonus: attackers strongly prefer dribbling forward, especially when advanced.
    const roleBonus = isAttacking
      ? 18 + fieldAdvanceFactor * 15  // 18-33 for attacking players
      : 4 + fieldAdvanceFactor * 8;   // 4-12 for defensive/mid players

    // Pressure from nearby opponents — dribbling into a crowd is risky.
    const oppTeam = isHome ? context.match.away.players : context.match.home.players;
    let pressureCount = 0;
    for (const opp of oppTeam) {
      if (context.player.position.distanceTo(opp.position) < 4) {
        pressureCount++;
      }
    }
    const pressure = pressureCount * 7;

    const base = (dribbling * 20 + pace * 8 + flair * 6 + agility * 4) + roleBonus - pressure;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling * 20 },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "FIELD_ADVANCE", value: fieldAdvanceFactor },
      { code: "PRESSURE_PENALTY", value: -pressure }
    ]);
  }
}
