import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * SET_PIECE is a controlled possession choice used to slow the play and prepare
 * a structured restart-like action when the ball is effectively static and the
 * team has a stable setup.
 */
export class SetPieceEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (!player.hasBall) return [];
    if (match.ball.state !== BallState.CONTROLLED) return [];
    if (match.ball.velocity.magnitude() > 0.25) return [];

    const score = this.calculateUtility(context);
    if (score.total < 14) return [];

    return [new Decision(DecisionType.SET_PIECE, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      const distance = player.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    const vision = player.player.attributes.mental.vision / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const composure = player.player.attributes.mental.composure / 20;
    const teamwork = player.player.attributes.mental.teamwork / 20;
    const passing = player.player.attributes.technical.passing / 20;

    const shapeBonus = team.players.length >= 8 ? 6 : 2;
    const pressurePenalty = Number.isFinite(nearestOpponentDistance)
      ? Math.max(0, 10 - nearestOpponentDistance * 1.8)
      : 0;
    const calmBallBonus = Math.max(0, 8 - match.ball.velocity.magnitude() * 20);
    const roleBonus = this.calculateRoleBonus(player);

    const total = Math.max(
      0,
      vision * 14 +
        decisions * 10 +
        composure * 10 +
        teamwork * 6 +
        passing * 8 +
        shapeBonus +
        calmBallBonus +
        roleBonus -
        pressurePenalty
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "VISION", value: vision * 14 },
      { code: "DECISIONS", value: decisions * 10 },
      { code: "COMPOSURE", value: composure * 10 },
      { code: "TEAMWORK", value: teamwork * 6 },
      { code: "PASSING", value: passing * 8 },
      { code: "SHAPE", value: shapeBonus },
      { code: "CALM_BALL", value: calmBallBonus },
      { code: "ROLE_BONUS", value: roleBonus },
    ]);
  }

  private calculateRoleBonus(player: DecisionContext["player"]): number {
    const role = String(player.currentRole).toUpperCase();
    if (role.includes("DM") || role.includes("CM")) return 8;
    if (role.includes("CB") || role.includes("GK")) return 6;
    if (role.includes("AM") || role.includes("ST")) return 4;
    return 3;
  }
}
