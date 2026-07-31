import type { MatchEvent } from "../../../domain";
import type { MatchState } from "../../../core/movement/MatchState";
import type { EventDerivedMatchReport, MatchEventStore } from "../analytics/MatchEventStore";
import { DecisionDebug } from "../decision/DecisionDebug";
import { DecisionQualityMetrics } from "../decision/DecisionQualityMetrics";
import type { MatchOffensiveFunnel } from "../diagnostics/OffensiveFunnelCollector";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";
import type { ResolvedInstrumentation } from "../instrumentation/TrainingInstrumentation";
import { buildEventDerivedMatchMetrics } from "../metrics/EventDerivedMatchMetrics";
import type { PlayerPolicyController } from "../policy/PlayerPolicyController";
import type { GoalReplay } from "../replay/GoalReplayRecorder";
import { buildSportingResultHash, type ExecutionManifest } from "./ExecutionManifest";
import type { MatchDiagnosticEvent } from "./contracts/MatchDiagnosticEvent";
import type { MatchResult } from "./contracts/MatchResult";

export interface MatchResultAssembly {
  readonly manifest: ExecutionManifest;
  readonly seed: number;
  readonly state: MatchState;
  readonly instrumentation: ResolvedInstrumentation;
  readonly allEvents: readonly MatchEvent[];
  readonly homeShots: number;
  readonly awayShots: number;
  readonly diagnostics: readonly MatchDiagnosticEvent[];
  readonly offensiveFunnel: MatchOffensiveFunnel;
  readonly tacticalDiagnostics: MatchTacticalDiagnostics;
  readonly eventStore: MatchEventStore;
  readonly analytics: EventDerivedMatchReport;
  readonly goalReplays: readonly GoalReplay[];
  readonly decisionDebug: DecisionDebug;
  readonly policies: PlayerPolicyController;
}

export class MatchResultAssembler {
  public assemble(input: MatchResultAssembly): MatchResult {
    const { state, instrumentation, eventStore, analytics } = input;
    const replayGoalIds = new Set(input.goalReplays.map(replay => replay.goalEventId));
    const metrics = buildEventDerivedMatchMetrics(
      analytics,
      state.home.team.id,
      state.away.team.id,
      input.tacticalDiagnostics,
    );
    const resultHash = buildSportingResultHash({
      seed: input.seed,
      matchDurationSeconds: state.currentSecond,
      homeTeamId: state.home.team.id,
      awayTeamId: state.away.team.id,
      homeScore: state.home.score,
      awayScore: state.away.score,
      authoritativeEvents: eventStore.events(),
      teamAnalytics: analytics.teams,
    });
    return {
      manifest: input.manifest,
      resultHash,
      homeTeamId: state.home.team.id,
      awayTeamId: state.away.team.id,
      homeScore: state.home.score,
      awayScore: state.away.score,
      events: instrumentation.eventHistory ? [...input.allEvents] : [],
      homeShots: input.homeShots,
      awayShots: input.awayShots,
      matchDurationSeconds: state.currentSecond,
      seed: input.seed,
      metrics,
      diagnostics: input.diagnostics,
      offensiveFunnel: input.offensiveFunnel,
      eventStore: instrumentation.eventHistory ? eventStore.events() : [],
      analytics: instrumentation.detailedAnalytics ? analytics : {
        matchId: analytics.matchId,
        teams: analytics.teams,
        players: {},
        possessionIntervals: [],
      },
      timeline: instrumentation.timeline ? eventStore.timeline(replayGoalIds) : [],
      goalReplays: input.goalReplays,
      decisionQuality: new DecisionQualityMetrics().summarize(input.decisionDebug.getEntries()),
      policyDecisions: input.policies.decisions(),
      actionMasks: input.policies.actionMasks(),
      actorObservations: input.policies.actorObservations(),
    };
  }
}
