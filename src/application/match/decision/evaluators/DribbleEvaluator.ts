import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { ActionReadiness } from "./ActionReadiness";

export class DribbleEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];

    const options = [
      this.createDribbleDecision(context),
      this.createHoldBallDecision(context),
      this.createSkillMoveDecision(context),
    ];

    return options.filter((decision) => decision.score > 0);
  }

  private createDribbleDecision(context: DecisionContext): Decision {
    const score = this.calculateDribbleUtility(context);
    return new Decision(DecisionType.DRIBBLE, score.total);
  }

  private createHoldBallDecision(context: DecisionContext): Decision {
    const score = this.calculateHoldBallUtility(context);
    return new Decision(DecisionType.HOLD_BALL, score.total);
  }

  private createSkillMoveDecision(context: DecisionContext): Decision {
    const score = this.calculateSkillMoveUtility(context);
    return new Decision(DecisionType.SKILL_MOVE, score.total);
  }

  private calculateDribbleUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const dribbling = attrs.technical.dribbling / 20;
    const pace = attrs.physical.pace / 20;
    const flair = attrs.mental.flair / 20;
    const agility = attrs.physical.agility / 20;

    const isHome = context.match.home.players.includes(context.player);
    const attackingDir = isHome
      ? context.match.home.attackingDirection
      : context.match.away.attackingDirection;
    const pitchCentreX = context.match.pitch.length / 2;
    const playerX = context.player.position.x;
    const attackingX = attackingDir === 1 ? playerX - pitchCentreX : pitchCentreX - playerX;
    const fieldAdvanceFactor = Math.max(0, Math.min(1, attackingX / pitchCentreX));
    const isAttacking = PositionInfluenceCalculator.isAttackingRole(context.player.currentRole);
    const roleBonus = isAttacking ? 18 + fieldAdvanceFactor * 15 : 4 + fieldAdvanceFactor * 8;

    const opponents = isHome ? context.match.away.players : context.match.home.players;
    const pressure = ActionReadiness.opponentPressure(context.player, opponents);
    const nearestOpponentDistance = this.nearestOpponentDistance(context, opponents);

    const pressurePenalty = pressure * 18;
    const escapeBonus = this.calculateEscapeBonus(dribbling, pace, agility, nearestOpponentDistance);

    const total = (
      dribbling * 20 +
      pace * 8 +
      flair * 6 +
      agility * 4 +
      roleBonus +
      escapeBonus -
      pressurePenalty
    );

    return new UtilityScore(Math.max(0, total), 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling * 20 },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "FIELD_ADVANCE", value: fieldAdvanceFactor },
      { code: "PRESSURE", value: pressure },
      { code: "ESCAPE_BONUS", value: escapeBonus },
      { code: "PRESSURE_PENALTY", value: -pressurePenalty },
    ]);
  }

  private calculateHoldBallUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const composure = attrs.mental.composure / 20;
    const strength = attrs.physical.strength / 20;
    const balance = this.normalize(context.player.balance);
    const stability = this.normalize(context.player.stability);

    const isHome = context.match.home.players.includes(context.player);
    const opponents = isHome ? context.match.away.players : context.match.home.players;
    const pressure = ActionReadiness.opponentPressure(context.player, opponents);

    const total = composure * 12 + strength * 10 + balance * 8 + stability * 8 + pressure * 18;

    return new UtilityScore(total, 0, 0, 0, [
      { code: "COMPOSURE", value: composure * 12 },
      { code: "STRENGTH", value: strength * 10 },
      { code: "BALANCE", value: balance * 8 },
      { code: "STABILITY", value: stability * 8 },
      { code: "PRESSURE_RESPONSE", value: pressure * 18 },
    ]);
  }

  private calculateSkillMoveUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const dribbling = attrs.technical.dribbling / 20;
    const flair = attrs.mental.flair / 20;
    const agility = attrs.physical.agility / 20;
    const technique = attrs.technical.technique / 20;

    const isHome = context.match.home.players.includes(context.player);
    const opponents = isHome ? context.match.away.players : context.match.home.players;
    const pressure = ActionReadiness.opponentPressure(context.player, opponents);
    const nearestOpponentDistance = this.nearestOpponentDistance(context, opponents);

    const pressureWindow = Math.max(0, Math.min(1, 1 - Math.abs(pressure - 0.55) / 0.55));
    const spacePenalty = nearestOpponentDistance < 1.2 ? 18 : 0;

    const total = (
      dribbling * 18 +
      flair * 16 +
      agility * 10 +
      technique * 8 +
      pressureWindow * 14 -
      spacePenalty
    );

    return new UtilityScore(Math.max(0, total), 0, 0, 0, [
      { code: "DRIBBLING", value: dribbling * 18 },
      { code: "FLAIR", value: flair * 16 },
      { code: "AGILITY", value: agility * 10 },
      { code: "TECHNIQUE", value: technique * 8 },
      { code: "PRESSURE_WINDOW", value: pressureWindow * 14 },
      { code: "SPACE_PENALTY", value: -spacePenalty },
    ]);
  }

  private calculateEscapeBonus(
    dribbling: number,
    pace: number,
    agility: number,
    nearestOpponentDistance: number,
  ): number {
    if (nearestOpponentDistance > 5) return 8;
    if (nearestOpponentDistance > 3) return (dribbling + pace + agility) * 4;
    return (dribbling + agility) * 5;
  }

  private nearestOpponentDistance(context: DecisionContext, opponents: typeof context.match.home.players): number {
    return opponents.reduce((nearest, opponent) => {
      return Math.min(nearest, context.player.position.distanceTo(opponent.position));
    }, Infinity);
  }

  private normalize(value: number): number {
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}