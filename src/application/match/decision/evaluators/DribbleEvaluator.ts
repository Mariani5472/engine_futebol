import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

export class DribbleEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.DRIBBLE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const dribbling = attrs.technical.dribbling;
    const pace = attrs.physical.pace;
    const flair = attrs.mental.flair;

    // Count nearby opponents for pressure check.
    const opponentTeam = context.match.home.players.includes(context.player)
      ? context.match.away
      : context.match.home;

    let pressure = 0;
    for (const opp of opponentTeam.players) {
      if (context.player.position.distanceTo(opp.position) < 4) {
        pressure += 8;
      }
    }

    // Dribble is more appealing with high dribbling + pace, less so under pressure.
    const base = dribbling * 1.5 + pace * 0.5 + flair * 0.5 - pressure;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling },
      { code: "PACE", value: pace },
      { code: "FLAIR", value: flair },
      { code: "PRESSURE_PENALTY", value: -pressure }
    ]);
  }

}
