import { Vector2 } from "../../../core/geometry/Vector2";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { FieldThirdResolver } from "../../../core/pitch/FieldThirdResolver";
import { FieldThird } from "../../../domain";
import { DecisionType } from "../decision/DecisionType";
import { PlayerAwareness } from "./memory/PlayerAwareness";
import {
  NearestOpponent,
  PassingLane,
  SupportPlayer,
  WorldAwareness,
} from "./WorldAwareness";

const PRESSURE_RADIUS = 8;
const NEAREST_SEARCH_RADIUS = 30;
// Includes the defender's immediate step/reach during ball flight, not only
// the centre point occupied at decision time.
const PASS_LANE_OBSTACLE_RADIUS = 1.65;

/**
 * Builds a WorldAwareness snapshot for a single player.
 *
 * Passing lanes intentionally use LIVE teammate positions. Using stale memory
 * produced high forwardProgress while the real receiver was still deep,
 * causing avgPassFP ~30–40m with attacking-third possession ~0.5%.
 */
export class WorldAwarenessSystem {
  private readonly thirdResolver: FieldThirdResolver;

  constructor(pitchLength: number = 105) {
    this.thirdResolver = new FieldThirdResolver(pitchLength);
  }

  public build(
    match: MatchState,
    player: PlayerMatchState,
    awareness?: PlayerAwareness,
  ): WorldAwareness {
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opposing = isHome ? match.away : match.home;
    const attackingDirection = team.attackingDirection;

    const teammates = team.players.filter((p) => p !== player);
    const opponents = opposing.players;

    const nearest = this.findNearestOpponent(player, opponents);
    const pressure = this.calculatePressure(player, opponents);
    const nearestDistance = nearest?.distance ?? Infinity;

    const goalCenter = this.getGoalCenter(match, attackingDirection);
    const goalDistance = player.position.distanceTo(goalCenter);
    const goalAngleQuality = this.calculateGoalAngleQuality(
      player.position,
      match.pitch.width,
    );

    const fieldThird = this.thirdResolver.resolve(
      player.position,
      attackingDirection,
    );

    const supportPlayers = this.buildSupportPlayers(
      player,
      teammates,
      attackingDirection,
    );

    const passingLanes = this.buildPassingLanes(
      player,
      teammates,
      opponents,
      attackingDirection,
      awareness,
    );

    const freeSpace = this.calculateFreeSpace(nearestDistance, pressure);
    const offsideRisk = this.calculateOffsideRisk(
      player,
      teammates,
      opponents,
      attackingDirection,
      match.pitch.length,
    );
    const crossOpportunity = this.calculateCrossOpportunity(
      player,
      match,
      attackingDirection,
      fieldThird,
      supportPlayers,
    );
    const shotWindow = this.calculateShotWindow(
      goalDistance,
      goalAngleQuality,
      pressure,
      fieldThird,
    );

    return new WorldAwareness(
      nearest,
      pressure,
      nearestDistance,
      goalDistance,
      goalCenter,
      goalAngleQuality,
      fieldThird,
      attackingDirection,
      isHome,
      supportPlayers,
      passingLanes,
      freeSpace,
      offsideRisk,
      crossOpportunity,
      shotWindow,
      opponents,
      teammates,
    );
  }

  private findNearestOpponent(
    player: PlayerMatchState,
    opponents: readonly PlayerMatchState[],
  ): NearestOpponent | undefined {
    let best: NearestOpponent | undefined;

    for (const opp of opponents) {
      const distance = player.position.distanceTo(opp.position);
      if (distance > NEAREST_SEARCH_RADIUS) continue;
      if (best && distance >= best.distance) continue;

      best = {
        playerId: opp.player.id,
        position: opp.position,
        distance,
        isTackling: opp.activeAction?.type === DecisionType.TACKLE,
      };
    }

    return best;
  }

  private calculatePressure(
    player: PlayerMatchState,
    opponents: readonly PlayerMatchState[],
  ): number {
    let pressure = 0;

    for (const opp of opponents) {
      const distance = player.position.distanceTo(opp.position);
      if (distance > PRESSURE_RADIUS) continue;

      const proximity = Math.max(0, 1 - distance / PRESSURE_RADIUS);
      pressure = Math.max(pressure, proximity);

      if (opp.activeAction?.type === DecisionType.TACKLE) {
        pressure = Math.max(pressure, Math.max(0.75, proximity));
      }
    }

    return Math.max(0, Math.min(1, pressure));
  }

  private getGoalCenter(
    match: MatchState,
    attackingDirection: 1 | -1,
  ): Vector2 {
    const goal =
      attackingDirection === 1
        ? match.pitch.geometry.rightGoal
        : match.pitch.geometry.leftGoal;
    return new Vector2(goal.center.x, goal.center.y);
  }

  private calculateGoalAngleQuality(
    playerPos: Vector2,
    pitchWidth: number,
  ): number {
    const centreY = pitchWidth / 2;
    const deviation = Math.abs(playerPos.y - centreY);
    const maxDeviation = pitchWidth / 2;
    return Math.max(0, Math.min(1, 1 - deviation / maxDeviation));
  }

  private buildSupportPlayers(
    player: PlayerMatchState,
    teammates: readonly PlayerMatchState[],
    attackingDirection: 1 | -1,
  ): SupportPlayer[] {
    const supports: SupportPlayer[] = teammates.map((tm) => {
      const distance = player.position.distanceTo(tm.position);
      const forwardProgress =
        (tm.position.x - player.position.x) * attackingDirection;
      return {
        playerId: tm.player.id,
        position: tm.position,
        distance,
        forwardProgress,
      };
    });

    supports.sort((a, b) => a.distance - b.distance);
    return supports;
  }

  private buildPassingLanes(
    player: PlayerMatchState,
    teammates: readonly PlayerMatchState[],
    opponents: readonly PlayerMatchState[],
    attackingDirection: 1 | -1,
    awareness?: PlayerAwareness,
  ): PassingLane[] {
    const lanes: PassingLane[] = [];

    // Live positions for geometry / forwardProgress. Certainty may still come
    // from memory when present (imperfect knowledge without false progress).
    for (const tm of teammates) {
      const livePos = tm.position;
      const distance = player.position.distanceTo(livePos);
      const forwardProgress =
        (livePos.x - player.position.x) * attackingDirection;
      const clear = this.isLaneClear(player.position, livePos, opponents);

      let certainty = 1;
      if (awareness) {
        const mem = awareness.teammates.get(tm.player.id);
        if (mem) certainty = Math.max(0.35, mem.certainty);
      }

      lanes.push({
        targetId: tm.player.id,
        targetPosition: livePos,
        distance,
        clear,
        forwardProgress,
        certainty,
      });
    }

    lanes.sort((a, b) => a.distance - b.distance);
    return lanes;
  }

  private isLaneClear(
    from: Vector2,
    to: Vector2,
    opponents: readonly PlayerMatchState[],
  ): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return true;

    for (const opp of opponents) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((opp.position.x - from.x) * dx + (opp.position.y - from.y) * dy) /
            (len * len),
        ),
      );
      // Ignore pressure virtually on top of the passer, which is handled by
      // the action's pressure model. Do not ignore the receiver endpoint: a
      // marker beside the target is precisely what makes a pass unsafe.
      if (t < 0.08) continue;

      const projX = from.x + t * dx;
      const projY = from.y + t * dy;
      const dist = Math.hypot(opp.position.x - projX, opp.position.y - projY);
      const requiredClearance = t > .8 ? 2.6 : PASS_LANE_OBSTACLE_RADIUS;
      if (dist < requiredClearance) return false;
    }

    return true;
  }

  private calculateFreeSpace(
    nearestDistance: number,
    pressure: number,
  ): number {
    if (!Number.isFinite(nearestDistance)) return 1;
    const distanceFactor = Math.max(0, Math.min(1, nearestDistance / PRESSURE_RADIUS));
    return Math.max(0, Math.min(1, distanceFactor * (1 - pressure * 0.5)));
  }

  private calculateOffsideRisk(
    player: PlayerMatchState,
    teammates: readonly PlayerMatchState[],
    opponents: readonly PlayerMatchState[],
    attackingDirection: 1 | -1,
    pitchLength: number,
  ): number {
    if (opponents.length === 0) return 0;

    const defenderDepths = opponents
      .map((o) => o.position.x * attackingDirection)
      .sort((a, b) => b - a);

    const offsideLine =
      defenderDepths.length >= 2 ? defenderDepths[1] : defenderDepths[0];

    const halfLength = pitchLength / 2;
    const halfway = halfLength * attackingDirection;

    let atRisk = 0;
    let counted = 0;

    for (const tm of teammates) {
      const depth = tm.position.x * attackingDirection;
      if (depth < halfway) continue;
      counted++;
      if (depth > offsideLine) atRisk++;
    }

    if (counted === 0) return 0;
    return Math.max(0, Math.min(1, atRisk / counted));
  }

  private calculateCrossOpportunity(
    player: PlayerMatchState,
    match: MatchState,
    attackingDirection: 1 | -1,
    fieldThird: FieldThird,
    supportPlayers: readonly SupportPlayer[],
  ): number {
    if (fieldThird !== FieldThird.ATTACKING && String(fieldThird) !== "ATTACKING") {
      return 0;
    }

    const pitch = match.pitch;
    const forwardDistance =
      attackingDirection === 1
        ? pitch.length - player.position.x
        : player.position.x;
    const lateralDistance = Math.abs(player.position.y - pitch.width / 2);

    if (forwardDistance > 40) return 0;
    if (lateralDistance < pitch.width * 0.18) return 0;

    const widthFactor = Math.min(1, lateralDistance / (pitch.width * 0.35));
    const depthFactor = Math.max(0, 1 - forwardDistance / 40);

    const centralTargets = supportPlayers.filter(
      (s) =>
        s.forwardProgress > -5 &&
        Math.abs(s.position.y - pitch.width / 2) < pitch.width * 0.25,
    );
    const targetFactor = centralTargets.length > 0 ? 1 : 0.25;

    return Math.max(
      0,
      Math.min(1, widthFactor * 0.4 + depthFactor * 0.35 + targetFactor * 0.25),
    );
  }

  private calculateShotWindow(
    goalDistance: number,
    goalAngleQuality: number,
    pressure: number,
    fieldThird: FieldThird,
  ): number {
    let distanceQuality: number;
    if (goalDistance <= 6) distanceQuality = 1;
    else if (goalDistance <= 12) distanceQuality = 0.9;
    else if (goalDistance <= 18) distanceQuality = 0.7;
    else if (goalDistance <= 25) distanceQuality = 0.45;
    else if (goalDistance <= 32) distanceQuality = 0.2;
    else distanceQuality = 0.05;

    const thirdBonus =
      fieldThird === FieldThird.ATTACKING || String(fieldThird) === "ATTACKING"
        ? 1
        : fieldThird === FieldThird.MIDDLE || String(fieldThird) === "MIDDLE"
          ? 0.4
          : 0.1;

    const spaceFactor = 1 - pressure * 0.55;

    return Math.max(
      0,
      Math.min(
        1,
        distanceQuality * 0.45 +
          goalAngleQuality * 0.25 +
          thirdBonus * 0.15 +
          spaceFactor * 0.15,
      ),
    );
  }
}
