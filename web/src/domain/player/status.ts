export interface PlayerStatus {
  suspended: boolean;
  suspensionMatches: number;
  injured: boolean;
  injuryMatches: number;
  fatigue: number;
  morale: number;
}

export const DEFAULT_PLAYER_STATUS: PlayerStatus = {
  suspended: false,
  suspensionMatches: 0,
  injured: false,
  injuryMatches: 0,
  fatigue: 0,
  morale: 100,
};

export function isPlayerAvailable(status: PlayerStatus): boolean {
  return (
    !status.suspended &&
    status.suspensionMatches <= 0 &&
    !status.injured &&
    status.injuryMatches <= 0
  );
}

export function clampPlayerStatus(status: PlayerStatus): PlayerStatus {
  return {
    ...status,
    suspensionMatches: Math.max(0, status.suspensionMatches),
    injuryMatches: Math.max(0, status.injuryMatches),
    fatigue: Math.max(0, Math.min(100, status.fatigue)),
    morale: Math.max(0, Math.min(100, status.morale)),
  };
}
