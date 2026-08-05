export {
  BRASILEIRAO_2025_TARGETS,
} from "./BrasileiraoTargets";
export type {
  CalibrationTarget,
  CalibrationObservedAverages,
} from "./BrasileiraoTargets";

export {
  buildCalibrationReport,
  formatCalibrationReport,
} from "./CalibrationReport";
export type {
  CalibrationReport,
  MetricComparison,
} from "./CalibrationReport";

export { CalibrationRunner, averageShotOutcomes, calibrationDistribution, calibrationResultFromSamples } from "./CalibrationRunner";
export type {
  CalibrationRunOptions,
  CalibrationBatchResult,
  MatchSample,
  ShotOutcomeSample,
  AverageShotOutcomes,
  CalibrationDistribution,
} from "./CalibrationRunner";

export {
  DEFAULT_CALIBRATION_PARAMETERS,
  ENGINE_CALIBRATION_PARAMETERS,
  suggestAdjustments,
} from "./CalibrationParameters";
export type { CalibrationParameters } from "./CalibrationParameters";
