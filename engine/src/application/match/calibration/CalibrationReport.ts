import {
  BRASILEIRAO_2025_TARGETS,
  CalibrationObservedAverages,
  CalibrationTarget,
} from "./BrasileiraoTargets";

export interface MetricComparison {
  readonly key: string;
  readonly label: string;
  readonly target: number;
  readonly observed: number;
  readonly delta: number;
  readonly relativeError: number;
  readonly tolerance: number;
  readonly withinTolerance: boolean;
}

export interface CalibrationReport {
  readonly matchCount: number;
  readonly seedStart: number;
  readonly averages: CalibrationObservedAverages;
  readonly comparisons: readonly MetricComparison[];
  /** Fraction of targets within their tolerance band (0–1). */
  readonly convergenceScore: number;
  readonly converged: boolean;
}

export function buildCalibrationReport(
  averages: CalibrationObservedAverages,
  matchCount: number,
  seedStart: number,
  targets: readonly CalibrationTarget[] = BRASILEIRAO_2025_TARGETS,
): CalibrationReport {
  const comparisons: MetricComparison[] = targets.map((t) => {
    const observed = t.extract(averages);
    const delta = observed - t.target;
    const relativeError =
      t.target === 0 ? Math.abs(delta) : Math.abs(delta) / t.target;
    return {
      key: t.key,
      label: t.label,
      target: t.target,
      observed: round(observed, 3),
      delta: round(delta, 3),
      relativeError: round(relativeError, 4),
      tolerance: t.tolerance,
      withinTolerance: relativeError <= t.tolerance,
    };
  });

  const hit = comparisons.filter((c) => c.withinTolerance).length;
  const convergenceScore = comparisons.length > 0 ? hit / comparisons.length : 0;
  const primaryKeys = new Set(["goals", "shots", "xG"]);
  const primaryConverged = comparisons
    .filter((c) => primaryKeys.has(c.key))
    .every((c) => c.withinTolerance);

  return {
    matchCount,
    seedStart,
    averages,
    comparisons,
    convergenceScore: round(convergenceScore, 3),
    // Require primary scoring metrics in band; others contribute to score.
    converged: convergenceScore >= 0.7 && primaryConverged,
  };
}

/** Human-readable table for CLI / logs. */
export function formatCalibrationReport(report: CalibrationReport): string {
  const lines: string[] = [
    `Calibration report — ${report.matchCount} matches (seed ${report.seedStart}+)`,
    `Convergence: ${(report.convergenceScore * 100).toFixed(0)}%  ${report.converged ? "✓" : "✗"}`,
    "",
    pad("Métrica", 32) + pad("Meta", 10) + pad("Obs.", 10) + pad("Δ%", 10) + "OK",
    "-".repeat(68),
  ];

  for (const c of report.comparisons) {
    const rel =
      c.target === 0
        ? "n/a"
        : `${(c.relativeError * 100 * Math.sign(c.delta || 1)).toFixed(1)}%`;
    lines.push(
      pad(c.label, 32) +
        pad(c.target.toFixed(2), 10) +
        pad(c.observed.toFixed(2), 10) +
        pad(rel, 10) +
        (c.withinTolerance ? "✓" : "✗"),
    );
  }

  return lines.join("\n");
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
