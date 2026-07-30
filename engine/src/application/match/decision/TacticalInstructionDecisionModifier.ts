import type { TacticalZone } from "../../../domain";
import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";
import { DecisionType } from "./DecisionType";

export function applyTacticalInstructionDecisionModifier(decision: Decision, context: DecisionContext): Decision {
  const team = context.match.home.players.includes(context.player) ? context.match.home : context.match.away;
  const tactic = team.tactic;
  let modifier = 0;
  const target = decision.targetId
    ? [...context.match.home.players, ...context.match.away.players].find(player => player.player.id === decision.targetId)
    : undefined;

  if (context.player.hasBall) {
    const withBall = tactic.inPossession;
    if (withBall.tempo === "HIGH") modifier += isFastAction(decision.type) ? 3 : decision.type === DecisionType.HOLD_BALL ? -4 : 0;
    if (withBall.tempo === "LOW") modifier += decision.type === DecisionType.HOLD_BALL || decision.type === DecisionType.PASS ? 3 : -1;
    if (decision.type === DecisionType.PASS && target) {
      const distance = context.player.position.distanceTo(target.position);
      if (withBall.passingStyle === "SHORTER") modifier += distance <= 18 ? 5 : -6;
      if (withBall.passingStyle === "DIRECT") modifier += distance >= 24 ? 6 : -3;
    }
    if (withBall.playOutOfDefence && context.world.goalDistance > context.match.pitch.length * .65) {
      if (decision.type === DecisionType.PASS || decision.type === DecisionType.GK_DISTRIBUTE) modifier += 5;
      if (decision.type === DecisionType.CLEAR) modifier -= 7;
    }
    if (withBall.workBallIntoBox) {
      if (decision.type === DecisionType.SHOT && context.world.goalDistance > 20) modifier -= 10;
      if (decision.type === DecisionType.PASS && context.world.goalDistance < 32) modifier += 3;
    }
    if (withBall.earlyCrosses && decision.type === DecisionType.CROSS) modifier += context.world.goalDistance > 18 ? 7 : 2;
    if (withBall.creativeFreedom === "EXPRESSIVE" && (decision.type === DecisionType.DRIBBLE || decision.type === DecisionType.SKILL_MOVE || decision.type === DecisionType.PASS)) modifier += 3;
    if (withBall.creativeFreedom === "DISCIPLINED" && (decision.type === DecisionType.SKILL_MOVE || decision.type === DecisionType.DRIBBLE)) modifier -= 4;
  } else {
    const withoutBall = tactic.outOfPossession;
    if (decision.type === DecisionType.PRESS) modifier += withoutBall.intensity === "HIGH" ? 7 : withoutBall.intensity === "LOW" ? -5 : 0;
    if (decision.type === DecisionType.MARK && withoutBall.tightMarking) modifier += 6;
  }

  const transition = tactic.transition;
  if (team.collectivePhase === "ATTACKING_TRANSITION" || team.collectivePhase === "COUNTER_ATTACK") {
    if (transition.counterAttack && (decision.type === DecisionType.PASS || decision.type === DecisionType.DRIBBLE)) modifier += 5;
    if (transition.holdShape && decision.type === DecisionType.HOLD_BALL) modifier += 5;
  }
  if (team.collectivePhase === "DEFENSIVE_TRANSITION") {
    if (transition.counterPress && decision.type === DecisionType.PRESS) modifier += 8;
    if (transition.regroup && (decision.type === DecisionType.POSITION || decision.type === DecisionType.COVER)) modifier += 7;
  }
  if (context.player.currentRole.includes("GOALKEEPER") && decision.type === DecisionType.GK_DISTRIBUTE) {
    modifier += transition.goalkeeperDistribution === "DIRECT" ? 5 : transition.goalkeeperDistribution === "SHORT" ? 3 : 0;
    if (target && transition.goalkeeperDistribution === "FULL_BACKS" && (target.currentRole.includes("FULL_BACK") || target.currentRole === "WING_BACK")) modifier += 7;
    if (target && transition.goalkeeperDistribution === "CENTRE_BACKS" && target.currentRole.includes("CENTRE_BACK")) modifier += 7;
  }

  if (target) {
    const opposition = tactic.opposition.players.find(item => item.opponentPlayerId === target.player.id);
    if (opposition?.press && decision.type === DecisionType.PRESS) modifier += 9;
    if (opposition?.tightMark && decision.type === DecisionType.MARK) modifier += 9;
    if (opposition?.forceWeakFoot && (decision.type === DecisionType.PRESS || decision.type === DecisionType.TACKLE)) modifier += 3;
    if (opposition?.doubleMark && decision.type === DecisionType.MARK) modifier += 5;
    const zones = resolveZones(context, target.position.x, target.position.y);
    if (zones.some(zone => tactic.opposition.blockedZones.includes(zone)) && (decision.type === DecisionType.PRESS || decision.type === DecisionType.MARK || decision.type === DecisionType.COVER)) modifier += 5;
    if (zones.some(zone => tactic.opposition.allowedZones.includes(zone)) && decision.type === DecisionType.PRESS) modifier -= 4;
  }

  if (modifier === 0) return decision;
  return new Decision(decision.type, decision.utility + modifier, decision.targetId,
    [...(decision.reasons ?? []), { code: "TACTICAL_INSTRUCTIONS", value: modifier }],
    { ...(decision.components ?? {}), TACTICAL_INSTRUCTIONS: modifier });
}

function isFastAction(type: DecisionType): boolean {
  return type === DecisionType.PASS || type === DecisionType.CROSS || type === DecisionType.DRIBBLE || type === DecisionType.SHOT;
}

function resolveZones(context: DecisionContext, x: number, y: number): TacticalZone[] {
  const width = context.match.pitch.width;
  const corridor: TacticalZone = y < width / 3 ? "LEFT" : y > width * 2 / 3 ? "RIGHT" : "CENTRE";
  const team = context.match.home.players.includes(context.player) ? context.match.home : context.match.away;
  const progress = team.attackingDirection === 1 ? x / context.match.pitch.length : 1 - x / context.match.pitch.length;
  const third: TacticalZone = progress < 1 / 3 ? "OWN_THIRD" : progress > 2 / 3 ? "FINAL_THIRD" : "MIDDLE_THIRD";
  return [corridor, third];
}
