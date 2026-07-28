import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { DecisionType } from "../decision/DecisionType";

export interface AverageRolePosition { readonly x: number; readonly y: number; readonly samples: number }
export interface TeamTacticalDiagnostics {
  readonly averageLineHeight: { readonly defence: number; readonly midfield: number; readonly attack: number };
  readonly blockWidth: number;
  readonly blockDepth: number;
  readonly defenceMidfieldDistance: number;
  readonly midfieldAttackDistance: number;
  readonly averagePlayersAheadOfBall: number;
  readonly finalThirdEntries: number;
  readonly penaltyAreaEntries: number;
  readonly progressiveRuns: number;
  readonly averageTransitionSeconds: number;
  readonly ppda: number | null;
  readonly pressureByZone: { readonly ownThird: number; readonly middleThird: number; readonly finalThird: number };
  readonly averagePositionByRole: Readonly<Record<string, AverageRolePosition>>;
  readonly ballCirculationSpeed: number;
}
export interface MatchTacticalDiagnostics { readonly home: TeamTacticalDiagnostics; readonly away: TeamTacticalDiagnostics }

interface MutableTeamDiagnostics {
  samples: number; defenceHeight: number; midfieldHeight: number; attackHeight: number;
  width: number; depth: number; defenceMidfield: number; midfieldAttack: number;
  playersAhead: number; finalThirdEntries: number; penaltyAreaEntries: number;
  progressiveRuns: number; transitionSeconds: number; transitions: number;
  pressureOwn: number; pressureMiddle: number; pressureFinal: number;
  pressureOwnSamples: number; pressureMiddleSamples: number; pressureFinalSamples: number;
  circulationDistance: number; circulationSeconds: number;
  opponentPasses: number; defensiveActions: number;
  roles: Map<string, { x: number; y: number; samples: number }>;
  previousProgress: Map<string, number>; runOrigin: Map<string, number>;
  insideFinalThird: Set<string>; insidePenaltyArea: Set<string>;
  previousPhase: string; transitionStartedAt: number | null;
  previousBallPosition: { x: number; y: number } | null;
}

const mutable = (): MutableTeamDiagnostics => ({
  samples: 0, defenceHeight: 0, midfieldHeight: 0, attackHeight: 0, width: 0, depth: 0,
  defenceMidfield: 0, midfieldAttack: 0, playersAhead: 0, finalThirdEntries: 0,
  penaltyAreaEntries: 0, progressiveRuns: 0, transitionSeconds: 0, transitions: 0,
  pressureOwn: 0, pressureMiddle: 0, pressureFinal: 0, circulationDistance: 0,
  pressureOwnSamples: 0, pressureMiddleSamples: 0, pressureFinalSamples: 0,
  circulationSeconds: 0, opponentPasses: 0, defensiveActions: 0, roles: new Map(),
  previousProgress: new Map(), runOrigin: new Map(), insideFinalThird: new Set(),
  insidePenaltyArea: new Set(), previousPhase: "", transitionStartedAt: null, previousBallPosition: null,
});

export class TacticalDiagnosticsCollector {
  private readonly home = mutable();
  private readonly away = mutable();

  public sample(state: MatchState, deltaTime: number): void {
    this.sampleTeam(state, state.home, state.away, this.home, deltaTime);
    this.sampleTeam(state, state.away, state.home, this.away, deltaTime);
  }

  public onActionStarted(player: PlayerMatchState, type: DecisionType, state: MatchState): void {
    const own = state.home.players.includes(player) ? this.home : this.away;
    const opponent = own === this.home ? this.away : this.home;
    if (type === DecisionType.PASS || type === DecisionType.CROSS) opponent.opponentPasses++;
    if (type === DecisionType.TACKLE || type === DecisionType.INTERCEPT || type === DecisionType.BLOCK) own.defensiveActions++;
  }

  public snapshot(): MatchTacticalDiagnostics {
    return { home: this.resolve(this.home), away: this.resolve(this.away) };
  }

  private sampleTeam(state: MatchState, team: TeamMatchState, opponents: TeamMatchState, data: MutableTeamDiagnostics, deltaTime: number): void {
    const outfield = team.players.filter(player => !player.currentRole.includes("GOALKEEPER"));
    const lines = { defence: [] as number[], midfield: [] as number[], attack: [] as number[] };
    const progresses = outfield.map(player => {
      const progress = this.progress(player.position.x, team, state.pitch.length);
      lines[this.sector(player)].push(progress);
      return progress;
    });
    const defence = average(lines.defence), midfield = average(lines.midfield), attack = average(lines.attack);
    data.samples++;
    data.defenceHeight += defence; data.midfieldHeight += midfield; data.attackHeight += attack;
    data.width += range(outfield.map(player => player.position.y));
    data.depth += range(progresses);
    data.defenceMidfield += Math.abs(midfield - defence);
    data.midfieldAttack += Math.abs(attack - midfield);
    const ballProgress = this.progress(state.ball.position.x, team, state.pitch.length);
    data.playersAhead += progresses.filter(progress => progress > ballProgress).length;

    for (const player of outfield) {
      const progress = this.progress(player.position.x, team, state.pitch.length);
      const wasFinal = data.insideFinalThird.has(player.player.id);
      const isFinal = progress >= state.pitch.length * 2 / 3;
      if (isFinal && !wasFinal) data.finalThirdEntries++;
      isFinal ? data.insideFinalThird.add(player.player.id) : data.insideFinalThird.delete(player.player.id);
      const isBox = progress >= state.pitch.length - 16.5 && Math.abs(player.position.y - state.pitch.width / 2) <= 20.16;
      const wasBox = data.insidePenaltyArea.has(player.player.id);
      if (isBox && !wasBox) data.penaltyAreaEntries++;
      isBox ? data.insidePenaltyArea.add(player.player.id) : data.insidePenaltyArea.delete(player.player.id);

      const previous = data.previousProgress.get(player.player.id) ?? progress;
      const origin = data.runOrigin.get(player.player.id) ?? previous;
      if (progress < origin - 1 || progress - previous < -.2) data.runOrigin.set(player.player.id, progress);
      else if (progress - origin >= 8) { data.progressiveRuns++; data.runOrigin.set(player.player.id, progress); }
      data.previousProgress.set(player.player.id, progress);

      const role = data.roles.get(player.currentRole) ?? { x: 0, y: 0, samples: 0 };
      role.x += player.position.x; role.y += player.position.y; role.samples++;
      data.roles.set(player.currentRole, role);
    }

    const transition = team.collectivePhase.includes("TRANSITION") || team.collectivePhase === "COUNTER_ATTACK";
    const wasTransition = data.previousPhase.includes("TRANSITION") || data.previousPhase === "COUNTER_ATTACK";
    if (transition && !wasTransition) data.transitionStartedAt = state.currentSecond;
    if (!transition && wasTransition && data.transitionStartedAt !== null) {
      data.transitionSeconds += state.currentSecond - data.transitionStartedAt;
      data.transitions++;
      data.transitionStartedAt = null;
    }
    data.previousPhase = team.collectivePhase;

    const owner = state.ball.owner;
    if (owner && opponents.players.includes(owner)) {
      const pressure = team.players.filter(player => !player.currentRole.includes("GOALKEEPER") && player.position.distanceTo(owner.position) <= 8).length;
      const zone = this.progress(owner.position.x, team, state.pitch.length) / state.pitch.length;
      if (zone < 1 / 3) { data.pressureOwn += pressure; data.pressureOwnSamples++; }
      else if (zone > 2 / 3) { data.pressureFinal += pressure; data.pressureFinalSamples++; }
      else { data.pressureMiddle += pressure; data.pressureMiddleSamples++; }
    }
    if (owner && team.players.includes(owner)) {
      if (data.previousBallPosition) data.circulationDistance += Math.hypot(state.ball.visualPosition.x - data.previousBallPosition.x, state.ball.visualPosition.y - data.previousBallPosition.y);
      data.circulationSeconds += deltaTime;
      data.previousBallPosition = { x: state.ball.visualPosition.x, y: state.ball.visualPosition.y };
    } else data.previousBallPosition = null;
  }

  private sector(player: PlayerMatchState): "defence" | "midfield" | "attack" {
    const role = String(player.currentRole);
    if (role.includes("BACK") || role.includes("DEFENDER")) return "defence";
    if (role.includes("STRIKER") || role.includes("FORWARD") || role.includes("WINGER") || role === "FALSE_NINE") return "attack";
    return "midfield";
  }
  private progress(x: number, team: TeamMatchState, length: number): number { return team.attackingDirection === 1 ? x : length - x; }
  private resolve(data: MutableTeamDiagnostics): TeamTacticalDiagnostics {
    const n = Math.max(1, data.samples);
    return {
      averageLineHeight: { defence: round(data.defenceHeight / n), midfield: round(data.midfieldHeight / n), attack: round(data.attackHeight / n) },
      blockWidth: round(data.width / n), blockDepth: round(data.depth / n),
      defenceMidfieldDistance: round(data.defenceMidfield / n), midfieldAttackDistance: round(data.midfieldAttack / n),
      averagePlayersAheadOfBall: round(data.playersAhead / n), finalThirdEntries: data.finalThirdEntries,
      penaltyAreaEntries: data.penaltyAreaEntries, progressiveRuns: data.progressiveRuns,
      averageTransitionSeconds: round(data.transitionSeconds / Math.max(1, data.transitions)),
      ppda: data.defensiveActions ? round(data.opponentPasses / data.defensiveActions) : null,
      pressureByZone: {
        ownThird: round(data.pressureOwn / Math.max(1, data.pressureOwnSamples)),
        middleThird: round(data.pressureMiddle / Math.max(1, data.pressureMiddleSamples)),
        finalThird: round(data.pressureFinal / Math.max(1, data.pressureFinalSamples)),
      },
      averagePositionByRole: Object.fromEntries([...data.roles].map(([role, item]) => [role, { x: round(item.x / item.samples), y: round(item.y / item.samples), samples: item.samples }])),
      ballCirculationSpeed: round(data.circulationDistance / Math.max(.001, data.circulationSeconds)),
    };
  }
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const range = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
const round = (value: number) => Math.round(value * 100) / 100;
