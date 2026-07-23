import { MatchConfig, Tactic } from "../../../domain";

/**
 * Extended match configuration that includes team tactics.
 * The domain `MatchConfig` defines the immutable match setup;
 * `SimulationConfig` adds the operational tactics for each side.
 *
 * Optional fields are for testing / special scenarios:
 * - `tickDeltaSeconds`: simulation time step per tick (default 0.5s).
 *   Use larger values (e.g. 10) in tests to reduce iteration count.
 * - `maxDurationSeconds`: override match length (default 5400s = 90 min).
 */
export interface SimulationConfig extends MatchConfig {
  readonly homeTactic: Tactic;
  readonly awayTactic: Tactic;
  /** Seconds per simulation tick. Default: 0.5. */
  readonly tickDeltaSeconds?: number;
  /** Total simulated seconds. Default: 5400 (90 min). */
  readonly maxDurationSeconds?: number;
}
