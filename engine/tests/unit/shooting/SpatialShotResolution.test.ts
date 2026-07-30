import { Vector2 } from "../../../src/core/geometry/Vector2";
import { Vector3 } from "../../../src/core/geometry/Vector3";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { PossessionSystem } from "../../../src/core/movement/PossessionSystem";
import { ReachCalculator } from "../../../src/core/movement/ReachCalculator";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { BallMotionPlanner } from "../../../src/application/match/physics/BallMotionPlanner";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { createGoalFrame, type MatchEvent, type ShotExecution } from "../../../src/domain";
import { buildSimulationConfig } from "../../helpers/builders";

describe("spatial shot resolution", () => {
  const prepare = (targetY = 34, targetHeight = 1, speed = 28, goalkeeper = false) => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(17)).state;
    state.kickoff = null;
    state.pendingGoalRestart = null;
    const shooter = state.home.players.find(player => player.currentRole === "STRIKER")!;
    const keeper = state.away.players.find(player => player.currentRole.includes("GOALKEEPER"))!;
    for (const player of [...state.home.players, ...state.away.players]) {
      player.hasBall = false;
      player.position = new Vector2(player.position.x, player === keeper ? 8 : 8);
      player.targetPosition = player.position;
      player.velocity = Vector2.zero();
    }
    shooter.position = new Vector2(99, 34);
    keeper.position = goalkeeper ? new Vector2(104.2, 34) : new Vector2(100, 8);
    keeper.targetPosition = keeper.position;
    keeper.goalkeeperState = goalkeeper ? "DIVING" : "POSITIONING";
    keeper.goalkeeperReactionUntil = goalkeeper ? 0 : Number.POSITIVE_INFINITY;

    state.ball.release();
    state.ball.position = shooter.position;
    state.ball.previousPosition = shooter.position;
    state.ball.state = BallState.FREE;
    state.ball.noteTouch(shooter.player.id);
    const target = new Vector3(105, targetY, targetHeight);
    const shot: ShotExecution = {
      id: "spatial-shot", shooterId: shooter.player.id, teamId: state.home.team.id,
      defendingTeamId: state.away.team.id, goalkeeperId: goalkeeper ? keeper.player.id : null,
      goalkeeperInitialPosition:goalkeeper ? keeper.position : null,
      origin: new Vector3(99, 34, .18), intendedTarget: target, actualTarget: target,
      initialVelocity: new Vector3(speed, 0, 0), speed, shotType: "PLACED",
      footUsed: "RIGHT", expectedArrivalTime: 1, executionQuality: .8,
      pressureLevel: 0, bodyPosture: "BALANCED", balance: 1, contactQuality: .8,
      curve: 0, startedAt: 0, goalFrame: createGoalFrame(105, 34, 7.32, 2.44),
      lifecycle: "IN_FLIGHT", outcome: null, deflectionCount: 0, lastInteractionPlayerId: null,
      goalkeeperDecision:null,goalkeeperReactionTime:null,
    };
    state.ball.activeShot = shot;
    const beyond = .28;
    const factor = (6 + beyond) / 6;
    BallMotionPlanner.start(state.ball, {
      kind: "SHOT", origin: shooter.position,
      target: new Vector2(105 + beyond, 34 + (targetY - 34) * factor),
      speed, startHeight: .18, targetHeight: .18 + (targetHeight - .18) * factor, peakHeight: 0,
    });
    return { state, shooter, keeper, physics: new BallPhysicsSystem() };
  };

  const run = (fixture: ReturnType<typeof prepare>, maxTicks = 80): MatchEvent[] => {
    const events: MatchEvent[] = [];
    for (let tick = 0; tick < maxTicks; tick++) {
      events.push(...fixture.physics.update(fixture.state, .05));
      fixture.state.currentSecond += .05;
      if (events.some(event => ["GOAL", "SHOT_OFF_TARGET", "SHOT_BLOCKED", "WOODWORK", "GOALKEEPER_SAVE"].includes(event.type))) break;
    }
    return events;
  };

  it("only awards a goal after the whole ball crosses inside the goal surface", () => {
    const fixture = prepare();
    let goal: MatchEvent | undefined;
    let resolution:MatchEvent|undefined;
    for (let tick = 0; tick < 80 && !goal; tick++) {
      const events = fixture.physics.update(fixture.state, .05);
      goal = events.find(event => event.type === "GOAL");
      resolution=events.find(event=>event.type==="SHOT_RESOLVED")??resolution;
      if (!goal) expect(fixture.state.home.score).toBe(0);
      fixture.state.currentSecond += .05;
    }
    expect(goal?.type).toBe("GOAL");
    expect(resolution).toMatchObject({type:"SHOT_RESOLVED",finalOutcome:"GOAL"});
    expect(fixture.state.ball.position.x).toBeGreaterThanOrEqual(105.11 - 1e-6);
    expect(fixture.state.home.score).toBe(1);
    expect(fixture.state.pendingGoalRestart).not.toBeNull();
  });

  it("does not award a goal when the trajectory crosses wide", () => {
    const fixture = prepare(40, 1);
    const events = run(fixture);
    expect(events.some(event => event.type === "SHOT_OFF_TARGET")).toBe(true);
    expect(events.some(event => event.type === "GOAL")).toBe(false);
    expect(fixture.state.home.score).toBe(0);
  });

  it("resolves a shot that leaves through the touchline before reaching goal", () => {
    const fixture = prepare(90, 1, 28, false);
    const events = run(fixture, 120);
    expect(events.some(event => event.type === "SHOT_OFF_TARGET" && event.outcome === "OUT_BEFORE_GOAL_LINE")).toBe(true);
    expect(fixture.state.ball.activeShot).toBeNull();
  });

  it.each([
    [30.34, 1, "POST"],
    [34, 2.44, "CROSSBAR"],
  ])("resolves contact with the goal frame at y=%s z=%s as %s", (y, height, outcome) => {
    const fixture = prepare(y as number, height as number);
    const events = run(fixture);
    expect(events.some(event => event.type === "WOODWORK" && event.outcome === outcome)).toBe(true);
    expect(fixture.state.home.score).toBe(0);
    expect(fixture.state.ball.motion?.kind).toBe("DEFLECTION");
  });

  it("allows an outfield defender to block the travelled segment", () => {
    const fixture = prepare();
    const defender = fixture.state.away.players.find(player => !player.currentRole.includes("GOALKEEPER"))!;
    defender.position = new Vector2(102, 34);
    defender.targetPosition = defender.position;
    const events = run(fixture);
    expect(events.some(event => event.type === "SHOT_BLOCKED")).toBe(true);
    expect(events.some(event => event.type === "BALL_DEFLECTION" && event.deflectorId === defender.player.id)).toBe(true);
    expect(fixture.state.ball.motion?.kind).toBe("DEFLECTION");
  });

  it("keeps a deflected threat causal so it can still cross the goal line",()=>{
    const fixture=prepare();
    const defender=fixture.state.away.players.find(player=>!player.currentRole.includes("GOALKEEPER"))!;
    defender.position=new Vector2(101.8,34.4);defender.targetPosition=defender.position;
    const events:MatchEvent[]=[];
    for(let tick=0;tick<100&&!events.some(event=>event.type==="GOAL"||event.type==="SHOT_RESOLVED");tick++) {
      events.push(...fixture.physics.update(fixture.state,.05));fixture.state.currentSecond+=.05;
    }
    expect(events.some(event=>event.type==="SHOT_BLOCKED")).toBe(true);
    expect(events.some(event=>event.type==="GOAL")).toBe(true);
    expect(events.find(event=>event.type==="SHOT_RESOLVED")).toMatchObject({finalOutcome:"GOAL"});
  });

  it("lets a goalkeeper intervene only after reacting and physically reaching the segment", () => {
    const onTime = prepare(34, 1, 22, true);
    const savedEvents = run(onTime);
    expect(savedEvents.some(event => event.type === "GOALKEEPER_SAVE")).toBe(true);
    expect(onTime.state.home.score).toBe(0);

    const late = prepare(34, 1, 22, true);
    late.keeper.goalkeeperState = "SET";
    late.keeper.goalkeeperReactionUntil = 10;
    const lateEvents = run(late);
    expect(lateEvents.some(event => event.type === "GOALKEEPER_SAVE")).toBe(false);
    expect(lateEvents.some(event => event.type === "GOAL")).toBe(true);
  });

  it("keeps a parried rebound active instead of ending the play", () => {
    const fixture = prepare(34, 1.4, 34, true);
    const events = run(fixture);
    expect(events.some(event => event.type === "GOALKEEPER_SAVE" && !event.caught)).toBe(true);
    expect(events.some(event => event.type === "REBOUND" && event.source === "GOALKEEPER")).toBe(true);
    expect(fixture.state.ball.owner).toBeNull();
    expect(fixture.state.ball.motion?.kind).toBe("DEFLECTION");
  });

  it("does not let generic possession control cancel an active spatial shot", () => {
    const fixture = prepare();
    const nearbyPlayer = fixture.state.home.players.find(player => player !== fixture.shooter)!;
    nearbyPlayer.position = fixture.state.ball.position.add(new Vector2(.1, 0));
    nearbyPlayer.targetPosition = nearbyPlayer.position;

    new PossessionSystem(new SeededRandom(1), new ReachCalculator()).update(fixture.state);

    expect(fixture.state.ball.owner).toBeNull();
    expect(fixture.state.ball.motion?.kind).toBe("SHOT");
    expect(fixture.state.ball.activeShot?.lifecycle).toBe("IN_FLIGHT");
  });
});
