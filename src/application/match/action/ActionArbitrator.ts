import { ActionExecution } from "./ActionExecution";
import { getActionPriority } from "./ActionPriority";
import { DecisionType } from "../decision/DecisionType";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";

/**
 * Resolves conflicts when multiple ActionExecutions reach EXECUTING
 * in the same tick and compete for the same resource (ball, space, duel).
 *
 * Rules (in order):
 * 1. Higher ActionPriority wins.
 * 2. If equal priority, earlier executeAt (started earlier / faster windup) wins.
 * 3. If still tied, the action whose player is closer to the ball wins.
 * 4. Losers are interrupted — the entire PipelineExecution is cancelled.
 */
export class ActionArbitrator {

  /**
   * Given all players that just transitioned to EXECUTING this tick,
   * returns the subset that are allowed to apply their consequences.
   * Losers have their ActionExecution (and owning pipeline) interrupted.
   */
  public resolve(
    candidates: ActionExecution[],
    match: MatchState,
    currentTime: number,
  ): ActionExecution[] {
    if (candidates.length <= 1) return candidates;

    const ballContenders = candidates.filter((e) => isBallContest(e.type));
    const others = candidates.filter((e) => !isBallContest(e.type));

    const winners: ActionExecution[] = [...others];

    if (ballContenders.length <= 1) {
      winners.push(...ballContenders);
      return winners;
    }

    const ballPos = match.ball.position;
    const ranked = [...ballContenders].sort((a, b) => {
      const prioDiff =
        getActionPriority(b.type) - getActionPriority(a.type);
      if (prioDiff !== 0) return prioDiff;

      const timeDiff = a.executeAt - b.executeAt;
      if (Math.abs(timeDiff) > 1e-9) return timeDiff;

      const playerA = findPlayer(match, a);
      const playerB = findPlayer(match, b);
      if (!playerA || !playerB) return 0;

      const distA = playerA.position.distanceTo(ballPos);
      const distB = playerB.position.distanceTo(ballPos);
      return distA - distB;
    });

    const winner = ranked[0];
    winners.push(winner);

    for (let i = 1; i < ranked.length; i++) {
      const loser = ranked[i];
      const reason = interruptionReasonFor(winner.type);
      const loserPlayer = findPlayer(match, loser);

      // Prefer interrupting the whole pipeline so remaining steps are cancelled.
      if (loserPlayer?.activePipeline?.isBusy()) {
        loserPlayer.activePipeline.interrupt(reason, currentTime);
      } else {
        loser.interrupt(reason, currentTime);
      }
    }

    return winners;
  }
}

function isBallContest(type: DecisionType): boolean {
  switch (type) {
    case DecisionType.PASS:
    case DecisionType.CROSS:
    case DecisionType.SHOT:
    case DecisionType.CLEAR:
    case DecisionType.HEADER:
    case DecisionType.TACKLE:
    case DecisionType.INTERCEPT:
    case DecisionType.BLOCK:
    case DecisionType.GK_CLAIM:
    case DecisionType.CONTROL:
    case DecisionType.RECEIVE:
    case DecisionType.HOLD_BALL:
    case DecisionType.DRIBBLE:
    case DecisionType.SKILL_MOVE:
    case DecisionType.FAKE:
    case DecisionType.TACTICAL_FOUL:
    case DecisionType.GK_DISTRIBUTE:
    case DecisionType.SET_PIECE:
      return true;
    default:
      return false;
  }
}

function interruptionReasonFor(
  winnerType: DecisionType,
): "TACKLE" | "INTERCEPTION" | "BLOCK" | "COLLISION" | "LOSS_OF_BALANCE" {
  switch (winnerType) {
    case DecisionType.TACKLE:
    case DecisionType.TACTICAL_FOUL:
      return "TACKLE";
    case DecisionType.INTERCEPT:
      return "INTERCEPTION";
    case DecisionType.BLOCK:
      return "BLOCK";
    case DecisionType.GK_CLAIM:
      return "COLLISION";
    default:
      return "LOSS_OF_BALANCE";
  }
}

function findPlayer(
  match: MatchState,
  execution: ActionExecution,
): PlayerMatchState | undefined {
  for (const p of [...match.home.players, ...match.away.players]) {
    if (p.activeAction === execution) return p;
  }
  return undefined;
}
