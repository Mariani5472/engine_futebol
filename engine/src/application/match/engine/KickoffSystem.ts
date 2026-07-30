import { Vector2 } from "../../../core/geometry/Vector2";
import { BallState } from "../../../core/movement/BallMatchState";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { BallMotionPlanner } from "../physics/BallMotionPlanner";

const PREPARATION_SECONDS = .75;
const CENTRE_CIRCLE_RADIUS = 9.15;
const OPPONENT_CLEARANCE = CENTRE_CIRCLE_RADIUS + .85;

/** Enforces the laws and deterministic choreography of every kickoff. */
export class KickoffSystem {
  public setup(state: MatchState, takingTeam: TeamMatchState, matchSecond: number): void {
    const defendingTeam = takingTeam === state.home ? state.away : state.home;
    this.resetShape(state, state.home);
    this.resetShape(state, state.away);

    const centre = new Vector2(state.pitch.length / 2, state.pitch.width / 2);
    const taker = this.selectTaker(takingTeam);
    const receiver = this.selectReceiver(takingTeam, taker);
    const dir = takingTeam.attackingDirection;
    taker.position = centre.add(new Vector2(-dir * .7, 0));
    receiver.position = centre.add(new Vector2(-dir * 6, 4));
    taker.targetPosition = taker.position;
    receiver.targetPosition = receiver.position;

    this.keepTeamInOwnHalf(state, takingTeam, taker);
    this.keepTeamInOwnHalf(state, defendingTeam);
    this.clearCentreCircle(state, defendingTeam);
    for (const player of [...state.home.players, ...state.away.players]) {
      player.velocity = Vector2.zero();
      player.activeAction = undefined;
      player.activePipeline = undefined;
      player.hasBall = false;
    }

    state.ball.release();
    state.ball.position = centre;
    state.ball.previousPosition = centre;
    state.ball.visualPosition = centre;
    state.ball.velocity = Vector2.zero();
    state.ball.visualVelocity = Vector2.zero();
    state.ball.height = 0;
    state.ball.motion = null;
    state.ball.pendingPass = null;
    taker.hasBall = true;
    state.ball.acquirePossession(taker, "RESTART", matchSecond);
    state.ball.state = BallState.CONTROLLED;
    state.attackingTeam = takingTeam;
    state.defendingTeam = defendingTeam;
    state.kickoff = {
      teamId: takingTeam.team.id,
      takerId: taker.player.id,
      receiverId: receiver.player.id,
      executeAt: matchSecond + PREPARATION_SECONDS,
      launched: false,
    };
  }

  /** Returns true while normal decisions must remain locked. */
  public update(state: MatchState): boolean {
    const kickoff = state.kickoff;
    if (!kickoff) return false;
    const taker = this.player(state, kickoff.takerId);
    const receiver = this.player(state, kickoff.receiverId);

    if (!kickoff.launched && state.currentSecond + 1e-9 >= kickoff.executeAt) {
      const origin = state.ball.position;
      state.ball.noteTouch(taker.player.id);
      BallMotionPlanner.start(state.ball, {
        kind: "GROUND_PASS", origin, target: receiver.position, speed: 10,
        intendedReceiverId: receiver.player.id,
      });
      state.ball.pendingPass = {
        passerId: taker.player.id,
        intendedReceiverId: receiver.player.id,
        teammateIds:state.attackingTeam.players.map(player=>player.player.id),
        startedAtSecond: state.currentSecond,
        realForwardGain: (receiver.position.x - taker.position.x) * state.attackingTeam.attackingDirection,
        statisticalAttemptRecorded: false,
      };
      kickoff.launched = true;
      return false;
    }

    if (kickoff.launched && state.ball.owner && state.ball.owner !== taker) {
      state.kickoff = null;
      return false;
    }
    return !kickoff.launched;
  }

  public enforceWaitingPositions(state: MatchState): void {
    const kickoff = state.kickoff;
    if (!kickoff || kickoff.launched) return;
    const takingTeam = kickoff.teamId === state.home.team.id ? state.home : state.away;
    const defendingTeam = takingTeam === state.home ? state.away : state.home;
    const taker = this.player(state, kickoff.takerId);
    const receiver = this.player(state, kickoff.receiverId);
    const centre = new Vector2(state.pitch.length / 2, state.pitch.width / 2);
    const dir = takingTeam.attackingDirection;
    const takerPosition = centre.add(new Vector2(-dir * .7, 0));
    const receiverPosition = centre.add(new Vector2(-dir * 6, 4));

    taker.position = takerPosition;
    taker.targetPosition = takerPosition;
    taker.velocity = Vector2.zero();
    receiver.position = receiverPosition;
    receiver.targetPosition = receiverPosition;
    receiver.velocity = Vector2.zero();

    // The controlled-ball offset normally decays. During kickoff preparation,
    // keep the ball exactly on the centre mark and the taker behind it.
    state.ball.position = centre;
    state.ball.visualPosition = centre;
    state.ball.velocity = Vector2.zero();
    state.ball.controlOffset = centre.subtract(takerPosition);

    this.keepTeamInOwnHalf(state, takingTeam, taker);
    this.keepTeamInOwnHalf(state, defendingTeam);
    this.clearCentreCircle(state, defendingTeam);
  }

  private resetShape(state: MatchState, team: TeamMatchState): void {
    const assignments = team.tactic.defensiveShape.assignments;
    team.players.forEach((player, index) => {
      if (player.scenarioMovementFrozen) return;
      const anchor = assignments[index]?.defensiveAnchor;
      if (!anchor) return;
      const x = team.attackingDirection === 1 ? anchor.x : state.pitch.length - anchor.x;
      const position = new Vector2(x, anchor.y);
      player.position = position;
      player.targetPosition = position;
      player.tacticalAnchorPosition = position;
      player.runCorridorOrigin = position;
    });
  }

  private keepTeamInOwnHalf(state: MatchState, team: TeamMatchState, exception?: PlayerMatchState): void {
    const halfway = state.pitch.length / 2;
    for (const player of team.players) {
      if (player === exception || player.scenarioMovementFrozen) continue;
      const x = team.attackingDirection === 1
        ? Math.min(player.position.x, halfway - .5)
        : Math.max(player.position.x, halfway + .5);
      player.position = new Vector2(x, player.position.y);
      player.targetPosition = player.position;
    }
  }

  private clearCentreCircle(state: MatchState, team: TeamMatchState): void {
    const centre = new Vector2(state.pitch.length / 2, state.pitch.width / 2);
    for (const player of team.players) {
      if (player.scenarioMovementFrozen) continue;
      const offset = player.position.subtract(centre);
      if (offset.magnitude() >= OPPONENT_CLEARANCE) continue;
      const fallback = new Vector2(-team.attackingDirection, 0);
      const direction = offset.magnitude() > .01 ? offset.normalize() : fallback;
      let position = centre.add(direction.multiply(OPPONENT_CLEARANCE));
      const ownHalfX = team.attackingDirection === 1
        ? Math.min(position.x, centre.x - .5)
        : Math.max(position.x, centre.x + .5);
      position = new Vector2(ownHalfX, position.y);
      player.position = position;
      player.targetPosition = position;
    }
  }

  private selectTaker(team: TeamMatchState): PlayerMatchState {
    return team.players.find(player => player.currentRole === "STRIKER")
      ?? team.players.find(player => !player.currentRole.includes("GOALKEEPER"))!;
  }

  private selectReceiver(team: TeamMatchState, taker: PlayerMatchState): PlayerMatchState {
    return team.players.filter(player => player !== taker && !player.currentRole.includes("GOALKEEPER"))
      .sort((a, b) => a.position.distanceTo(taker.position) - b.position.distanceTo(taker.position))[0];
  }

  private player(state: MatchState, id: string): PlayerMatchState {
    const player = [...state.home.players, ...state.away.players].find(item => item.player.id === id);
    if (!player) throw new Error(`Kickoff player ${id} not found`);
    return player;
  }
}
