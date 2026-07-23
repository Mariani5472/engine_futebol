import { Vector2 } from "../../../core/geometry/Vector2";
import { BallMatchState, BallState } from "../../../core/movement/BallMatchState";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { Pitch, Player, Tactic, TacticalShapeAssignment, Team } from "../../../domain";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { SimulationConfig } from "./SimulationConfig";

export interface InitializedMatch {
  readonly state: MatchState;
  readonly awarenessMap: Map<string, PlayerAwareness>;
}

export class MatchInitializer {

  public initialize(config: SimulationConfig): InitializedMatch {

    const pitch = config.pitch;

    const homeState = this.initTeam(
      config.homeTeam,
      config.homeTactic,
      1,
      pitch,
      false
    );

    const awayState = this.initTeam(
      config.awayTeam,
      config.awayTactic,
      -1,
      pitch,
      true
    );

    const ball = new BallMatchState(
      new Vector2(pitch.length / 2, pitch.width / 2),
      Vector2.zero(),
      null,
      BallState.FREE,
      0
    );

    const state = new MatchState(
      homeState,
      awayState,
      ball,
      pitch,
      0,
      homeState, // home attacks first by convention
      awayState
    );

    const awarenessMap = new Map<string, PlayerAwareness>();
    for (const p of [...homeState.players, ...awayState.players]) {
      awarenessMap.set(p.player.id, PlayerAwareness.create(p.player.id));
    }

    return { state, awarenessMap };
  }

  private initTeam(
    team: Team,
    tactic: Tactic,
    attackingDirection: 1 | -1,
    pitch: Pitch,
    mirror: boolean
  ): TeamMatchState {

    const assignments = tactic.defensiveShape.assignments;
    const players: PlayerMatchState[] = [];

    const sortedPlayers = this.sortPlayersByPosition(team.players);

    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      const assignment = assignments[i] ?? assignments[assignments.length - 1];

      const position = this.resolvePosition(assignment, pitch, mirror);
      const role = assignment.role;

      players.push(
        new PlayerMatchState(
          player,
          position,
          Vector2.zero(),
          100,   // stamina
          0,     // fatigue
          false, // hasBall
          role,
          position,
          new Vector2(attackingDirection, 0)
        )
      );
    }

    return new TeamMatchState(team, attackingDirection, players, tactic, 0);
  }

  private resolvePosition(
    assignment: TacticalShapeAssignment,
    pitch: Pitch,
    mirror: boolean
  ): Vector2 {

    const anchor = assignment.defensiveAnchor;
    const x = mirror ? pitch.length - anchor.x : anchor.x;
    const y = anchor.y;

    return new Vector2(
      Math.max(0, Math.min(pitch.length, x)),
      Math.max(0, Math.min(pitch.width, y))
    );
  }

  /**
   * Orders players so GKs appear first, then defenders, midfielders, strikers.
   * This matches them to tactical shape assignments in the correct order.
   */
  private sortPlayersByPosition(players: readonly Player[]): Player[] {
    const order: Record<string, number> = {
      GK: 0, DC: 1, DL: 1, DR: 1, WBL: 2, WBR: 2,
      DM: 3, MC: 4, ML: 4, MR: 4, AMC: 5, WL: 5, WR: 5, ST: 6
    };

    return [...players].sort((a, b) => {
      const aPos = a.positions[0] ?? "MC";
      const bPos = b.positions[0] ?? "MC";
      return (order[aPos] ?? 4) - (order[bPos] ?? 4);
    });
  }
}
