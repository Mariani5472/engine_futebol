import type { PassResolutionRecord, PossessionAcquisitionRecord } from "../../../../core/movement/BallMatchState";
import type { BallTeleportViolation } from "../../diagnostics/BallTeleportDetector";

export type MatchDiagnosticEvent =
  | PossessionAcquisitionRecord
  | PassResolutionRecord
  | BallTeleportViolation;
