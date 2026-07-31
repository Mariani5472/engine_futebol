import type { MatchEvent } from "../../../../domain";
import type { EventDerivedMatchReport, MatchTimelineEntry, StoredMatchEvent } from "../../analytics/MatchEventStore";
import type { DecisionQualityReport } from "../../decision/DecisionQualityMetrics";
import type { MatchOffensiveFunnel } from "../../diagnostics/OffensiveFunnelCollector";
import type { MatchMetrics } from "../../metrics/MatchMetrics";
import type { ActorObservation } from "../../observation/ObservationSpace";
import type { PlayerActionMask } from "../../policy/PlayerActionSpace";
import type { PolicyDecisionRecord } from "../../policy/PlayerPolicyController";
import type { GoalReplay } from "../../replay/GoalReplayRecorder";
import type { ExecutionManifest } from "../ExecutionManifest";
import type { MatchDiagnosticEvent } from "./MatchDiagnosticEvent";

export interface MatchResult {
  readonly manifest: ExecutionManifest;
  readonly resultHash: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly events: MatchEvent[];
  readonly homeShots: number;
  readonly awayShots: number;
  readonly matchDurationSeconds: number;
  readonly seed: number;
  readonly metrics: MatchMetrics;
  readonly diagnostics: readonly MatchDiagnosticEvent[];
  readonly offensiveFunnel: MatchOffensiveFunnel;
  readonly eventStore: readonly StoredMatchEvent[];
  readonly analytics: EventDerivedMatchReport;
  readonly timeline: readonly MatchTimelineEntry[];
  readonly goalReplays: readonly GoalReplay[];
  readonly decisionQuality: DecisionQualityReport;
  readonly policyDecisions: readonly PolicyDecisionRecord[];
  readonly actionMasks: readonly PlayerActionMask[];
  readonly actorObservations: readonly ActorObservation[];
}
