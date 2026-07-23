export interface PerceptionConfig {
  maxPerceptionDistance: number;
  maxVisionAngle: number;
  playerCollisionRadius: number;
}
export const DEFAULT_PERCEPTION_CONFIG: PerceptionConfig = {
  maxPerceptionDistance: 40,
  maxVisionAngle: Math.PI * 0.75,
  playerCollisionRadius: 0.35
};