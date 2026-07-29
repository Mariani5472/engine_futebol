import { Vector2 } from "../../../core/geometry/Vector2";
import { BallState } from "../../../core/movement/BallMatchState";
import type { MatchState, RestartType } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { BallMotionPlanner } from "../physics/BallMotionPlanner";
import { KickoffSystem } from "./KickoffSystem";

const PREPARATION_SECONDS = .75;
const CORNER_DISTANCE = 9.15;
const THROW_IN_DISTANCE = 2;

/** One authoritative rules engine for throw-ins, corners and goal kicks. */
export class RestartSystem {
  private readonly kickoff = new KickoffSystem();

  public setupKickoff(state: MatchState, team: TeamMatchState, matchSecond: number): void {
    this.kickoff.setup(state, team, matchSecond);
  }

  public setup(
    state: MatchState,
    type: RestartType,
    awarded: TeamMatchState,
    position: Vector2,
    matchSecond: number,
  ): void {
    const taker = this.selectTaker(type, awarded, position);
    const receiver = this.selectReceiver(awarded, taker, position);
    const restartPosition = this.clampToFieldLine(state, position);

    for (const player of [...state.home.players, ...state.away.players]) {
      player.hasBall = false;
      player.activeAction = undefined;
      player.activePipeline = undefined;
    }
    taker.position = restartPosition;
    taker.targetPosition = restartPosition;
    taker.velocity = Vector2.zero();

    state.ball.release();
    state.ball.motion = null;
    state.ball.pendingPass = null;
    state.ball.activeShot = null;
    state.ball.restrictedTouchPlayerId = null;
    state.ball.position = restartPosition;
    state.ball.previousPosition = restartPosition;
    state.ball.visualPosition = restartPosition;
    state.ball.velocity = Vector2.zero();
    state.ball.height = 0;
    state.ball.acquirePossession(taker, "RESTART", matchSecond);
    state.ball.state = BallState.CONTROLLED;
    taker.hasBall = true;

    state.restart = {
      type, teamId: awarded.team.id, takerId: taker.player.id,
      receiverId: receiver.player.id,
      position: { x: restartPosition.x, y: restartPosition.y },
      executeAt: matchSecond + PREPARATION_SECONDS,
      launched: false,
    };
    this.enforceWaitingPositions(state);
  }

  /** True while regular decisions must remain locked. */
  public update(state: MatchState): boolean {
    return this.kickoff.update(state) || this.updateSetPiece(state);
  }

  private updateSetPiece(state: MatchState): boolean {
    const restart = state.restart;
    if (!restart) return false;
    const taker = this.player(state, restart.takerId);
    const receiver = this.player(state, restart.receiverId);
    if (!restart.launched && state.currentSecond + 1e-9 >= restart.executeAt) {
      const origin = state.ball.position;
      const kind = restart.type === "CORNER" ? "CROSS"
        : restart.type === "THROW_IN" ? "AERIAL_PASS" : "GROUND_PASS";
      BallMotionPlanner.start(state.ball, {
        kind, origin, target: receiver.position,
        speed: restart.type === "GOAL_KICK" ? 18 : 12,
        peakHeight: restart.type === "CORNER" ? 4 : restart.type === "THROW_IN" ? 2.1 : 0,
        intendedReceiverId: receiver.player.id,
      });
      state.ball.noteTouch(taker.player.id);
      state.ball.pendingPass = {
        passerId: taker.player.id,
        intendedReceiverId: receiver.player.id,
        teammateIds:this.team(state,restart.teamId).players.map(player=>player.player.id),
        startedAtSecond: state.currentSecond,
        realForwardGain: (receiver.position.x - taker.position.x) * this.team(state, restart.teamId).attackingDirection,
        statisticalAttemptRecorded: false,
      };
      state.ball.restrictedTouchPlayerId = taker.player.id;
      restart.launched = true;
      return false;
    }

    if (restart.launched && (!state.ball.restrictedTouchPlayerId || (state.ball.owner && state.ball.owner !== taker))) {
      state.restart = null;
      return false;
    }
    return !restart.launched;
  }

  public enforceWaitingPositions(state: MatchState): void {
    this.kickoff.enforceWaitingPositions(state);
    const restart = state.restart;
    if (!restart || restart.launched) return;
    const awarded = this.team(state, restart.teamId);
    const opponents = awarded === state.home ? state.away : state.home;
    const taker = this.player(state, restart.takerId);
    const position = new Vector2(restart.position.x, restart.position.y);
    taker.position = position;
    taker.targetPosition = position;
    taker.velocity = Vector2.zero();
    state.ball.position = position;
    state.ball.visualPosition = position;
    state.ball.velocity = Vector2.zero();
    state.ball.controlOffset = Vector2.zero();

    if (restart.type === "GOAL_KICK") this.keepOutsidePenaltyArea(state, opponents, position.x);
    else this.keepMinimumDistance(state, opponents, position, restart.type === "CORNER" ? CORNER_DISTANCE : THROW_IN_DISTANCE);
  }

  private keepMinimumDistance(state: MatchState, team: TeamMatchState, position: Vector2, minimum: number): void {
    const centre = new Vector2(state.pitch.length / 2, state.pitch.width / 2);
    for (const player of team.players) {
      const offset = player.position.subtract(position);
      if (offset.magnitude() >= minimum) continue;
      const direction = offset.magnitude() > .01 ? offset.normalize() : centre.subtract(position).normalize();
      player.position = this.clampInside(state, position.add(direction.multiply(minimum)));
      player.targetPosition = player.position;
      player.velocity = Vector2.zero();
    }
  }

  private keepOutsidePenaltyArea(state: MatchState, opponents: TeamMatchState, restartX: number): void {
    const area = restartX < state.pitch.length / 2 ? state.pitch.geometry.penaltyAreaLeft : state.pitch.geometry.penaltyAreaRight;
    for (const player of opponents.players) {
      const inside = player.position.x >= area.x && player.position.x <= area.x + area.width
        && player.position.y >= area.y && player.position.y <= area.y + area.height;
      if (!inside) continue;
      const x = restartX < state.pitch.length / 2 ? area.x + area.width + .5 : area.x - .5;
      player.position = new Vector2(x, player.position.y);
      player.targetPosition = player.position;
      player.velocity = Vector2.zero();
    }
  }

  private selectTaker(type: RestartType, team: TeamMatchState, position: Vector2): PlayerMatchState {
    const preferred = type === "GOAL_KICK"
      ? team.players.filter(player => player.currentRole.includes("GOALKEEPER"))
      : team.players.filter(player => !player.currentRole.includes("GOALKEEPER"));
    return (preferred.length ? preferred : team.players)
      .slice().sort((a, b) => a.position.distanceTo(position) - b.position.distanceTo(position))[0];
  }

  private selectReceiver(team: TeamMatchState, taker: PlayerMatchState, position: Vector2): PlayerMatchState {
    return team.players.filter(player => player !== taker && !player.currentRole.includes("GOALKEEPER"))
      .slice().sort((a, b) => a.position.distanceTo(position) - b.position.distanceTo(position))[0]
      ?? team.players.find(player => player !== taker)
      // Minimal diagnostic fixtures may contain one player only. Production
      // matches always have teammates; retaining the taker here lets setup
      // remain total without manufacturing another player or teleporting ball.
      ?? taker;
  }

  private clampToFieldLine(state: MatchState, position: Vector2): Vector2 {
    return new Vector2(
      Math.max(0, Math.min(state.pitch.length, position.x)),
      Math.max(0, Math.min(state.pitch.width, position.y)),
    );
  }

  private clampInside(state: MatchState, position: Vector2): Vector2 {
    return new Vector2(
      Math.max(.5, Math.min(state.pitch.length - .5, position.x)),
      Math.max(.5, Math.min(state.pitch.width - .5, position.y)),
    );
  }

  private team(state: MatchState, id: string): TeamMatchState {
    return id === state.home.team.id ? state.home : state.away;
  }

  private player(state: MatchState, id: string): PlayerMatchState {
    const player = [...state.home.players, ...state.away.players].find(candidate => candidate.player.id === id);
    if (!player) throw new Error(`Restart player ${id} not found`);
    return player;
  }
}
