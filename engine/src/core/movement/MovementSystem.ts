import { Vector2 } from "../geometry/Vector2";
import { MatchState } from "./MatchState";
import { PlayerMatchState } from "./PlayerMatchState";
import { ActionExecutionPhase } from "../../application/match/action/ActionExecution";

const ARRIVAL_RADIUS = .12;
const SLOWDOWN_RADIUS = 4.5;
const TEAMMATE_AVOID_RADIUS = 2.1;
const OPPONENT_AVOID_RADIUS = 1.65;
const HARD_BODY_DISTANCE = 1.05;

/** Deterministic steering locomotion. Tactical targets describe intent; this system resolves motion. */
export class MovementSystem {
  public update(state: MatchState, deltaTime: number): void {
    const players = [...state.home.players, ...state.away.players];
    const next = new Map<PlayerMatchState, { position: Vector2; velocity: Vector2; facing: Vector2 }>();

    for (const player of players) next.set(player, this.steerPlayer(state, player, players, deltaTime));
    for (const [player, movement] of next) {
      player.position = this.clampPlayer(movement.position, state);
      player.velocity = movement.velocity;
      player.facingDirection = movement.facing;
      player.bodyOrientation = movement.facing.angle();
    }
    this.resolveResidualOverlap(state);
  }

  private steerPlayer(state: MatchState, player: PlayerMatchState, players: readonly PlayerMatchState[], dt: number) {
    const movementMultiplier = this.getMovementMultiplier(player);
    if (movementMultiplier === 0) return { position: player.position, velocity: Vector2.zero(), facing: player.facingDirection };

    const toTarget = player.targetPosition.subtract(player.position);
    const distance = toTarget.magnitude();
    const physicalMaximum = this.calculateMaxSpeed(player) * movementMultiplier;
    const maxSpeed = Math.min(physicalMaximum, player.activeCarry?.desiredSpeed ?? physicalMaximum);
    const acceleration = this.calculateAcceleration(player) * movementMultiplier;
    const deceleration = this.calculateDeceleration(player) * movementMultiplier;
    const receiving = state.ball.motion?.intendedReceiverId === player.player.id;
    const slowdownRadius = receiving ? 6 : SLOWDOWN_RADIUS;

    let desiredVelocity = Vector2.zero();
    if (distance > ARRIVAL_RADIUS) {
      const brakingSpeed = Math.sqrt(2 * deceleration * Math.max(0, distance - ARRIVAL_RADIUS));
      const arrivalFactor = Math.min(1, distance / slowdownRadius);
      const desiredSpeed = Math.min(maxSpeed, brakingSpeed, maxSpeed * Math.max(.18, arrivalFactor));
      const corridorDirection = this.corridorDirection(player, toTarget);
      desiredVelocity = corridorDirection.multiply(desiredSpeed);
      desiredVelocity = desiredVelocity.add(this.localAvoidance(state, player, players, maxSpeed));
      desiredVelocity = this.limitMagnitude(desiredVelocity, maxSpeed);
      desiredVelocity = this.limitDirectionChange(player.velocity, desiredVelocity, this.getTurnSpeed(player) * movementMultiplier * dt);
    }

    const changingSpeed = desiredVelocity.magnitude() < player.velocity.magnitude();
    const maxDelta = (changingSpeed ? deceleration : acceleration) * dt;
    let velocity = player.velocity.add(this.limitMagnitude(desiredVelocity.subtract(player.velocity), maxDelta));
    velocity = this.limitMagnitude(velocity, maxSpeed);
    if (distance <= ARRIVAL_RADIUS && velocity.magnitude() < .08) velocity = Vector2.zero();

    let position = player.position.add(velocity.multiply(dt));
    const remainingAfterStep = player.targetPosition.subtract(position);
    // Do not coast through a reached target while the steering direction is
    // still turning around. This was especially visible near the end lines.
    if (distance > ARRIVAL_RADIUS && toTarget.dot(remainingAfterStep) <= 0) {
      position = player.targetPosition;
      velocity = Vector2.zero();
    }
    const facingTarget = receiving && distance < 4
      ? state.ball.position.subtract(player.position)
      : velocity.magnitude() > .08 ? velocity : toTarget;
    const facing = this.rotateFacing(player, facingTarget, dt, movementMultiplier);
    return { position, velocity, facing };
  }

  /** Look ahead inside a stable origin→target corridor instead of chasing every point directly. */
  private corridorDirection(player: PlayerMatchState, toTarget: Vector2): Vector2 {
    const corridor = player.targetPosition.subtract(player.runCorridorOrigin);
    if (corridor.magnitude() < 1 || toTarget.magnitude() < 3) return toTarget.normalize();
    const along = corridor.normalize();
    const progressed = Math.max(0, player.position.subtract(player.runCorridorOrigin).dot(along));
    const lookAhead = Math.min(corridor.magnitude(), progressed + 4);
    const corridorPoint = player.runCorridorOrigin.add(along.multiply(lookAhead));
    return corridorPoint.subtract(player.position).normalize();
  }

  private localAvoidance(state: MatchState, player: PlayerMatchState, players: readonly PlayerMatchState[], maxSpeed: number): Vector2 {
    const isHome = state.home.players.includes(player);
    let force = Vector2.zero();
    let nearby = 0;
    let centroid = Vector2.zero();
    for (const other of players) {
      if (other === player) continue;
      const offset = player.position.subtract(other.position);
      const distance = offset.magnitude();
      if (distance > 5) continue;
      nearby++; centroid = centroid.add(other.position);
      const teammate = state.home.players.includes(other) === isHome;
      const radius = teammate ? TEAMMATE_AVOID_RADIUS : OPPONENT_AVOID_RADIUS;
      if (distance >= radius) continue;
      const away = distance > .001 ? offset.divide(distance) : Vector2.fromAngle(this.stablePairAngle(player.player.id, other.player.id));
      const strength = (1 - distance / radius) * maxSpeed * (teammate ? .9 : .65);
      force = force.add(away.multiply(strength));
    }
    if (nearby >= 3) {
      centroid = centroid.divide(nearby);
      const escape = player.position.subtract(centroid).normalize();
      force = force.add(escape.multiply(Math.min(maxSpeed * .45, (nearby - 2) * .7)));
    }
    return force;
  }

  private resolveResidualOverlap(state: MatchState): void {
    const players = [...state.home.players, ...state.away.players];
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const first = players[i], second = players[j];
      const delta = second.position.subtract(first.position);
      const distance = delta.magnitude();
      if (distance >= HARD_BODY_DISTANCE) continue;
      const direction = distance > .001 ? delta.divide(distance) : Vector2.fromAngle(this.stablePairAngle(first.player.id, second.player.id));
      const correction = (HARD_BODY_DISTANCE - distance) / 2;
      first.position = this.clampPlayer(first.position.subtract(direction.multiply(correction)), state);
      second.position = this.clampPlayer(second.position.add(direction.multiply(correction)), state);
      const firstInward = first.velocity.dot(direction);
      const secondInward = second.velocity.dot(direction);
      if (firstInward > 0) first.velocity = first.velocity.subtract(direction.multiply(firstInward));
      if (secondInward < 0) second.velocity = second.velocity.subtract(direction.multiply(secondInward));
    }
  }

  private getMovementMultiplier(player: PlayerMatchState): number {
    if (player.bodyState === "FALLING" || player.bodyState === "GROUND") return 0;
    if (player.bodyState === "LEANING") return .7;
    if (player.bodyState === "BALANCED") return .9;
    if (player.activeAction?.phase === ActionExecutionPhase.RECOVERING) return .65;
    if(player.currentRole.includes("GOALKEEPER")) {
      if(player.goalkeeperState==="SET") return .18;
      if(player.goalkeeperState==="DIVING") return 1.18;
      if(player.goalkeeperState==="SMOTHERING") return .82;
      if(player.goalkeeperState==="RECOVERING") return .45;
      if(player.goalkeeperState==="RUSHING_OUT") return 1.08;
    }
    return 1;
  }

  private calculateMaxSpeed(player: PlayerMatchState): number {
    const physical = player.player.attributes.physical;
    return (physical.pace * .35 + physical.stamina * .15) * Math.max(.45, 1 - player.fatigue / 100);
  }
  private calculateAcceleration(player: PlayerMatchState): number {
    const physical = player.player.attributes.physical;
    return 4.5 + physical.acceleration / 20 * 5 + physical.agility / 20 * 1.5;
  }
  private calculateDeceleration(player: PlayerMatchState): number {
    const physical = player.player.attributes.physical;
    return 6 + physical.balance / 20 * 5 + physical.agility / 20 * 2;
  }
  private getTurnSpeed(player: PlayerMatchState): number {
    const p = player.player.attributes.physical;
    return (2.2 + p.agility / 20 * 2.2 + p.balance / 20 * 1.4) * Math.max(.5, 1 - player.fatigue / 100);
  }
  private rotateFacing(player: PlayerMatchState, desired: Vector2, dt: number, multiplier: number): Vector2 {
    if (desired.magnitude() < .001) return player.facingDirection;
    const difference = this.signedAngle(player.facingDirection, desired);
    return player.facingDirection.rotate(Math.max(-this.getTurnSpeed(player) * multiplier * dt,
      Math.min(this.getTurnSpeed(player) * multiplier * dt, difference))).normalize();
  }
  private limitDirectionChange(current: Vector2, desired: Vector2, maxAngle: number): Vector2 {
    if (current.magnitude() < .15 || desired.magnitude() < .001) return desired;
    const difference = this.signedAngle(current, desired);
    if (Math.abs(difference) <= maxAngle) return desired;
    return current.normalize().rotate(Math.sign(difference) * maxAngle).multiply(desired.magnitude());
  }
  private signedAngle(from: Vector2, to: Vector2): number {
    let difference = to.angle() - from.angle();
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    return difference;
  }
  private limitMagnitude(vector: Vector2, maximum: number): Vector2 {
    const magnitude = vector.magnitude();
    return magnitude > maximum && magnitude > 0 ? vector.multiply(maximum / magnitude) : vector;
  }
  private stablePairAngle(firstId: string, secondId: string): number {
    const key = firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;
    let hash = 0; for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return (Math.abs(hash) % 360) * Math.PI / 180;
  }
  private clampPlayer(position: Vector2, state: MatchState): Vector2 {
    return new Vector2(Math.max(0, Math.min(state.pitch.length, position.x)), Math.max(0, Math.min(state.pitch.width, position.y)));
  }
}
