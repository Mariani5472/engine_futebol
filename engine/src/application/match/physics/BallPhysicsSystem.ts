import { Vector2 } from "../../../core/geometry/Vector2";
import { Vector3 } from "../../../core/geometry/Vector3";
import { BallMatchState, BallState } from "../../../core/movement/BallMatchState";
import { MatchState } from "../../../core/movement/MatchState";
import {
  Milliseconds, PlayerId, TeamId, PLAYER_COLLISION_RADIUS,
  type BallDeflectionEvent, type GoalEvent, type GoalkeeperSaveEvent,
  type CarryEndedEvent, type MatchEvent, type ReboundEvent, type ShotExecution, type ShotOutcomeEvent, type ShotResolvedEvent,
} from "../../../domain";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { BallMotionPlanner } from "./BallMotionPlanner";
import { RestartSystem } from "../engine/RestartSystem";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { AssistPolicy } from "../analytics/AssistPolicy";

const GROUND_FRICTION = 0.82;
const BOUNCE_RESTITUTION = 0.55;
const GRAVITY = 9.81;
const GROUND_THRESHOLD = 0.05;
const MIN_SPEED = 0.1;
const SHOT_CALIBRATION = ENGINE_CALIBRATION_PARAMETERS.shot;
const ASSIST_POLICY = new AssistPolicy(ENGINE_CALIBRATION_PARAMETERS.assists);

interface ShotInteractionResult {
  readonly events: MatchEvent[];
  readonly stopPhysics: boolean;
}

export class BallPhysicsSystem {

  public update(state: MatchState, deltaTime: number): MatchEvent[] {
    const ball = state.ball;
    ball.previousPosition = ball.position;

    // Orphan controlled state — never leave the ball stuck without an owner.
    if (ball.state === BallState.CONTROLLED && !ball.owner) {
      (ball as { state: BallState }).state = BallState.FREE;
    }

    if (ball.owner !== null && ball.state === BallState.CONTROLLED) {
      const carrier = ball.owner;
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
      if (carrier.activeCarry && carrier.position.distanceTo(carrier.activeCarry.destination) <= .35) {
        const carry = carrier.activeCarry;
        carrier.activeCarry = null;
        const team = state.home.players.includes(carrier) ? state.home : state.away;
        const event: CarryEndedEvent = {
          id:`carry-end-${carrier.player.id}-${state.currentSecond.toFixed(2)}`, type:"CARRY_ENDED",
          timestamp:(state.currentSecond*1000) as Milliseconds, period:this.period(state),
          teamId:team.team.id as TeamId, playerId:carrier.player.id as PlayerId,
          originX:carry.origin.x, originY:carry.origin.y, positionX:carrier.position.x, positionY:carrier.position.y,
          reason:"TARGET_REACHED",
        };
        return [event];
      }
      return [];
    }

    // Owner pointer without CONTROLLED — clear stale owner so contests work.
    if (ball.motion) {
      const previousHeight = ball.height;
      this.updateAuthoritativeMotion(ball, deltaTime);
      const interaction = this.resolveShotInteractions(state, ball.previousPosition, previousHeight);
      if (interaction.stopPhysics) {
        ball.lastPhysicsDisplacement = ball.previousPosition.distanceTo(ball.position);
        this.syncVisual(ball);
        return interaction.events;
      }
      const restartEvents = this.resolveOutOfPlay(state);
      if (restartEvents) return [...interaction.events, ...restartEvents];
      if(!ball.motion&&ball.activeShot?.lifecycle==="DEFLECTED") {
        const deflected=ball.activeShot;
        deflected.lifecycle="RESOLVED";deflected.outcome="BLOCKED";ball.activeShot=null;
        interaction.events.push(this.shotResolvedEvent(state,deflected,ball.position,ball.height));
      }
      this.clampToPitch(ball, state);
      ball.lastPhysicsDisplacement = ball.previousPosition.distanceTo(ball.position);
      this.syncVisual(ball);
      return interaction.events;
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

    const interruptedShot = ball.activeShot;
    const shotEvents: MatchEvent[] = [];
    if (interruptedShot && interruptedShot.lifecycle !== "RESOLVED") {
      interruptedShot.lifecycle = "RESOLVED";
      interruptedShot.outcome = "OFF_TARGET";
      shotEvents.push(this.shotOutcomeEvent(
        state,
        interruptedShot,
        "SHOT_OFF_TARGET",
        ball.position,
        ball.height,
        "OUT_BEFORE_GOAL_LINE",
      ));
      shotEvents.push(this.shotResolvedEvent(state,interruptedShot,ball.position,ball.height));
      ball.activeShot = null;
    }

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

    ball.resolvePendingPass("OUT_OF_PLAY", state.currentSecond);
    new RestartSystem().setup(state, event.type, awarded, restartPosition, state.currentSecond);
    ball.lastPhysicsDisplacement = 0;
    this.syncVisual(ball);
    return [...shotEvents, event];
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
    ball.height = motion.startHeight * (1 - time)
      + motion.targetHeight * time
      + motion.peakHeight * 4 * time * (1 - time);
    if (time >= 1) {
      ball.position = motion.target;
      ball.height = motion.targetHeight;
      ball.motion = null;
      ball.state = BallState.FREE;
    }
  }

  private resolveShotInteractions(
    state: MatchState,
    previousPosition: Vector2,
    previousHeight: number,
  ): ShotInteractionResult {
    const shot = state.ball.activeShot;
    if (!shot || shot.lifecycle === "RESOLVED") return { events: [], stopPhysics: false };
    const currentPosition = state.ball.position;
    const currentHeight = state.ball.height;

    const defender = this.findDefenderContact(state, shot, previousPosition, currentPosition, previousHeight, currentHeight);
    if (defender) return this.resolveDefenderBlock(state, shot, defender.player, defender.point, defender.height);

    const goalkeeper = this.goalkeeper(state, shot);
    if (goalkeeper && this.trajectoryTargetsGoal(shot)) {
      const contact = this.segmentContact(previousPosition, currentPosition, goalkeeper.position);
      const contactHeight = previousHeight + (currentHeight - previousHeight) * contact.t;
      const aerialReach = goalkeeper.player.attributes.goalkeeping.aerialReach / 20;
      const jump = Number(goalkeeper.player.attributes.physical.jumpingReach ?? 10) / 20;
      const reactionElapsed=Math.max(0,state.currentSecond-goalkeeper.goalkeeperReactionUntil);
      // Reaction delay already prevents impossible early contact. Once the
      // keeper has reacted, standing reach is immediately available and the
      // remaining ten percent grows with the dive instead of shrinking the
      // previously calibrated body envelope.
      const commitment=.9+.1*Math.max(0,Math.min(1,reactionElapsed/.45));
      const jumpArc=jump*(.18+Math.sin(Math.PI*Math.min(1,reactionElapsed/.7))*.24);
      const diveBonus = goalkeeper.goalkeeperState === "DIVING" ? .24*commitment : 0;
      const horizontalReach = SHOT_CALIBRATION.goalkeeperBodyReachMeters
        + aerialReach * SHOT_CALIBRATION.goalkeeperAerialReachScaleMeters*commitment
        + diveBonus;
      const verticalReach = 1.35 + aerialReach * .9 + jumpArc
        + (goalkeeper.goalkeeperState === "DIVING" ? .12 : 0);
      const reacted = state.currentSecond + 1e-9 >= goalkeeper.goalkeeperReactionUntil
        && goalkeeper.goalkeeperState !== "SET";
      if (reacted && contact.distance <= horizontalReach && contactHeight <= verticalReach) {
        return this.resolveGoalkeeperContact(state, shot, goalkeeper, contact.point, contactHeight);
      }
    }

    const direction = Math.sign(shot.initialVelocity.x);
    const framePlane = shot.goalFrame.goalLineX;
    if (this.crossedPlane(previousPosition.x, currentPosition.x, framePlane, direction)) {
      const frameDeltaX = currentPosition.x - previousPosition.x;
      const frameT = Math.max(0, Math.min(1, Math.abs(frameDeltaX) <= 1e-9 ? 0 : (framePlane - previousPosition.x) / frameDeltaX));
      const frameY = previousPosition.y + (currentPosition.y - previousPosition.y) * frameT;
      const frameHeight = previousHeight + (currentHeight - previousHeight) * frameT;
      const frameInteraction = this.resolveGoalPlane(state, shot, new Vector2(framePlane, frameY), frameHeight, false);
      if (frameInteraction.events.length || frameInteraction.stopPhysics) return frameInteraction;
    }

    const goalPlane = shot.goalFrame.goalLineX + direction * shot.goalFrame.ballRadius;
    if (!this.crossedPlane(previousPosition.x, currentPosition.x, goalPlane, direction)) {
      return { events: [], stopPhysics: false };
    }
    const deltaX = currentPosition.x - previousPosition.x;
    const t = Math.max(0, Math.min(1, Math.abs(deltaX) <= 1e-9 ? 0 : (goalPlane - previousPosition.x) / deltaX));
    const crossingY = previousPosition.y + (currentPosition.y - previousPosition.y) * t;
    const crossingHeight = previousHeight + (currentHeight - previousHeight) * t;
    return this.resolveGoalPlane(state, shot, new Vector2(goalPlane, crossingY), crossingHeight, true);
  }

  private findDefenderContact(
    state: MatchState,
    shot: ShotExecution,
    from: Vector2,
    to: Vector2,
    fromHeight: number,
    toHeight: number,
  ): { player: PlayerMatchState; point: Vector2; height: number; t: number } | null {
    const defending = shot.defendingTeamId === state.home.team.id ? state.home : state.away;
    let best: { player: PlayerMatchState; point: Vector2; height: number; t: number } | null = null;
    for (const player of defending.players) {
      if (player.player.id === shot.goalkeeperId) continue;
      if (player.player.id === shot.lastInteractionPlayerId) continue;
      const contact = this.segmentContact(from, to, player.position);
      const height = fromHeight + (toHeight - fromHeight) * contact.t;
      // Physical contact volume is body radius + ball radius. The former
      // +0.24 envelope turned near misses into blocks and collapsed the shot
      // funnel before the goal/goalkeeper interaction.
      const jumping = Number(player.player.attributes.physical.jumpingReach ?? 10) / 20;
      const heading = Number(player.player.attributes.technical.heading ?? 10) / 20;
      const verticalReach = 1.15 + jumping * .75 + heading * .2;
      const bracedRadius = PLAYER_COLLISION_RADIUS + shot.goalFrame.ballRadius
        + (player.bodyState === "BALANCED" ? .04 : 0);
      if (contact.distance > bracedRadius || height > verticalReach) continue;
      if (!best || contact.t < best.t) best = { player, point: contact.point, height, t: contact.t };
    }
    return best;
  }

  private resolveDefenderBlock(
    state: MatchState,
    shot: ShotExecution,
    defender: PlayerMatchState,
    point: Vector2,
    height: number,
  ): ShotInteractionResult {
    shot.lifecycle = "DEFLECTED";
    shot.outcome = null;
    shot.lastInteractionPlayerId = defender.player.id;
    shot.deflectionCount++;
    state.ball.noteTouch(defender.player.id);
    state.ball.noteAssistIntervention("DEFENDER_DEFLECTION");
    const incoming = state.ball.velocity.magnitude() > .01
      ? state.ball.velocity.normalize()
      : new Vector2(Math.sign(shot.initialVelocity.x) || 1, 0);
    const contactNormalRaw = point.subtract(defender.position);
    const contactNormal = contactNormalRaw.magnitude() > .01
      ? contactNormalRaw.normalize()
      : incoming.multiply(-1);
    const reflected = incoming.subtract(contactNormal.multiply(2 * incoming.dot(contactNormal))).normalize();
    const target = point.add(reflected.multiply(12));
    shot.actualTarget=new Vector3(target.x,target.y,Math.max(0,height*.35));
    const oldTarget = state.ball.motion?.target ?? point;
    BallMotionPlanner.start(state.ball, {
      kind: "DEFLECTION", origin: point, target, speed: Math.max(7, state.ball.velocity.magnitude() * .42),
      startHeight: height, targetHeight: 0, peakHeight: Math.min(.5, height * .25),
    });
    state.ball.activeShot = shot;
    const goalkeeper=this.goalkeeper(state,shot);
    if(goalkeeper) {
      goalkeeper.goalkeeperInterceptionTarget=null;
      goalkeeper.goalkeeperInterceptionHeight=null;
      goalkeeper.goalkeeperState="SET";
    }
    const outcome = this.shotOutcomeEvent(state, shot, "SHOT_BLOCKED", point, height, "BLOCKED");
    const deflection = this.deflectionEvent(state, shot, defender.player.id, point, height, oldTarget, target);
    const rebound = this.reboundEvent(state, shot, defender.player.id, point, "DEFENDER");
    return { events: [outcome, deflection, rebound], stopPhysics: false };
  }

  private resolveGoalkeeperContact(
    state: MatchState,
    shot: ShotExecution,
    goalkeeper: PlayerMatchState,
    point: Vector2,
    height: number,
  ): ShotInteractionResult {
    const handling = goalkeeper.player.attributes.goalkeeping.handling / 20;
    const speed = state.ball.velocity.magnitude();
    const caught = handling >= .62 && speed <= SHOT_CALIBRATION.goalkeeperCatchSpeedMetersPerSecond && height <= 1.75
      && goalkeeper.position.distanceTo(point) <= 1.05;
    shot.lifecycle = "RESOLVED";
    shot.outcome = caught ? "SAVED_CAUGHT" : "SAVED_PARRIED";
    shot.lastInteractionPlayerId = goalkeeper.player.id;
    state.ball.noteTouch(goalkeeper.player.id);
    state.ball.noteAssistIntervention(caught ? "CONTROL_CHANGE" : "GOALKEEPER_PARRY");
    const onTarget = this.trajectoryTargetsGoal(shot)
      ? this.shotOutcomeEvent(state, shot, "SHOT_ON_TARGET", point, height, "SAVED") : null;
    const save: GoalkeeperSaveEvent = {
      id: `${shot.id}-save`, type: "GOALKEEPER_SAVE", shotId: shot.id,
      timestamp: (state.currentSecond * 1000) as Milliseconds, period: this.period(state),
      teamId: shot.defendingTeamId as TeamId,
      goalkeeperId: goalkeeper.player.id as PlayerId,
      shooterId: shot.shooterId as PlayerId,
      caught, interceptionX: point.x, interceptionY: point.y, interceptionHeight: height,
    };

    if (caught) {
      for (const player of [...state.home.players, ...state.away.players]) player.hasBall = false;
      goalkeeper.position = point;
      goalkeeper.targetPosition = point;
      goalkeeper.velocity = Vector2.zero();
      goalkeeper.hasBall = true;
      goalkeeper.goalkeeperState = "CATCHING";
      goalkeeper.goalkeeperStateUntil = state.currentSecond + .8;
      state.ball.position = point;
      state.ball.height = 0;
      state.ball.velocity = Vector2.zero();
      state.ball.motion = null;
      state.ball.activeShot = null;
      state.ball.acquirePossession(goalkeeper, "GOALKEEPER_SAVE", state.currentSecond);
      state.ball.state = BallState.CONTROLLED;
      return { events: [...(onTarget?[onTarget]:[]), save, this.shotResolvedEvent(state,shot,point,height)], stopPhysics: true };
    }

    goalkeeper.goalkeeperState = "PARRYING";
    goalkeeper.goalkeeperStateUntil = state.currentSecond + .55;
    shot.deflectionCount++;
    const attackDirection = Math.sign(shot.initialVelocity.x) || 1;
    const side = point.y <= state.pitch.width / 2 ? -1 : 1;
    const goalCentreY = (shot.goalFrame.leftY + shot.goalFrame.rightY) / 2;
    const lateralFromCentre = Math.abs(point.y - goalCentreY);
    const parryAroundPost = lateralFromCentre >= .45 || height >= 1.35;
    const target = point.add(parryAroundPost
      ? new Vector2(attackDirection * 2.4, side * 8)
      : new Vector2(-attackDirection * 5.5, side * 6));
    const oldTarget = state.ball.motion?.target ?? point;
    BallMotionPlanner.start(state.ball, {
      kind: "DEFLECTION", origin: point, target, speed: Math.max(8, speed * .38),
      startHeight: height, targetHeight: 0, peakHeight: .35,
    });
    state.ball.activeShot = null;
    const deflection = this.deflectionEvent(state, shot, goalkeeper.player.id, point, height, oldTarget, target);
    const rebound = this.reboundEvent(state, shot, goalkeeper.player.id, point, "GOALKEEPER");
    return { events: [...(onTarget?[onTarget]:[]), save, deflection, rebound, this.shotResolvedEvent(state,shot,point,height)], stopPhysics: false };
  }

  private resolveGoalPlane(
    state: MatchState,
    shot: ShotExecution,
    point: Vector2,
    height: number,
    awardGoal: boolean,
  ): ShotInteractionResult {
    const frame = shot.goalFrame;
    const postDistance = Math.min(Math.abs(point.y - frame.leftY), Math.abs(point.y - frame.rightY));
    const withinWidth = point.y > frame.leftY + frame.ballRadius && point.y < frame.rightY - frame.ballRadius;
    const withinHeight = height >= frame.bottomZ && height < frame.topZ - frame.ballRadius;
    const hitsPost = postDistance <= frame.ballRadius * 1.45 && height <= frame.topZ;
    const hitsCrossbar = withinWidth && Math.abs(height - frame.topZ) <= frame.ballRadius * 1.45;

    if (hitsPost || hitsCrossbar) {
      shot.lifecycle = "RESOLVED";
      shot.outcome = hitsPost ? "POST" : "CROSSBAR";
      state.ball.noteAssistIntervention("WOODWORK");
      const attackDirection = Math.sign(shot.initialVelocity.x) || 1;
      const side = point.y <= state.pitch.width / 2 ? -1 : 1;
      const target = point.add(new Vector2(-attackDirection * 7, hitsPost ? -side * 3 : side * 1.5));
      const oldTarget = state.ball.motion?.target ?? point;
      BallMotionPlanner.start(state.ball, {
        kind: "DEFLECTION", origin: point, target, speed: Math.max(8, state.ball.velocity.magnitude() * .5),
        startHeight: Math.max(0, height - .08), targetHeight: 0, peakHeight: hitsCrossbar ? .8 : .35,
      });
      state.ball.activeShot = null;
      const woodwork = this.shotOutcomeEvent(state, shot, "WOODWORK", point, height, shot.outcome);
      const deflection = this.deflectionEvent(state, shot, null, point, height, oldTarget, target);
      const rebound = this.reboundEvent(state, shot, shot.shooterId, point, "WOODWORK");
      return { events: [woodwork, deflection, rebound, this.shotResolvedEvent(state,shot,point,height)], stopPhysics: false };
    }

    if (!withinWidth || !withinHeight) {
      shot.lifecycle = "RESOLVED";
      shot.outcome = "OFF_TARGET";
      state.ball.activeShot = null;
      return {
        events: [this.shotOutcomeEvent(state, shot, "SHOT_OFF_TARGET", point, height, "OFF_TARGET"),this.shotResolvedEvent(state,shot,point,height)],
        stopPhysics: false,
      };
    }

    if (!awardGoal) return { events: [], stopPhysics: false };

    shot.lifecycle = "RESOLVED";
    shot.outcome = "GOAL";
    const scoring = shot.teamId === state.home.team.id ? state.home : state.away;
    scoring.score++;
    scoring.resetPossessionShotCount();
    const conceding = scoring === state.home ? state.away : state.home;
    conceding.resetPossessionShotCount();
    state.ball.position = point;
    state.ball.velocity = Vector2.zero();
    state.ball.height = Math.max(0, height);
    state.ball.motion = null;
    state.ball.activeShot = null;
    state.ball.state = BallState.FREE;
    const goalId = `goal-${shot.shooterId}-${state.currentSecond.toFixed(2)}`;
    const assistId = ASSIST_POLICY.resolve(
      state.ball.lastCompletedPass,
      shot.shooterId,
      state.currentSecond,
    ) as PlayerId | null;
    state.pendingGoalRestart = {
      concedingTeamId: conceding.team.id,
      executeAt: state.currentSecond + 2.5,
      goalEventId: goalId,
    };
    const onTarget = this.shotOutcomeEvent(state, shot, "SHOT_ON_TARGET", point, height, "GOAL");
    const goal: GoalEvent = {
      id: goalId, type: "GOAL", timestamp: (state.currentSecond * 1000) as Milliseconds,
      period: this.period(state), teamId: shot.teamId as TeamId,
      scorerId: shot.shooterId as PlayerId, assistId,
    };
    return { events: [onTarget, goal, this.shotResolvedEvent(state,shot,point,height)], stopPhysics: true };
  }

  private shotOutcomeEvent(
    state: MatchState,
    shot: ShotExecution,
    type: ShotOutcomeEvent["type"],
    point: Vector2,
    height: number,
    outcome: string,
  ): ShotOutcomeEvent {
    return {
      id: `${shot.id}-${type.toLowerCase()}`, type, shotId: shot.id,
      timestamp: (state.currentSecond * 1000) as Milliseconds, period: this.period(state),
      teamId: shot.teamId as TeamId, playerId: shot.shooterId as PlayerId,
      positionX: point.x, positionY: point.y, height, outcome,
    };
  }

  private shotResolvedEvent(state:MatchState,shot:ShotExecution,point:Vector2,height:number):ShotResolvedEvent {
    return {
      id:`${shot.id}-resolved`,type:"SHOT_RESOLVED",shotId:shot.id,
      timestamp:(state.currentSecond*1000) as Milliseconds,period:this.period(state),
      teamId:shot.teamId as TeamId,playerId:shot.shooterId as PlayerId,
      originX:shot.origin.x,originY:shot.origin.y,
      intendedTargetY:shot.intendedTarget.y,intendedTargetZ:shot.intendedTarget.z,
      actualTargetY:shot.actualTarget.y,actualTargetZ:shot.actualTarget.z,
      initialSpeed:shot.speed,
      executionError:Math.hypot(shot.actualTarget.y-shot.intendedTarget.y,shot.actualTarget.z-shot.intendedTarget.z),
      goalkeeperId:shot.goalkeeperId as PlayerId|null,
      goalkeeperInitialX:shot.goalkeeperInitialPosition?.x??null,
      goalkeeperInitialY:shot.goalkeeperInitialPosition?.y??null,
      goalkeeperDecision:shot.goalkeeperDecision,
      goalkeeperReactionTime:shot.goalkeeperReactionTime,
      interceptionX:shot.lastInteractionPlayerId?point.x:null,
      interceptionY:shot.lastInteractionPlayerId?point.y:null,
      interceptionHeight:shot.lastInteractionPlayerId?height:null,
      finalOutcome:shot.outcome??"UNKNOWN",
    };
  }

  private deflectionEvent(
    state: MatchState,
    shot: ShotExecution,
    deflectorId: string | null,
    point: Vector2,
    height: number,
    previousTarget: Vector2,
    newTarget: Vector2,
  ): BallDeflectionEvent {
    return {
      id: `${shot.id}-deflection-${shot.deflectionCount}`, type: "BALL_DEFLECTION", shotId: shot.id,
      timestamp: (state.currentSecond * 1000) as Milliseconds, period: this.period(state),
      deflectorId: deflectorId as PlayerId | null,
      contactX: point.x, contactY: point.y, contactHeight: height,
      previousTargetX: previousTarget.x, previousTargetY: previousTarget.y,
      newTargetX: newTarget.x, newTargetY: newTarget.y,
    };
  }

  private reboundEvent(
    state: MatchState,
    shot: ShotExecution,
    playerId: string,
    point: Vector2,
    source: ReboundEvent["source"],
  ): ReboundEvent {
    return {
      id: `${shot.id}-rebound-${source.toLowerCase()}`, type: "REBOUND", shotId: shot.id,
      timestamp: (state.currentSecond * 1000) as Milliseconds, period: this.period(state),
      teamId: shot.teamId as TeamId, playerId: playerId as PlayerId,
      positionX: point.x, positionY: point.y, source,
    };
  }

  private goalkeeper(state: MatchState, shot: ShotExecution): PlayerMatchState | null {
    if (!shot.goalkeeperId) return null;
    return [...state.home.players, ...state.away.players]
      .find(player => player.player.id === shot.goalkeeperId) ?? null;
  }

  private trajectoryTargetsGoal(shot:ShotExecution):boolean {
    const frame=shot.goalFrame,target=shot.actualTarget;
    return target.y>frame.leftY+frame.ballRadius&&target.y<frame.rightY-frame.ballRadius
      && target.z>=frame.bottomZ&&target.z<frame.topZ-frame.ballRadius;
  }

  private segmentContact(from: Vector2, to: Vector2, point: Vector2): { point: Vector2; distance: number; t: number } {
    const segment = to.subtract(from);
    const lengthSquared = segment.dot(segment);
    const t = lengthSquared <= 1e-9 ? 0 : Math.max(0, Math.min(1, point.subtract(from).dot(segment) / lengthSquared));
    const closest = from.add(segment.multiply(t));
    return { point: closest, distance: closest.distanceTo(point), t };
  }

  private crossedPlane(fromX: number, toX: number, planeX: number, direction: number): boolean {
    return direction >= 0 ? fromX < planeX && toX >= planeX : fromX > planeX && toX <= planeX;
  }

  private period(state: MatchState): "FIRST_HALF" | "SECOND_HALF" {
    return state.currentSecond < 45 * 60 ? "FIRST_HALF" : "SECOND_HALF";
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
