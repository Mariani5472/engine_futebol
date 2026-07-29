import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { BallState } from "../../../../core/movement/BallMatchState";
import { FoulEvent, Milliseconds, PlayerId, TeamId } from "../../../../domain";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { RefereeSystem } from "../../referee/RefereeSystem";
import { ActionEvent } from "../ActionResult";

export class TackleAction {
  private static readonly TACKLE_COOLDOWN_SECONDS = 4;

  constructor(private readonly referee: RefereeSystem) {}

  public execute(context: ActionContext): ActionResult {
    const { player, match, random, matchSecond } = context;
    const period = matchSecond < 45 * 60 ? ("FIRST_HALF" as const) : ("SECOND_HALF" as const);

    const ballOwner = match.ball.owner;
    if (!ballOwner || ballOwner === player) {
      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events: [],
      };
    }

    const isHomePlayer = match.home.players.includes(player);
    const ownerIsOpponent = isHomePlayer
      ? match.away.players.includes(ballOwner)
      : match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) {
      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events: [],
      };
    }

    if (this.referee.isPlayerSentOff(player.player.id)) {
      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events: [],
      };
    }
    if (matchSecond < ballOwner.possessionProtectedUntil) {
      return { actorId: player.player.id, type: DecisionType.TACKLE, success: false, events: [] };
    }

    if (
      context.decision.type === DecisionType.TACKLE ||
      context.decision.type === DecisionType.TACTICAL_FOUL
    ) {
      player.tackleLockUntil = Math.max(
        player.tackleLockUntil,
        matchSecond + TackleAction.TACKLE_COOLDOWN_SECONDS,
      );
    }

    const { successProb, dangerScore } = this.calculateTackle(player, ballOwner, random);
    const success = random.nextFloat(0, 1) < successProb;

    const tacklerTeam = isHomePlayer ? match.home : match.away;
    const victimTeam = isHomePlayer ? match.away : match.home;

    const foulOutcome = this.referee.evaluateTackle(
      player,
      tacklerTeam,
      ballOwner,
      victimTeam,
      dangerScore,
      match,
      period,
      matchSecond,
      success,
    );

    const events: ActionEvent[] = [...foulOutcome.events];

    if (foulOutcome.isFoul) {
      const foul: FoulEvent = {
        id: `foul-${player.player.id}-${matchSecond.toFixed(1)}`,
        type: "FOUL",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId: tacklerTeam.team.id as TeamId,
        playerId: player.player.id as PlayerId,
      };
      events.push(foul);

      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events,
      };
    }

    const physicalContact = player.position.distanceTo(match.ball.position) <= 1.5;
    if (success && physicalContact) {
      if (ballOwner.activePipeline?.isBusy()) {
        ballOwner.activePipeline.interrupt("TACKLE", matchSecond);
      } else {
        ballOwner.activeAction?.interrupt("TACKLE", matchSecond);
      }

      ballOwner.hasBall = false;
      player.hasBall = true;
      match.ball.acquirePossession(player, "TACKLE", matchSecond);
      match.ball.state = BallState.CONTROLLED;
    }

    return {
      actorId: player.player.id,
      type: DecisionType.TACKLE,
      success: success && physicalContact,
      events,
    };
  }

  private calculateTackle(
    tackler: PlayerMatchState,
    target: PlayerMatchState,
    random: { nextFloat: (min: number, max: number) => number },
  ): { successProb: number; dangerScore: number } {
    const tAttrs = tackler.player.attributes;
    const vAttrs = target.player.attributes;

    const tackling = (tAttrs.technical.tackling ?? 10) / 20;
    const strength = (tAttrs.physical.strength ?? 10) / 20;
    const aggression = (tAttrs.mental.aggression ?? 10) / 20;

    const targetBalance = (vAttrs.physical.balance ?? 10) / 20;
    const targetAgility = (vAttrs.physical.agility ?? 10) / 20;
    const targetTechnique = (vAttrs.technical.technique ?? 10) / 20;

    const tacklerFatigue = 1 - ((tackler.fatigue ?? 0) / 100) * 0.3;
    const targetFatigue = 1 - ((target.fatigue ?? 0) / 100) * 0.2;

    const tacklerScore =
      (tackling * 0.5 + strength * 0.3 + aggression * 0.2) * tacklerFatigue;
    const targetScore =
      (targetBalance * 0.4 + targetAgility * 0.3 + targetTechnique * 0.3) *
      targetFatigue;

    const successProb = Math.max(
      0.05,
      Math.min(0.85, tacklerScore / (tacklerScore + targetScore)),
    );

    const dangerScore = Math.min(
      1,
      aggression * 0.28 +
        (1 - tackling) * 0.18 +
        (1 - strength) * 0.08 +
        random.nextFloat(0, 0.12),
    );

    return { successProb, dangerScore };
  }
}
