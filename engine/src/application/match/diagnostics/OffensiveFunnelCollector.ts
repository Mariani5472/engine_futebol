import type { MatchEvent } from "../../../domain";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { PassResolutionRecord, PossessionAcquisitionRecord } from "../../../core/movement/BallMatchState";
import type { WorldAwareness } from "../awareness/WorldAwareness";
import type { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";

export type OffensiveFailureReason = "PASS_BLOCKED" | "PASS_NO_OPTION" | "OFFSIDE" | "SHOT_DECLINED" |
  "SHOT_BLOCKED" | "SHOT_SAVED" | "SHOT_OFF_TARGET" | "POSSESSION_RECYCLED" | "BALL_LOST";
export type GoalContext = "THROUGH_BALL" | "CROSS" | "REBOUND" | "TRANSITION" | "POSITIONAL";

export interface TeamOffensiveFunnel {
  readonly possessions: number; readonly progressions: number; readonly finalThirdEntries: number;
  readonly penaltyAreaEntries: number; readonly receptionsInArea: number; readonly shots: number;
  readonly shotsOnTarget: number; readonly goals: number;
  readonly reasons: Readonly<Record<OffensiveFailureReason, number>>;
  readonly goalContexts: Readonly<Record<GoalContext, number>>;
  readonly sterilePossessions: number;
}
export interface MatchOffensiveFunnel { readonly home: TeamOffensiveFunnel; readonly away: TeamOffensiveFunnel }

type MutableFunnel = {
  -readonly [K in keyof Omit<TeamOffensiveFunnel, "reasons" | "goalContexts">]: TeamOffensiveFunnel[K]
} & {
  reasons: Record<OffensiveFailureReason, number>;
  goalContexts: Record<GoalContext, number>;
};
interface ActivePossession {
  team: "home" | "away"; startedAt: number; startProgress: number; maxProgress: number;
  progressed: boolean; finalThird: boolean; box: boolean; shot: boolean; priorShot: boolean;
  lastAction: DecisionType | null; lastDeliveryAction: DecisionType | null; lastProgressivePass: boolean;
  passNoOptionCounted: boolean; shotDeclinedCounted: boolean; recycledCounted: boolean;
}

const reasons = (): Record<OffensiveFailureReason, number> => ({
  PASS_BLOCKED: 0, PASS_NO_OPTION: 0, OFFSIDE: 0, SHOT_DECLINED: 0, SHOT_BLOCKED: 0,
  SHOT_SAVED: 0, SHOT_OFF_TARGET: 0, POSSESSION_RECYCLED: 0, BALL_LOST: 0,
});
const contexts = (): Record<GoalContext, number> => ({ THROUGH_BALL: 0, CROSS: 0, REBOUND: 0, TRANSITION: 0, POSITIONAL: 0 });
const mutable = (): MutableFunnel => ({ possessions: 0, progressions: 0, finalThirdEntries: 0,
  penaltyAreaEntries: 0, receptionsInArea: 0, shots: 0, shotsOnTarget: 0, goals: 0,
  sterilePossessions: 0, reasons: reasons(), goalContexts: contexts() });

export class OffensiveFunnelCollector {
  private readonly home = mutable();
  private readonly away = mutable();
  private active: ActivePossession | null = null;

  public sample(state: MatchState): void {
    const owner = state.ball.owner;
    if (!owner) return;
    const side = state.home.players.includes(owner) ? "home" : "away";
    if (!this.active || this.active.team !== side) {
      if (this.active) this.finishPossession("BALL_LOST");
      const progress = this.progress(state, side, state.ball.position.x);
      this.active = { team: side, startedAt: state.currentSecond, startProgress: progress, maxProgress: progress,
        progressed: false, finalThird: false, box: false, shot: false, priorShot: false,
        lastAction: null, lastDeliveryAction: null, lastProgressivePass: false, passNoOptionCounted: false,
        shotDeclinedCounted: false, recycledCounted: false };
      this.data(side).possessions++;
    }
    const active = this.active;
    const progress = this.progress(state, side, state.ball.position.x);
    active.maxProgress = Math.max(active.maxProgress, progress);
    if (!active.progressed && active.maxProgress - active.startProgress >= 10) {
      active.progressed = true; this.data(side).progressions++;
    }
    if (!active.finalThird && progress >= state.pitch.length * 2 / 3) {
      active.finalThird = true; this.data(side).finalThirdEntries++;
    }
    if (!active.box && this.isInBox(state, side, state.ball.position.x, state.ball.position.y)) {
      active.box = true; this.data(side).penaltyAreaEntries++;
    }
    if (!active.recycledCounted && active.maxProgress - progress >= 12 && !active.shot) {
      active.recycledCounted = true; this.data(side).reasons.POSSESSION_RECYCLED++;
    }
  }

  public onDecision(player: PlayerMatchState, decision: Decision, world: WorldAwareness, state: MatchState): void {
    if (!this.active) return;
    const side = state.home.players.includes(player) ? "home" : "away";
    if (this.active.team !== side) return;
    this.active.lastAction = decision.type;
    if (decision.type === DecisionType.PASS || decision.type === DecisionType.CROSS) this.active.lastDeliveryAction = decision.type;
    if (!this.active.passNoOptionCounted && world.passingLanes.length === 0 && decision.type !== DecisionType.PASS) {
      this.active.passNoOptionCounted = true; this.data(side).reasons.PASS_NO_OPTION++;
    }
    if (!this.active.shotDeclinedCounted && world.shotWindow >= .35 && decision.type !== DecisionType.SHOT) {
      this.active.shotDeclinedCounted = true; this.data(side).reasons.SHOT_DECLINED++;
    }
  }

  public onPassResolution(record: PassResolutionRecord, state: MatchState): void {
    if (!this.active) return;
    if (record.realForwardGain >= 6 && record.success) {
      this.active.lastProgressivePass = true;
      if (!this.active.progressed) { this.active.progressed = true; this.data(this.active.team).progressions++; }
    }
    if (!record.success) {
      const controller = [...state.home.players, ...state.away.players].find(player => player.player.id === record.controllingPlayerId);
      const controllerSide = controller ? (state.home.players.includes(controller) ? "home" : "away") : null;
      if (controllerSide && controllerSide !== this.active.team) this.data(this.active.team).reasons.PASS_BLOCKED++;
    }
  }

  public onAcquisitions(records: readonly PossessionAcquisitionRecord[], state: MatchState): void {
    for (const record of records) {
      const player = [...state.home.players, ...state.away.players].find(item => item.player.id === record.playerId);
      if (!player) continue;
      const side = state.home.players.includes(player) ? "home" : "away";
      if (this.active?.team === side && this.isInBox(state, side, player.position.x, player.position.y)) {
        this.data(side).receptionsInArea++;
      }
    }
  }

  public onEvents(events: readonly MatchEvent[], state: MatchState): void {
    let terminalShot = false;
    for (const event of events) {
      if (event.type !== "SHOT" && event.type !== "GOAL") continue;
      const side = event.teamId === state.home.team.id ? "home" : "away";
      const data = this.data(side);
      if (event.type === "SHOT") {
        data.shots++; if (event.result === "SAVED" || event.result === "GOAL") data.shotsOnTarget++;
        if (event.result === "BLOCKED") data.reasons.SHOT_BLOCKED++;
        if (event.result === "SAVED") data.reasons.SHOT_SAVED++;
        if (event.result === "OFF_TARGET") data.reasons.SHOT_OFF_TARGET++;
        if (this.active?.team === side) { this.active.priorShot = this.active.shot; this.active.shot = true; }
        if (event.result === "OFF_TARGET" || event.result === "SAVED" || event.result === "GOAL") terminalShot = true;
      } else {
        data.goals++;
        const active = this.active?.team === side ? this.active : null;
        const phase = side === "home" ? state.home.collectivePhase : state.away.collectivePhase;
        const context: GoalContext = active?.priorShot ? "REBOUND"
          : active?.lastDeliveryAction === DecisionType.CROSS ? "CROSS"
          : phase === "COUNTER_ATTACK" || phase === "ATTACKING_TRANSITION" ? "TRANSITION"
          : active?.lastProgressivePass ? "THROUGH_BALL" : "POSITIONAL";
        data.goalContexts[context]++;
      }
    }
    if (terminalShot) this.active = null;
  }

  public snapshot(): MatchOffensiveFunnel { return { home: this.copy(this.home), away: this.copy(this.away) }; }

  private finishPossession(reason: OffensiveFailureReason): void {
    if (!this.active) return;
    const data = this.data(this.active.team);
    data.reasons[reason]++;
    if (!this.active.progressed && !this.active.finalThird && !this.active.shot) data.sterilePossessions++;
    this.active = null;
  }
  private data(side: "home" | "away"): MutableFunnel { return side === "home" ? this.home : this.away; }
  private progress(state: MatchState, side: "home" | "away", x: number): number {
    const team = side === "home" ? state.home : state.away;
    return team.attackingDirection === 1 ? x : state.pitch.length - x;
  }
  private isInBox(state: MatchState, side: "home" | "away", x: number, y: number): boolean {
    return this.progress(state, side, x) >= state.pitch.length - 16.5 && Math.abs(y - state.pitch.width / 2) <= 20.16;
  }
  private copy(data: MutableFunnel): TeamOffensiveFunnel { return { ...data, reasons: { ...data.reasons }, goalContexts: { ...data.goalContexts } }; }
}
