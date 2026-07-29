import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";
import { DecisionType } from "./DecisionType";
import type { PredictedActionOutcome } from "../tactical/intelligence/TacticalIntelligenceTypes";

const HORIZONS = [0.5, 1, 2, 3] as const;

/** Lightweight deterministic rollout of the consequences relevant to tactical choice. */
export class ShortHorizonPredictionSystem {
  public predict(decision: Decision, context: DecisionContext): PredictedActionOutcome {
    const tactical = context.teamTacticalContext;
    const team = context.match.home.players.includes(context.player) ? context.match.home : context.match.away;
    const target = decision.targetId ? this.player(context, decision.targetId) : undefined;
    const lane = tactical?.passingLanes.find(item =>
      item.fromPlayerId === context.player.player.id && item.toPlayerId === decision.targetId,
    );
    const forward = target ? (target.position.x - context.player.position.x) * team.attackingDirection : 0;
    const technique = this.technique(context.player);
    const pressure = context.world.pressure;
    const space = this.bestReachableSpace(context);

    let success = .55 + technique * .2 - pressure * .22;
    let progression = forward;
    let shotCreation = 0;
    let xgThreat = 0;
    let spaceCreation = 0;
    const explanation: string[] = [];
    if (decision.type === DecisionType.PASS || decision.type === DecisionType.CROSS || decision.type === DecisionType.GK_DISTRIBUTE) {
      success = clamp(.52 + technique * .25 + (lane?.arrivalMargin ?? -.1) * .22 - pressure * .18, .05, .97);
      shotCreation = clamp(Math.max(0, forward) / 35 + (target ? this.targetGoalQuality(target, context) * .42 : 0), 0, .85);
      spaceCreation = clamp((lane?.clearAtArrival ? .25 : 0) + Math.max(0, forward) / 70, 0, 1);
      explanation.push(lane?.clearAtArrival ? "receiver favoured at arrival" : "lane may close before arrival");
      if (lane) explanation.push(`arrival margin ${lane.arrivalMargin.toFixed(2)}s`);
    } else if (decision.type === DecisionType.DRIBBLE || decision.type === DecisionType.SKILL_MOVE) {
      progression = space ? (space.center.x - context.player.position.x) * team.attackingDirection : context.world.freeSpace * 5;
      success = clamp(.38 + technique * .32 + context.world.freeSpace * .25 - pressure * .3, .06, .92);
      shotCreation = clamp((space?.shotCreationValue ?? 0) * success + Math.max(0, progression) / 45, 0, .8);
      spaceCreation = clamp(context.world.freeSpace * .45 + pressure * .25, 0, 1);
      explanation.push(space ? `attacks ${space.kind} space` : "no valuable future space found");
    } else if (decision.type === DecisionType.SHOT) {
      const blockerCoverage = this.blockerCoverage(context);
      const goalkeeperCoverage = this.goalkeeperCoverage(context);
      success = clamp(.72 + technique * .18 - pressure * .2 - blockerCoverage * .42, .03, .96);
      xgThreat = clamp(context.world.shotWindow * (.18 + technique * .32) * (1 - goalkeeperCoverage * .42) * (1 - blockerCoverage * .6), .01, .72);
      shotCreation = 1;
      explanation.push(`shot quality ${context.world.shotWindow.toFixed(2)}`);
      explanation.push(`blocker coverage ${blockerCoverage.toFixed(2)}`);
      explanation.push(`goalkeeper coverage ${goalkeeperCoverage.toFixed(2)}`);
    } else if (decision.type === DecisionType.HOLD_BALL) {
      success = clamp(.78 - pressure * .45 + technique * .12, .12, .94);
      progression = 0;
      spaceCreation = clamp(pressure * .15, 0, .2);
      explanation.push("retains current structure");
    }

    const turnover = clamp(1 - success, .02, .96);
    const ownProgress = team.attackingDirection === 1
      ? context.player.position.x / context.match.pitch.length
      : 1 - context.player.position.x / context.match.pitch.length;
    const restProtected = tactical?.restDefense.protected ?? false;
    const counterRisk = clamp(turnover * (1 - ownProgress) * (restProtected ? .48 : 1), 0, 1);
    const linesBroken = Math.max(0, Math.min(3, Math.floor(Math.max(0, progression) / 11)));
    if (!xgThreat) xgThreat = clamp(shotCreation * .16, 0, .18);
    return {
      actionType: decision.type,
      targetId: decision.targetId,
      horizons: HORIZONS,
      possessionProbability: success,
      successfulExecutionProbability: success,
      territorialProgression: progression,
      defensiveLinesBroken: linesBroken,
      shotCreationProbability: shotCreation,
      expectedGoalThreat: xgThreat,
      turnoverProbability: turnover,
      counterattackRisk: counterRisk,
      receiverPressure: target ? this.pressureAt(target, context) : undefined,
      receiverBodyOrientation: target ? this.bodyOrientation(target, context) : undefined,
      spaceCreationValue: spaceCreation,
      explanation,
    };
  }

  private bestReachableSpace(context: DecisionContext) {
    return context.teamTacticalContext?.spaces
      .filter(space => space.reachablePlayers.includes(context.player.player.id) && space.availableUntil >= .5)
      .sort((a,b) => (b.progressionValue + b.shotCreationValue - b.occupationRisk) - (a.progressionValue + a.shotCreationValue - a.occupationRisk))[0];
  }

  private blockerCoverage(context: DecisionContext): number {
    const from = context.player.position;
    const to = context.world.goalCenter;
    const length = from.distanceTo(to);
    if (length < .1) return 0;
    let coverage = 0;
    for (const opponent of context.world.opponents.filter(player => !String(player.currentRole).includes("GOALKEEPER"))) {
      const along = clamp(opponent.position.subtract(from).dot(to.subtract(from)) / (length * length), 0, 1);
      if (along <= .05 || along >= .98) continue;
      const nearest = from.add(to.subtract(from).multiply(along));
      coverage = Math.max(coverage, clamp(1 - opponent.position.distanceTo(nearest) / 2, 0, 1));
    }
    return coverage;
  }

  private goalkeeperCoverage(context: DecisionContext): number {
    const goalkeeper = context.world.opponents.find(player => String(player.currentRole).includes("GOALKEEPER"));
    if (!goalkeeper) return 0;
    const centreDistance = goalkeeper.position.distanceTo(context.world.goalCenter);
    return clamp(1 - centreDistance / 9, .15, 1);
  }

  private targetGoalQuality(target: PlayerMatchState, context: DecisionContext): number {
    const distance = target.position.distanceTo(context.world.goalCenter);
    return clamp(1 - distance / 32, 0, 1);
  }

  private pressureAt(target: PlayerMatchState, context: DecisionContext): number {
    const future = context.tacticalIntelligence?.players.get(target.player.id)?.predictedTrajectory["1"] ?? target.position;
    const nearest = Math.min(...context.world.opponents.map(opponent => {
      const predicted = context.tacticalIntelligence?.players.get(opponent.player.id)?.predictedTrajectory["1"] ?? opponent.position;
      return predicted.distanceTo(future);
    }), 20);
    return clamp(1 - nearest / 8, 0, 1);
  }

  private bodyOrientation(target: PlayerMatchState, context: DecisionContext): number {
    const goalDirection = context.world.goalCenter.subtract(target.position).normalize();
    return clamp((target.facingDirection.normalize().dot(goalDirection) + 1) / 2, 0, 1);
  }

  private technique(player: PlayerMatchState): number {
    const attributes = player.player.attributes;
    return (Number(attributes.technical.technique ?? 10) + Number(attributes.mental.decisions ?? 10)
      + Number(attributes.mental.anticipation ?? 10)) / 60;
  }

  private player(context: DecisionContext, id: string): PlayerMatchState | undefined {
    return [...context.match.home.players, ...context.match.away.players].find(player => player.player.id === id);
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

