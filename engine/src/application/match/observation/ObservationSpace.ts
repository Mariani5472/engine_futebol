import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import type { DecisionContext } from "../decision/DecisionContext";
import type { PlayerActionMask } from "../policy/PlayerActionSpace";

export const ACTOR_OBSERVATION_VERSION = 1 as const;
export const PRIVILEGED_CRITIC_OBSERVATION_VERSION = 1 as const;
export const DEBUG_OBSERVATION_VERSION = 1 as const;
export const ACTOR_OBSERVATION_VECTOR_SIZE = 189;
export const PRIVILEGED_CRITIC_VECTOR_SIZE = 184;

const MAX_TEAMMATE_SLOTS = 10;
const MAX_OPPONENT_SLOTS = 11;
const MAX_PLAYER_SPEED = 12;
const MAX_BALL_SPEED = 40;
const MAX_BALL_HEIGHT = 10;
const REGULATION_SECONDS = 90 * 60;
const MAX_SCORE_DIFFERENCE = 10;
const MEMORY_AGE_TICKS = 100;

export interface ActorEntityObservation {
  readonly id: string | null;
  readonly present: 0 | 1;
  readonly position: readonly [number, number];
  readonly velocity: readonly [number, number];
  readonly certainty: number;
  readonly age: number;
  readonly distance: number;
}

export interface ActorObservation {
  readonly kind: "ACTOR";
  readonly version: typeof ACTOR_OBSERVATION_VERSION;
  readonly playerId: string;
  readonly teamId: string;
  readonly matchSecond: number;
  readonly matchProgress: number;
  readonly scoreDifference: number;
  readonly actionMask: PlayerActionMask;
  readonly self: {
    readonly position: readonly [number, number];
    readonly velocity: readonly [number, number];
    readonly stamina: number;
    readonly fatigue: number;
    readonly balance: number;
    readonly stability: number;
    readonly hasBall: 0 | 1;
    readonly attackingDirection: -1 | 1;
  };
  readonly ball: {
    readonly position: readonly [number, number];
    readonly velocity: readonly [number, number];
    readonly height: number;
    readonly certainty: number;
    readonly distance: number;
  };
  readonly teammates: readonly ActorEntityObservation[];
  readonly opponents: readonly ActorEntityObservation[];
  /** Fixed-length, model-ready representation. Every value is in [-1, 1]. */
  readonly vector: readonly number[];
}

export interface PrivilegedCriticObservation {
  readonly kind: "PRIVILEGED_CRITIC";
  readonly version: typeof PRIVILEGED_CRITIC_OBSERVATION_VERSION;
  readonly playerId: string;
  readonly matchSecond: number;
  readonly score: readonly [number, number];
  readonly ballOwnerId: string | null;
  readonly ball: {
    readonly position: readonly [number, number];
    readonly velocity: readonly [number, number];
    readonly height: number;
  };
  readonly players: readonly {
    readonly id: string;
    readonly teamId: string;
    readonly teamSide: -1 | 1;
    readonly position: readonly [number, number];
    readonly velocity: readonly [number, number];
    readonly stamina: number;
    readonly fatigue: number;
    readonly hasBall: 0 | 1;
  }[];
  readonly vector: readonly number[];
}

export interface DebugObservation {
  readonly kind: "DEBUG";
  readonly version: typeof DEBUG_OBSERVATION_VERSION;
  readonly playerId: string;
  readonly matchSecond: number;
  readonly ball: {
    readonly position: { readonly x: number; readonly y: number };
    readonly velocity: { readonly x: number; readonly y: number };
    readonly height: number;
    readonly ownerId: string | null;
  };
  readonly players: readonly {
    readonly id: string;
    readonly teamId: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly velocity: { readonly x: number; readonly y: number };
    readonly targetPosition: { readonly x: number; readonly y: number };
    readonly nextDecisionAt: number;
    readonly actionLockUntil: number;
    readonly recoveryUntil: number;
    readonly possessionControlUntil: number;
    readonly role: string;
    readonly responsibility: string | null;
  }[];
}

export class ObservationSpace {
  public actor(context: DecisionContext, actionMask: PlayerActionMask): ActorObservation {
    return this.buildActor(
      context.match,
      context.player,
      context.awareness,
      context.currentTick,
      actionMask,
    );
  }

  public buildActor(
    state: MatchState,
    player: PlayerMatchState,
    awareness: PlayerAwareness,
    currentTick: number,
    actionMask: PlayerActionMask,
  ): ActorObservation {
    const isHome = state.home.players.includes(player);
    const team = isHome ? state.home : state.away;
    const scoreDifference = isHome
      ? state.home.score - state.away.score
      : state.away.score - state.home.score;
    const diagonal = Math.hypot(state.pitch.length, state.pitch.width);
    const teammates = this.memoryEntities(
      awareness.teammates,
      player,
      currentTick,
      state.pitch.length,
      state.pitch.width,
      diagonal,
      MAX_TEAMMATE_SLOTS,
    );
    const opponents = this.memoryEntities(
      awareness.opponents,
      player,
      currentTick,
      state.pitch.length,
      state.pitch.width,
      diagonal,
      MAX_OPPONENT_SLOTS,
    );
    const selfPosition = normalizePosition(player.position.x, player.position.y, state.pitch.length, state.pitch.width);
    const selfVelocity = normalizeVelocity(player.velocity.x, player.velocity.y, MAX_PLAYER_SPEED);
    const ballPosition = normalizePosition(
      awareness.ball.estimatedPosition.x,
      awareness.ball.estimatedPosition.y,
      state.pitch.length,
      state.pitch.width,
    );
    const ballVelocity = normalizeVelocity(
      awareness.ball.estimatedVelocity.x,
      awareness.ball.estimatedVelocity.y,
      MAX_BALL_SPEED,
    );
    const ballDistance = clamp01(player.position.distanceTo(awareness.ball.estimatedPosition) / diagonal);
    // BallMemory currently has no vertical component. Publishing the exact
    // physical height here would leak information outside perception.
    const perceivedBallHeight = 0;
    const orientation = player.bodyOrientation;
    const header = [
      clamp01(state.currentSecond / REGULATION_SECONDS),
      team.attackingDirection,
      clampSigned(scoreDifference / MAX_SCORE_DIFFERENCE),
      player.hasBall ? 1 : 0,
      ...selfPosition,
      ...selfVelocity,
      clamp01(player.stamina),
      clamp01(player.fatigue),
      clamp01(player.balance),
      clamp01(player.stability),
      Math.sin(orientation),
      Math.cos(orientation),
      ...ballPosition,
      ...ballVelocity,
      perceivedBallHeight,
      clamp01(awareness.ball.certainty),
      ballDistance,
    ];
    const vector = Object.freeze([
      ...header,
      ...teammates.flatMap(entityVector),
      ...opponents.flatMap(entityVector),
    ]);
    if (vector.length !== ACTOR_OBSERVATION_VECTOR_SIZE) {
      throw new Error(`Actor observation schema drift: expected ${ACTOR_OBSERVATION_VECTOR_SIZE}, received ${vector.length}`);
    }
    return deepFreeze({
      kind: "ACTOR" as const,
      version: ACTOR_OBSERVATION_VERSION,
      playerId: player.player.id,
      teamId: team.team.id,
      matchSecond: state.currentSecond,
      matchProgress: clamp01(state.currentSecond / REGULATION_SECONDS),
      scoreDifference: clampSigned(scoreDifference / MAX_SCORE_DIFFERENCE),
      actionMask,
      self: {
        position: selfPosition,
        velocity: selfVelocity,
        stamina: clamp01(player.stamina),
        fatigue: clamp01(player.fatigue),
        balance: clamp01(player.balance),
        stability: clamp01(player.stability),
        hasBall: player.hasBall ? 1 as const : 0 as const,
        attackingDirection: team.attackingDirection,
      },
      ball: {
        position: ballPosition,
        velocity: ballVelocity,
        height: perceivedBallHeight,
        certainty: clamp01(awareness.ball.certainty),
        distance: ballDistance,
      },
      teammates,
      opponents,
      vector,
    });
  }

  public privilegedCritic(state: MatchState, playerId: string): PrivilegedCriticObservation {
    const players = this.allPlayers(state).map(({ teamId, player }) => ({
      id: player.player.id,
      teamId,
      teamSide: teamId === state.home.team.id ? -1 as const : 1 as const,
      position: normalizePosition(player.position.x, player.position.y, state.pitch.length, state.pitch.width),
      velocity: normalizeVelocity(player.velocity.x, player.velocity.y, MAX_PLAYER_SPEED),
      stamina: clamp01(player.stamina),
      fatigue: clamp01(player.fatigue),
      hasBall: player.hasBall ? 1 as const : 0 as const,
    }));
    const ballPosition = normalizePosition(state.ball.position.x, state.ball.position.y, state.pitch.length, state.pitch.width);
    const ballVelocity = normalizeVelocity(state.ball.velocity.x, state.ball.velocity.y, MAX_BALL_SPEED);
    const vector = Object.freeze([
      clamp01(state.currentSecond / REGULATION_SECONDS),
      clampSigned(state.home.score / MAX_SCORE_DIFFERENCE),
      clampSigned(state.away.score / MAX_SCORE_DIFFERENCE),
      ...ballPosition,
      ...ballVelocity,
      clamp01(state.ball.height / MAX_BALL_HEIGHT),
      ...players.flatMap(item => [
        item.teamSide, ...item.position, ...item.velocity, item.stamina, item.fatigue, item.hasBall,
      ]),
    ]);
    if (vector.length !== PRIVILEGED_CRITIC_VECTOR_SIZE) {
      throw new Error(`Privileged critic schema drift: expected ${PRIVILEGED_CRITIC_VECTOR_SIZE}, received ${vector.length}`);
    }
    return deepFreeze({
      kind: "PRIVILEGED_CRITIC" as const,
      version: PRIVILEGED_CRITIC_OBSERVATION_VERSION,
      playerId,
      matchSecond: state.currentSecond,
      score: [state.home.score, state.away.score] as const,
      ballOwnerId: state.ball.owner?.player.id ?? null,
      ball: { position: ballPosition, velocity: ballVelocity, height: clamp01(state.ball.height / MAX_BALL_HEIGHT) },
      players,
      vector,
    });
  }

  public debug(state: MatchState, playerId: string): DebugObservation {
    return deepFreeze({
      kind: "DEBUG" as const,
      version: DEBUG_OBSERVATION_VERSION,
      playerId,
      matchSecond: state.currentSecond,
      ball: {
        position: { x: state.ball.position.x, y: state.ball.position.y },
        velocity: { x: state.ball.velocity.x, y: state.ball.velocity.y },
        height: state.ball.height,
        ownerId: state.ball.owner?.player.id ?? null,
      },
      players: this.allPlayers(state).map(({ teamId, player }) => ({
        id: player.player.id,
        teamId,
        position: { x: player.position.x, y: player.position.y },
        velocity: { x: player.velocity.x, y: player.velocity.y },
        targetPosition: { x: player.targetPosition.x, y: player.targetPosition.y },
        nextDecisionAt: player.nextDecisionAt,
        actionLockUntil: player.actionLockUntil,
        recoveryUntil: player.recoveryUntil,
        possessionControlUntil: player.possessionControlUntil,
        role: player.currentRole,
        responsibility: player.tacticalResponsibility,
      })),
    });
  }

  private memoryEntities(
    memories: PlayerAwareness["teammates"],
    player: PlayerMatchState,
    currentTick: number,
    pitchLength: number,
    pitchWidth: number,
    diagonal: number,
    slots: number,
  ): readonly ActorEntityObservation[] {
    const observed = [...memories.values()]
      .map(memory => ({ memory, distance: player.position.distanceTo(memory.estimatedPosition) }))
      .sort((left, right) => left.distance - right.distance || left.memory.playerId.localeCompare(right.memory.playerId))
      .slice(0, slots)
      .map(({ memory, distance }): ActorEntityObservation => ({
        id: memory.playerId,
        present: 1,
        position: normalizePosition(memory.estimatedPosition.x, memory.estimatedPosition.y, pitchLength, pitchWidth),
        velocity: normalizeVelocity(memory.estimatedVelocity.x, memory.estimatedVelocity.y, MAX_PLAYER_SPEED),
        certainty: clamp01(memory.certainty),
        age: clamp01((currentTick - memory.lastSeenTick) / MEMORY_AGE_TICKS),
        distance: clamp01(distance / diagonal),
      }));
    while (observed.length < slots) observed.push(emptyEntity());
    return Object.freeze(observed.map(entity => deepFreeze(entity)));
  }

  private allPlayers(state: MatchState): readonly { teamId: string; player: PlayerMatchState }[] {
    return [
      ...state.home.players.map(player => ({ teamId: state.home.team.id, player })),
      ...state.away.players.map(player => ({ teamId: state.away.team.id, player })),
    ].sort((left, right) => left.player.player.id.localeCompare(right.player.player.id));
  }
}

export const OBSERVATION_SPACE = Object.freeze(new ObservationSpace());

function normalizePosition(x: number, y: number, length: number, width: number): readonly [number, number] {
  return Object.freeze([clamp01(x / length), clamp01(y / width)] as const);
}

function normalizeVelocity(x: number, y: number, maximum: number): readonly [number, number] {
  return Object.freeze([clampSigned(x / maximum), clampSigned(y / maximum)] as const);
}

function emptyEntity(): ActorEntityObservation {
  return deepFreeze({ id: null, present: 0 as const, position: [0, 0] as const, velocity: [0, 0] as const, certainty: 0, age: 0, distance: 0 });
}

function entityVector(entity: ActorEntityObservation): number[] {
  return [entity.present, ...entity.position, ...entity.velocity, entity.certainty, entity.age, entity.distance];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
