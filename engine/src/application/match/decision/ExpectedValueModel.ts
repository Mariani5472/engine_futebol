import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";
import { DecisionType } from "./DecisionType";

export interface DecisionExpectedValue {
  readonly successProbability: number;
  readonly goalProbability: number;
  readonly futurePossessionValue: number;
  readonly defensiveExposure: number;
  readonly utilityModifier: number;
}

/**
 * One explicit, bounded EV layer shared by possession actions. Evaluators still
 * describe action-specific technique and space; this layer makes their common
 * trade-off observable: execution, goal threat, retained value and exposure.
 */
export class ExpectedValueModel {
  public evaluate(decision: Decision, context: DecisionContext): DecisionExpectedValue {
    const attributes = context.player.player.attributes;
    const technique = (
      Number(attributes.technical.technique ?? 10)
      + Number(attributes.mental.decisions ?? 10)
      + Number(attributes.mental.composure ?? 10)
    ) / 60;
    const pressure = clamp(context.world.pressure, 0, 1);
    const target = decision.targetId ? this.player(context, decision.targetId) : null;
    const team = context.match.home.players.includes(context.player) ? context.match.home : context.match.away;
    const opponent=team===context.match.home?context.match.away:context.match.home;
    const lateMatch=clamp((context.match.currentSecond-60*60)/(30*60),0,1);
    const scoreDeficit=opponent.score-team.score;
    const attackingUrgency=clamp(1+lateMatch*scoreDeficit*.22,.72,1.45);
    const protectionUrgency=clamp(1+lateMatch*(-scoreDeficit)*.28,.75,1.55);
    const forwardGain = target
      ? (target.position.x - context.player.position.x) * team.attackingDirection
      : 0;
    const distanceToGoal = team.attackingDirection === 1
      ? context.match.pitch.length - context.player.position.x
      : context.player.position.x;

    const successProbability = clamp(
      this.baseSuccess(decision.type) + technique * .34 - pressure * .28
        - Math.max(0, forwardGain - 18) * .006,
      .03,
      .97,
    );
    const goalProbability = decision.type === DecisionType.SHOT
      ? clamp((1 - distanceToGoal / 32) * (.12 + technique * .28) * (1 - pressure * .45), .01, .42)
      : decision.type === DecisionType.CROSS
        ? clamp(.025 + Math.max(0, forwardGain) / 400, .02, .10)
        : decision.type === DecisionType.PASS && forwardGain > 8
          ? clamp(forwardGain / 500, 0, .08)
          : 0;
    const futurePossessionValue = clamp(
      this.baseFutureValue(decision.type) + forwardGain / 35 + successProbability * .45,
      -.4,
      1.6,
    );
    const ownGoalDistance = context.match.pitch.length - distanceToGoal;
    const exposureZone = clamp(1 - ownGoalDistance / 45, 0, 1);
    const defensiveExposure = clamp(
      (1 - successProbability) * exposureZone * this.turnoverWeight(decision.type),
      0,
      1,
    );
    const raw = goalProbability * 32*attackingUrgency + futurePossessionValue * 5
      - defensiveExposure * 12*protectionUrgency;
    return {
      successProbability,
      goalProbability,
      futurePossessionValue,
      defensiveExposure,
      utilityModifier: clamp(raw, -12, 12),
    };
  }

  public apply(decision: Decision, context: DecisionContext): Decision {
    const value = this.evaluate(decision, context);
    return new Decision(
      decision.type,
      decision.utility + value.utilityModifier,
      decision.targetId,
      [
        ...(decision.reasons ?? []),
        { code: "EXPECTED_VALUE", value: value.utilityModifier },
      ],
      {
        ...(decision.components ?? {}),
        SUCCESS_PROBABILITY: value.successProbability,
        GOAL_PROBABILITY: value.goalProbability,
        FUTURE_POSSESSION_VALUE: value.futurePossessionValue,
        DEFENSIVE_EXPOSURE: -value.defensiveExposure,
        EXPECTED_VALUE: value.utilityModifier,
      },
      decision.objective,
    );
  }

  private player(context: DecisionContext, id: string): PlayerMatchState | null {
    return [...context.match.home.players, ...context.match.away.players]
      .find(player => player.player.id === id) ?? null;
  }

  private baseSuccess(type: DecisionType): number {
    switch (type) {
      case DecisionType.HOLD_BALL: return .82;
      case DecisionType.PASS: return .62;
      case DecisionType.DRIBBLE: return .48;
      case DecisionType.CROSS: return .36;
      case DecisionType.SHOT: return .42;
      case DecisionType.CLEAR: return .74;
      default: return .56;
    }
  }

  private baseFutureValue(type: DecisionType): number {
    switch (type) {
      case DecisionType.PASS: return .35;
      case DecisionType.DRIBBLE: return .28;
      case DecisionType.HOLD_BALL: return .18;
      case DecisionType.CROSS: return .16;
      case DecisionType.SHOT: return .08;
      case DecisionType.CLEAR: return -.1;
      default: return .1;
    }
  }

  private turnoverWeight(type: DecisionType): number {
    return type === DecisionType.DRIBBLE ? 1
      : type === DecisionType.PASS ? .8
      : type === DecisionType.CROSS || type === DecisionType.SHOT ? .35
      : .55;
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
