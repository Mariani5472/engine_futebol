import { MatchConfig, Tactic } from "../../../domain";
import type { InstrumentationSelection } from "../instrumentation/TrainingInstrumentation";
import type { MatchScenarioConfig } from "../scenario/MatchScenario";

/**
 * Extended match configuration that includes team tactics.
 * The domain `MatchConfig` defines the immutable match setup;
 * `SimulationConfig` adds the operational tactics for each side.
 *
 * Optional fields are for testing / special scenarios:
 * - `tickDeltaSeconds`: simulation time step per tick (official default 0.05s).
 *   Use larger values (e.g. 10) in tests to reduce iteration count.
 * - `maxDurationSeconds`: override match length (default 5400s = 90 min).
 */
export interface SimulationConfig extends MatchConfig {
  readonly homeTactic: Tactic;
  readonly awayTactic: Tactic;
  /** Seconds per simulation tick. Official default: 0.05 (20 Hz). */
  readonly tickDeltaSeconds?: number;
  /** Total simulated seconds. Default: 5400 (90 min). */
  readonly maxDurationSeconds?: number;
  /** Retain complete candidate/rejection traces in incremental snapshots. */
  readonly debugDecisions?:boolean;
  /** Observability only; profiles must never alter sporting behaviour. */
  readonly instrumentation?: InstrumentationSelection;
  /** Optional deterministic training/evaluation scenario. */
  readonly scenario?: MatchScenarioConfig;
}
