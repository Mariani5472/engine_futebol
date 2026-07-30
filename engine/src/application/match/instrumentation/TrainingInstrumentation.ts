export type InstrumentationProfile = "DEBUG" | "EVALUATION" | "TRAINING" | "BENCHMARK";

export interface TrainingInstrumentationConfig {
  readonly replay: boolean;
  readonly timeline: boolean;
  readonly debugSnapshots: boolean;
  readonly diagnostics: boolean;
  readonly eventHistory: boolean;
  readonly detailedAnalytics: boolean;
  readonly experienceRecording: boolean;
}

export interface InstrumentationSelection {
  readonly profile?: InstrumentationProfile;
  readonly overrides?: Partial<TrainingInstrumentationConfig>;
}

export interface ResolvedInstrumentation extends TrainingInstrumentationConfig {
  readonly profile: InstrumentationProfile;
}

const PROFILES: Readonly<Record<InstrumentationProfile, TrainingInstrumentationConfig>> = {
  DEBUG: {
    replay: true, timeline: true, debugSnapshots: true, diagnostics: true,
    eventHistory: true, detailedAnalytics: true, experienceRecording: true,
  },
  EVALUATION: {
    replay: true, timeline: true, debugSnapshots: false, diagnostics: true,
    eventHistory: true, detailedAnalytics: true, experienceRecording: false,
  },
  TRAINING: {
    replay: false, timeline: false, debugSnapshots: false, diagnostics: false,
    eventHistory: false, detailedAnalytics: false, experienceRecording: true,
  },
  BENCHMARK: {
    replay: false, timeline: false, debugSnapshots: false, diagnostics: false,
    eventHistory: false, detailedAnalytics: false, experienceRecording: false,
  },
};

export function resolveInstrumentation(
  selection?: InstrumentationSelection,
  legacyDebugDecisions = false,
): ResolvedInstrumentation {
  const profile = selection?.profile ?? "EVALUATION";
  const base = PROFILES[profile];
  return {
    profile,
    ...base,
    ...selection?.overrides,
    debugSnapshots: legacyDebugDecisions || selection?.overrides?.debugSnapshots || base.debugSnapshots,
  };
}

export function instrumentationProfile(profile: InstrumentationProfile): TrainingInstrumentationConfig {
  return { ...PROFILES[profile] };
}
