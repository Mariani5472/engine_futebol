import { Vector2 } from "../../../../core/geometry/Vector2";
import type { MatchState } from "../../../../core/movement/MatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";
import type { PlayerSpatioTemporalState, SpaceKind, SpaceOpportunity, TacticalLane } from "./TacticalIntelligenceTypes";

/** Coarse space-time field. It predicts whether a cell will open or close before arrival. */
export class SpaceAnalysisSystem {
  public analyze(
    match: MatchState,
    team: TeamMatchState,
    players: ReadonlyMap<string, PlayerSpatioTemporalState>,
  ): { spaces: SpaceOpportunity[]; passingLanes: TacticalLane[]; runningLanes: TacticalLane[] } {
    const own = team.players.map(player => players.get(player.player.id)!).filter(Boolean);
    const opponentTeam = team === match.home ? match.away : match.home;
    const opponents = opponentTeam.players.map(player => players.get(player.player.id)!).filter(Boolean);
    const spaces: SpaceOpportunity[] = [];
    const columns = 6;
    const rows = 4;
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const center = new Vector2(
          (column + .5) * match.pitch.length / columns,
          (row + .5) * match.pitch.width / rows,
        );
        const nearestNow = this.nearest(center, opponents, "now");
        const nearestFuture = this.nearest(center, opponents, "future");
        const pressure = clamp(1 - nearestNow / 10, 0, 1);
        const futurePressure = clamp(1 - nearestFuture / 10, 0, 1);
        const progress = team.attackingDirection === 1
          ? center.x / match.pitch.length
          : 1 - center.x / match.pitch.length;
        const kind = this.classify(match, center, progress, pressure, futurePressure, row, own, opponents, team);
        const reachablePlayers = own.filter(player =>
          player.position.distanceTo(center) <= player.estimatedReachableArea.radiusAtThreeSeconds + 2,
        ).map(player => player.playerId);
        if (!reachablePlayers.length && pressure > .72 && kind === "currentlyFree") continue;
        spaces.push({
          id: `${team.team.id}:${column}:${row}`,
          kind,
          center,
          radius: Math.min(match.pitch.length / columns, match.pitch.width / rows) * .45,
          availableFrom: futurePressure + .08 < pressure ? .5 : 0,
          availableUntil: futurePressure > pressure + .12 ? .8 : 3,
          occupationRisk: futurePressure,
          defensivePressure: pressure,
          progressionValue: clamp(progress * (1 - futurePressure), 0, 1),
          shotCreationValue: clamp((progress - .55) * 2.2 * (1 - futurePressure), 0, 1),
          possessionValue: clamp(1 - futurePressure * .75, 0, 1),
          reachablePlayers,
        });
      }
    }

    const passingLanes = this.playerLanes(team, own, opponents);
    const runningLanes = spaces
      .filter(space => space.reachablePlayers.length > 0 && space.occupationRisk < .72)
      .flatMap(space => space.reachablePlayers.slice(0, 2).map(playerId => {
        const player = players.get(playerId)!;
        return {
          fromPlayerId: playerId,
          target: space.center,
          arrivalMargin: this.nearest(space.center, opponents, "future") - player.predictedTrajectory["2"].distanceTo(space.center),
          progression: (space.center.x - player.position.x) * team.attackingDirection,
          clearAtArrival: space.occupationRisk < .55,
        } satisfies TacticalLane;
      }));
    return { spaces, passingLanes, runningLanes };
  }

  private playerLanes(
    team: TeamMatchState,
    own: readonly PlayerSpatioTemporalState[],
    opponents: readonly PlayerSpatioTemporalState[],
  ): TacticalLane[] {
    const lanes: TacticalLane[] = [];
    for (const from of own) for (const to of own) {
      if (from === to) continue;
      const target = to.predictedTrajectory["1"];
      const distance = from.position.distanceTo(target);
      if (distance > 45) continue;
      const ballEta = Math.max(.2, distance / (8 + Math.min(20, distance * .45)));
      const defenderEta = Math.min(...opponents.map(opponent => this.arrival(opponent, target)), 99);
      const receiverEta = this.arrival(to, target);
      const margin = defenderEta - Math.max(ballEta, receiverEta);
      lanes.push({
        fromPlayerId: from.playerId,
        toPlayerId: to.playerId,
        target,
        arrivalMargin: margin,
        progression: (target.x - from.position.x) * team.attackingDirection,
        clearAtArrival: margin > .12,
      });
    }
    return lanes;
  }

  private arrival(player: PlayerSpatioTemporalState, target: Vector2): number {
    const distance = player.position.distanceTo(target);
    const radius = player.estimatedReachableArea.radiusAtThreeSeconds;
    return radius <= .01 ? 99 : Math.min(3, distance / (radius / 3));
  }

  private nearest(point: Vector2, states: readonly PlayerSpatioTemporalState[], mode: "now" | "future"): number {
    return Math.min(...states.map(state => point.distanceTo(mode === "now" ? state.position : state.predictedTrajectory["1"])), 99);
  }

  private classify(
    match: MatchState,
    center: Vector2,
    progress: number,
    pressure: number,
    futurePressure: number,
    row: number,
    own: readonly PlayerSpatioTemporalState[],
    opponents: readonly PlayerSpatioTemporalState[],
    team: TeamMatchState,
  ): SpaceKind {
    if (futurePressure > pressure + .14) return "closing";
    if (pressure > futurePressure + .14) return "emerging";
    if (progress > .78 && Math.abs(center.y - match.pitch.width / 2) < 13) return "shootingZone";
    if (progress > .68 && (row === 0 || row === 3)) return "crossingZone";
    const defensiveLine = opponents.map(player => player.position.x * team.attackingDirection).sort((a,b)=>b-a)[1];
    if (defensiveLine !== undefined && center.x * team.attackingDirection > defensiveLine + 2) return "behindDefence";
    if (progress > .35 && progress < .72 && Math.abs(center.y - match.pitch.width / 2) < 12) return "betweenLines";
    const ballOnLeft = match.ball.position.y < match.pitch.width / 2;
    if ((ballOnLeft && row >= 2) || (!ballOnLeft && row <= 1)) return "weakSide";
    const nearbyOwn = own.filter(player => player.position.distanceTo(center) < 9).length;
    if (progress < .35 && pressure > .4) return "turnoverDanger";
    if (!match.ball.owner && center.distanceTo(match.ball.position) < 10) return "secondBall";
    if (nearbyOwn === 0 && futurePressure < .45) return "progressionLane";
    return "currentlyFree";
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
