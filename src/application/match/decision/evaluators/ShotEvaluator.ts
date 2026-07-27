import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";
import { FieldThird } from "../../../../domain";
import { ActionReadiness } from "./ActionReadiness";

/**
 * After throughput fix, SHOT utility 1.85 + box boost produced 300–600 shots/game.
 * Scale down so finishing competes only when the chance is real.
 */
const SHOT_UTILITY_SCALE = 0.55;

/** Soft boost inside the box — much lower than the previous +55. */
const BOX_FLAT_BOOST = 16;

/** Max shots a team may take during one continuous possession spell. */
const MAX_SHOTS_PER_POSSESSION = 2;

export class ShotEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];
    if (!ActionReadiness.canStartAction(context, 0.15)) return [];

    const team = this.ownTeam(context);
    if (team?.isShotLocked(context.match.currentSecond)) return [];
    if ((team?.shotsThisPossession ?? 0) >= MAX_SHOTS_PER_POSSESSION) return [];

    // Need a minimum shooting window or be very close.
    if (context.world.goalDistance > 22 && context.world.shotWindow < 0.35) {
      return [];
    }

    const score = this.calculateUtility(context);
    if (score.total <= 0) return [];

    return [
      new Decision(
        DecisionType.SHOT,
        score.total,
        undefined,
        score.reasons,
        score.components,
      ),
    ];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, world } = context;
    const attrs = player.player.attributes;

    const distance = world.goalDistance;
    const distanceBase = this.distanceBase(
      distance,
      attrs.technical.finishing ?? 10,
      attrs.technical.longShots ?? 10,
    );

    if (distanceBase <= 0) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }

    const roleQuality = PositionInfluenceCalculator.shootingQuality(player.currentRole);

    const finishing = (attrs.technical.finishing ?? 10) / 20;
    const composure = (attrs.mental.composure ?? 10) / 20;
    const technique = (attrs.technical.technique ?? 10) / 20;
    const attrScore = finishing * 0.55 + composure * 0.30 + technique * 0.15;

    const pressure = world.pressure;
    const attackingBonus =
      world.fieldThird === FieldThird.ATTACKING ? 22 : 0;
    const angleBonus = world.goalAngleQuality * 8;

    const desiredDirection = world.goalCenter.subtract(player.position);
    const orientationQuality = ActionReadiness.orientationQuality(
      player.facingDirection,
      desiredDirection,
    );
    const bodyQuality = ActionReadiness.bodyQuality(context);
    const executionQuality = Math.max(
      0.25,
      orientationQuality * 0.50 + bodyQuality * 0.50,
    );

    const windowBoost = 0.70 + world.shotWindow * 0.45;

    const space = distanceBase * windowBoost;
    const techniqueComp = attrScore * distanceBase * 0.35 * windowBoost;
    const role = roleQuality * 18 * windowBoost;
    // Stronger pressure penalty — closed-down shots are rare.
    const pressureComp = -pressure * distanceBase * 0.40 * windowBoost;
    const body = (executionQuality - 0.25) / 0.75 * 10;
    const tactical = (angleBonus + attackingBonus) * executionQuality;
    const proximityBoost =
      distance <= 16 ? BOX_FLAT_BOOST * (1 - distance / 32) : 0;

    // Second shot in same possession is heavily demoted.
    const team = this.ownTeam(context);
    const multiShotPenalty =
      (team?.shotsThisPossession ?? 0) >= 1 ? -35 : 0;

    // Recent SHOT by this player (even if lock expired) — prefer pass/hold.
    const repeatPlayerPenalty =
      player.lastActionType === DecisionType.SHOT ? -25 : 0;

    const raw = UtilityScore.fromComponents({
      SPACE: space * executionQuality * 0.40,
      TECHNIQUE: techniqueComp * executionQuality,
      ROLE: role * executionQuality * 0.30,
      PRESSURE: pressureComp * executionQuality,
      BODY: body,
      TACTICAL: tactical + proximityBoost + multiShotPenalty + repeatPlayerPenalty,
    });

    const scaledTotal = raw.total * SHOT_UTILITY_SCALE;
    const scaleAdj = scaledTotal - raw.total;

    return UtilityScore.fromComponents({
      ...raw.components,
      PRIORITY_SCALE: scaleAdj,
    });
  }

  private distanceBase(
    distance: number,
    finishing: number,
    longShots: number
  ): number {
    if (distance <= 6) return 95;
    if (distance <= 12) return 72 + finishing * 1.2;
    if (distance <= 16) return 52 + finishing * 0.9;
    if (distance <= 20) return 32 + finishing * 0.6;
    if (distance <= 25) return 14 + finishing * 0.35;

    const longBonus = Math.max(0, (longShots - 12) * 1.2);
    if (distance <= 32) return Math.max(0, 4 + longBonus);

    return 0;
  }

  private ownTeam(context: DecisionContext) {
    const isHome = context.match.home.players.includes(context.player);
    return isHome ? context.match.home : context.match.away;
  }
}
