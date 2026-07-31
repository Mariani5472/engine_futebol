import type { MatchEvent, MatchPeriod } from "../../../../domain";
import type { MatchState } from "../../../../core/movement/MatchState";
import type { EventDerivedMatchReport, MatchTimelineEntry, StoredMatchEvent } from "../../analytics/MatchEventStore";
import type { DecisionDebugEntry } from "../../decision/DecisionDebug";
import type { MatchOffensiveFunnel } from "../../diagnostics/OffensiveFunnelCollector";
import type { MatchTacticalDiagnostics } from "../../diagnostics/TacticalDiagnosticsCollector";
import type { ActorObservation } from "../../observation/ObservationSpace";
import type { PlayerActionMask } from "../../policy/PlayerActionSpace";
import type { PolicyDecisionRecord } from "../../policy/PlayerPolicyController";
import type { GoalReplay } from "../../replay/GoalReplayRecorder";
import type { ExecutionManifest } from "../ExecutionManifest";
import type { MatchDiagnosticEvent } from "./MatchDiagnosticEvent";
import type { MatchResult } from "./MatchResult";

export interface IncrementalMatchFrame {
  readonly manifest: ExecutionManifest;
  readonly sequence: number;
  readonly period: MatchPeriod;
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly finalResult?: MatchResult;
  readonly tacticalDiagnostics: MatchTacticalDiagnostics;
  readonly diagnostics: readonly MatchDiagnosticEvent[];
  readonly offensiveFunnel: MatchOffensiveFunnel;
  readonly timeline: readonly MatchTimelineEntry[];
  readonly goalReplays: readonly GoalReplay[];
  readonly decisionTrace: readonly DecisionDebugEntry[];
  readonly eventStore: readonly StoredMatchEvent[];
  readonly analytics: EventDerivedMatchReport;
  readonly policyDecisions: readonly PolicyDecisionRecord[];
  readonly actionMasks: readonly PlayerActionMask[];
  readonly actorObservations: readonly ActorObservation[];
}
