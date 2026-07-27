import { ActionExecution, ActionExecutionPhase } from "./ActionExecution";
import { ActionPriority, getActionPriority } from "./ActionPriority";
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
 * 4. Losers are interrupted with an appropriate reason.
 */
export class ActionArbitrator {

  /**
   * Given all players that just transitioned to EXECUTING this tick,
   * returns the subset that are allowed to apply their consequences.
   * Losers have their ActionExecution interrupted.
   */
  public resolve(
    candidates: ActionExecution[],
    match: MatchState,
    currentTime: number,
  ): ActionExecution[] {
    if (candidates.length <= 1) return candidates;

    // Group by conflict domain.
    const ballContenders = candidates.filter((e) => isBallContest(e.type));
    const others = candidates.filter((e) => !isBallContest(e.type));

    const winners: ActionExecution[] = [...others];

    if (ballContenders.length <= 1) {
      winners.push(...ballContenders);
      return winners;
    }

    // Sort: higher priority first, then earlier executeAt, then closer to ball.
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

    // Interrupt losers.
    for (let i = 1; i < ranked.length; i++) {
      const loser = ranked[i];
      const reason = interruptionReasonFor(winner.type, loser.type);
      loser.interrupt(reason, currentTime);

      // Clear activeAction reference if it was interrupted to recovery.
      const loserPlayer = findPlayer(match, loser);
      if (loserPlayer && loserPlayer.activeAction === loser) {
        // Keep the interrupted action so recovery can finish;
        // do not null it here — recovery phase still runs.
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
  _loserType: DecisionType,
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
