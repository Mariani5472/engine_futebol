import { Vector2 } from "../../../../core/geometry/Vector2";
import type { MatchState } from "../../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import type { PlayerSpatioTemporalState } from "./TacticalIntelligenceTypes";

interface Sample { readonly second: number; readonly position: Vector2; readonly velocity: Vector2 }

const HORIZONS = [0.5, 1, 2, 3] as const;
const HISTORY_SECONDS = 3;

/** Deterministic kinematic history shared by perception and tactical reasoning. */
export class SpatioTemporalSystem {
  private readonly history = new Map<string, Sample[]>();

  public update(match: MatchState): ReadonlyMap<string, PlayerSpatioTemporalState> {
    const result = new Map<string, PlayerSpatioTemporalState>();
    for (const player of [...match.home.players, ...match.away.players]) {
      const team = match.home.players.includes(player) ? match.home : match.away;
      const samples = this.history.get(player.player.id) ?? [];
      samples.push({ second: match.currentSecond, position: player.position, velocity: player.velocity });
      while (samples.length > 2 && samples[0].second < match.currentSecond - HISTORY_SECONDS) samples.shift();
      this.history.set(player.player.id, samples);

      const previous = samples.length > 1 ? samples[samples.length - 2] : undefined;
      const elapsed = previous ? Math.max(.001, match.currentSecond - previous.second) : 1;
      const acceleration = previous ? player.velocity.subtract(previous.velocity).multiply(1 / elapsed) : Vector2.zero();
      const prediction = (horizon: number): Vector2 => this.clamp(match,
        player.position.add(player.velocity.multiply(horizon)).add(acceleration.multiply(.5 * horizon * horizon)),
      );
      const topSpeed = this.topSpeed(player);
      result.set(player.player.id, {
        playerId: player.player.id,
        teamId: team.team.id,
        position: player.position,
        velocity: player.velocity,
        acceleration,
        bodyOrientation: player.bodyOrientation,
        recentTrajectory: samples.map(sample => sample.position),
        predictedTrajectory: {
          "0.5": prediction(HORIZONS[0]), "1": prediction(HORIZONS[1]),
          "2": prediction(HORIZONS[2]), "3": prediction(HORIZONS[3]),
        },
        tacticalRole: String(player.currentRole),
        currentIntent: player.intent ?? undefined,
        estimatedReachableArea: {
          center: player.position,
          radiusAtHalfSecond: this.reach(player, topSpeed, .5),
          radiusAtOneSecond: this.reach(player, topSpeed, 1),
          radiusAtTwoSeconds: this.reach(player, topSpeed, 2),
          radiusAtThreeSeconds: this.reach(player, topSpeed, 3),
        },
      });
    }
    return result;
  }

  private reach(player: PlayerMatchState, topSpeed: number, seconds: number): number {
    const acceleration = 2.8 + Number(player.player.attributes.physical.acceleration ?? 10) * .16;
    const initial = Math.min(topSpeed, player.velocity.magnitude());
    return Math.min(topSpeed * seconds, initial * seconds + .5 * acceleration * seconds * seconds);
  }

  private topSpeed(player: PlayerMatchState): number {
    return 5.1 + Number(player.player.attributes.physical.pace ?? 10) / 20 * 3.2;
  }

  private clamp(match: MatchState, point: Vector2): Vector2 {
    return new Vector2(
      Math.max(0, Math.min(match.pitch.length, point.x)),
      Math.max(0, Math.min(match.pitch.width, point.y)),
    );
  }
}
