import { Vector2 } from "../../../core/geometry/Vector2";
import { BallMatchState, BallState } from "../../../core/movement/BallMatchState";
import { MatchState } from "../../../core/movement/MatchState";
import { Milliseconds, TeamId, type MatchEvent } from "../../../domain";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";

const GROUND_FRICTION = 0.82;
const BOUNCE_RESTITUTION = 0.55;
const GRAVITY = 9.81;
const GROUND_THRESHOLD = 0.05;
const MIN_SPEED = 0.1;

export class BallPhysicsSystem {

  public update(state: MatchState, deltaTime: number): MatchEvent[] {
    const ball = state.ball;
    ball.previousPosition = ball.position;

    // Orphan controlled state — never leave the ball stuck without an owner.
    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      (ball as { state: BallState }).state = BallState.FREE;
    }

    if (ball.owner !== null && ball.state === BallState.CONTROLLED) {
      const desired = ball.owner.position.add(ball.controlOffset);
      ball.position = desired;
      this.clampToPitch(ball, state);
      ball.velocity = desired.subtract(ball.previousPosition).divide(Math.max(.001, deltaTime));
      ball.controlOffset = ball.controlOffset.multiply(Math.exp(-6 * deltaTime));
      ball.height = 0;
      ball.lastPhysicsDisplacement = ball.previousPosition.distanceTo(ball.position);
      this.syncVisual(ball);
      // Keep hasBall flag consistent if something cleared it.
      if (!ball.owner.hasBall) {
        ball.owner.hasBall = true;
      }
      return [];
    }

    // Owner pointer without CONTROLLED — clear stale owner so contests work.
    if (ball.motion) {
      this.updateAuthoritativeMotion(ball, deltaTime);
      const restartEvents = this.resolveOutOfPlay(state);
      if (restartEvents) return restartEvents;
      this.clampToPitch(ball, state);
      ball.lastPhysicsDisplacement = ball.previousPosition.distanceTo(ball.position);
      this.syncVisual(ball);
      return [];
    }

    if (ball.owner && ball.state !== BallState.CONTROLLED) {
      ball.owner.hasBall = false;
      (ball as { owner: null }).owner = null;
    }

    this.applyGravity(ball, deltaTime);
    this.applyGroundFriction(ball, deltaTime);
    this.applyMovement(ball, deltaTime);
    const restartEvents = this.resolveOutOfPlay(state);
    if (restartEvents) return restartEvents;
    this.clampToPitch(ball, state);
    this.checkRestState(ball);
    ball.lastPhysicsDisplacement = ball.previousPosition.distanceTo(ball.position);
    this.syncVisual(ball);
    return [];
  }

  private resolveOutOfPlay(state: MatchState): MatchEvent[] | null {
    const ball = state.ball;
    const left = ball.position.x <= 0 && ball.velocity.x < 0;
    const right = ball.position.x >= state.pitch.length && ball.velocity.x > 0;
    const top = ball.position.y <= 0 && ball.velocity.y < 0;
    const bottom = ball.position.y >= state.pitch.width && ball.velocity.y > 0;
    if (!left && !right && !top && !bottom) return null;

    const lastTouchTeam = this.teamOfPlayer(state, ball.lastTouchedPlayerId);
    const period = state.currentSecond < 45 * 60 ? "FIRST_HALF" as const : "SECOND_HALF" as const;
    let awarded: TeamMatchState;
    let restartPosition: Vector2;
    let event: MatchEvent;

    if (top || bottom) {
      awarded = lastTouchTeam === state.home ? state.away : state.home;
      restartPosition = new Vector2(
        Math.max(2, Math.min(state.pitch.length - 2, ball.position.x)),
        top ? 1 : state.pitch.width - 1,
      );
      event = {
        id: `throw-in-${awarded.team.id}-${state.currentSecond.toFixed(2)}`,
        type: "THROW_IN", timestamp: (state.currentSecond * 1000) as Milliseconds,
        period, teamId: awarded.team.id as TeamId,
      };
    } else {
      const defending = right
        ? (state.home.attackingDirection === -1 ? state.home : state.away)
        : (state.home.attackingDirection === 1 ? state.home : state.away);
      const attacking = defending === state.home ? state.away : state.home;
      const corner = lastTouchTeam === defending;
      awarded = corner ? attacking : defending;
      restartPosition = corner
        ? new Vector2(right ? state.pitch.length - 1 : 1, ball.position.y < state.pitch.width / 2 ? 1 : state.pitch.width - 1)
        : new Vector2(right ? state.pitch.length - 6 : 6, state.pitch.width / 2);
      event = corner ? {
        id: `corner-${awarded.team.id}-${state.currentSecond.toFixed(2)}`,
        type: "CORNER", timestamp: (state.currentSecond * 1000) as Milliseconds,
        period, teamId: awarded.team.id as TeamId,
      } : {
        id: `goal-kick-${awarded.team.id}-${state.currentSecond.toFixed(2)}`,
        type: "GOAL_KICK", timestamp: (state.currentSecond * 1000) as Milliseconds,
        period, teamId: awarded.team.id as TeamId,
      };
    }

    const goalkeeperRestart = event.type === "GOAL_KICK";
    const candidates = goalkeeperRestart
      ? awarded.players.filter(player => player.currentRole.includes("GOALKEEPER"))
      : awarded.players.filter(player => !player.currentRole.includes("GOALKEEPER"));
    const taker = (candidates.length ? candidates : awarded.players)
      .slice().sort((a, b) => a.position.distanceTo(restartPosition) - b.position.distanceTo(restartPosition))[0];

    for (const player of [...state.home.players, ...state.away.players]) player.hasBall = false;
    ball.resolvePendingPass(taker.player.id, state.currentSecond);
    taker.position = restartPosition;
    taker.velocity = Vector2.zero();
    taker.targetPosition = restartPosition;
    ball.position = restartPosition;
    ball.previousPosition = restartPosition;
    ball.velocity = Vector2.zero();
    ball.height = 0;
    ball.acquirePossession(taker, "RESTART", state.currentSecond);
    ball.state = BallState.CONTROLLED;
    ball.lastPhysicsDisplacement = 0;
    this.syncVisual(ball);
    return [event];
  }

  private teamOfPlayer(state: MatchState, playerId: string | null): TeamMatchState | null {
    if (!playerId) return null;
    if (state.home.players.some(player => player.player.id === playerId)) return state.home;
    if (state.away.players.some(player => player.player.id === playerId)) return state.away;
    return null;
  }

  private updateAuthoritativeMotion(ball: BallMatchState, deltaTime: number): void {
    const motion = ball.motion;
    if (!motion) return;
    const previousPosition = ball.position;
    motion.elapsed = Math.min(motion.duration, motion.elapsed + deltaTime);
    const time = motion.duration <= 0 ? 1 : motion.elapsed / motion.duration;
    const progress = motion.kind === "GROUND_PASS" ? 1 - Math.pow(1 - time, 1.35) : time;
    const direct = motion.target.subtract(motion.origin);
    let position = motion.origin.add(direct.multiply(progress));
    if (motion.hasExplicitEffect && motion.curve !== 0) {
      const perpendicular = new Vector2(-direct.y, direct.x).normalize();
      position = position.add(perpendicular.multiply(4 * motion.curve * progress * (1 - progress)));
    }
    ball.position = position;
    ball.velocity = position.subtract(previousPosition).divide(Math.max(.001, deltaTime));
    ball.height = motion.peakHeight * 4 * time * (1 - time);
    if (time >= 1) {
      ball.position = motion.target;
      ball.height = 0;
      ball.motion = null;
      ball.state = BallState.FREE;
    }
  }

  private syncVisual(ball: BallMatchState): void {
    ball.visualPosition = ball.position;
    ball.visualHeight = ball.height;
    ball.visualVelocity = ball.velocity;
  }

  private applyGravity(ball: BallMatchState, deltaTime: number): void {
    if (ball.height > GROUND_THRESHOLD) {
      const newHeight = ball.height - (this.getVerticalSpeed(ball) * deltaTime);

      if (newHeight <= 0) {
        this.bounce(ball);
      } else {
        (ball as { height: number }).height = newHeight;
      }
    }
  }

  private getVerticalSpeed(_ball: BallMatchState): number {
    return GRAVITY * 0.15;
  }

  private bounce(ball: BallMatchState): void {
    (ball as { height: number }).height = 0;
    const speed = ball.velocity.magnitude();
    if (speed > MIN_SPEED) {
      const retained = speed * BOUNCE_RESTITUTION;
      if (retained < MIN_SPEED) {
        (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      } else {
        (ball as { velocity: Vector2 }).velocity =
          ball.velocity.normalize().multiply(retained);
      }
    }
  }

  private applyGroundFriction(ball: BallMatchState, deltaTime: number): void {
    if (ball.height > GROUND_THRESHOLD) return;

    const speed = ball.velocity.magnitude();
    if (speed < MIN_SPEED) {
      (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      return;
    }

    const friction = Math.pow(GROUND_FRICTION, deltaTime);
    (ball as { velocity: Vector2 }).velocity = ball.velocity.multiply(friction);
  }

  private applyMovement(ball: BallMatchState, deltaTime: number): void {
    const displacement = ball.velocity.multiply(deltaTime);
    (ball as { position: Vector2 }).position = ball.position.add(displacement);
  }

  private clampToPitch(ball: BallMatchState, state: MatchState): void {
    const pitch = state.pitch;
    const pos = ball.position;
    const clamped = new Vector2(
      Math.max(0, Math.min(pitch.length, pos.x)),
      Math.max(0, Math.min(pitch.width, pos.y))
    );
    (ball as { position: Vector2 }).position = clamped;
  }

  private checkRestState(ball: BallMatchState): void {
    const speed = ball.velocity.magnitude();
    if (speed < MIN_SPEED && ball.height <= GROUND_THRESHOLD) {
      (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      if (ball.state === BallState.IN_FLIGHT) {
        (ball as { state: BallState }).state = BallState.FREE;
      }
    }
  }

  public launch(
    ball: BallMatchState,
    target: Vector2,
    power: number,
    height: number = 0
  ): void {
    const direction = target.subtract(ball.position).normalize();
    (ball as { velocity: Vector2 }).velocity = direction.multiply(power);
    (ball as { height: number }).height = height;
    (ball as { state: BallState }).state = BallState.IN_FLIGHT;
    if (ball.owner) {
      ball.owner.hasBall = false;
    }
    (ball as { owner: null }).owner = null;
  }
}
