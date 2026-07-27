import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { BallState } from "../../../../core/movement/BallMatchState";
import { ActionContext } from "../ActionContext";
import { ActionResult } from "../ActionResult";
import { DecisionType } from "../../decision/DecisionType";
import { RefereeSystem } from "../../referee/RefereeSystem";
import { ActionEvent } from "../ActionResult";

export class TackleAction {
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

    // Sent-off players should not produce further discipline events.
    if (this.referee.isPlayerSentOff(player.player.id)) {
      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events: [],
      };
    }

    const { successProb, dangerScore } = this.calculateTackle(player, ballOwner, random);
    const success = random.nextFloat(0, 1) < successProb;

    const tacklerTeam = isHomePlayer ? match.home : match.away;
    const victimTeam = isHomePlayer ? match.away : match.home;

    // Referee sees whether the ball was won cleanly — success suppresses soft fouls.
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
      // Foul: challenge fails, no possession change.
      return {
        actorId: player.player.id,
        type: DecisionType.TACKLE,
        success: false,
        events,
      };
    }

    if (success) {
      if (ballOwner.activePipeline?.isBusy()) {
        ballOwner.activePipeline.interrupt("TACKLE", matchSecond);
      } else {
        ballOwner.activeAction?.interrupt("TACKLE", matchSecond);
      }

      ballOwner.hasBall = false;
      player.hasBall = true;
      match.ball.owner = player;
      match.ball.state = BallState.CONTROLLED;
      match.ball.position = player.position;
    }

    return {
      actorId: player.player.id,
      type: DecisionType.TACKLE,
      success,
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

    //
    // Danger must stay mostly in 0.15–0.55 for average players.
    // Old formula: aggression*0.5 + (1-tackling)*0.3 + U(0,0.2) ≈ 0.4–0.7
    // which triggered fouls on nearly every challenge and cascaded into reds.
    //
    // New: skill reduces danger; only high aggression + poor technique spikes it.
    //
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
