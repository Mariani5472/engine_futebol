import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { PlayerMemory } from "../../../src/application/match/awareness/memory/PlayerMemory";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { FieldThird } from "../../../src/domain";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

describe("WorldAwarenessSystem", () => {
  const system = new WorldAwarenessSystem();

  it("reports high pressure when an opponent is very close", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const defender = match.away.players[0];

    carrier.position = new Vector2(80, 34);
    defender.position = new Vector2(81, 34);

    const world = system.build(match, carrier);

    expect(world.pressure).toBeGreaterThan(0.7);
    expect(world.nearestOpponent).toBeDefined();
    expect(world.nearestOpponent!.distance).toBeLessThan(2);
    expect(world.freeSpace).toBeLessThan(0.4);
  });

  it("reports low pressure and high free space when isolated", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const defender = match.away.players[0];

    carrier.position = new Vector2(50, 34);
    defender.position = new Vector2(100, 34);

    const world = system.build(match, carrier);

    expect(world.pressure).toBeLessThan(0.15);
    expect(world.freeSpace).toBeGreaterThan(0.7);
  });

  it("computes goalDistance and shotWindow in the attacking third", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    carrier.position = new Vector2(95, 34);

    const world = system.build(match, carrier);

    expect(world.goalDistance).toBeLessThan(15);
    expect(world.fieldThird).toBe(FieldThird.ATTACKING);
    expect(world.shotWindow).toBeGreaterThan(0.5);
    expect(world.goalAngleQuality).toBeGreaterThan(0.8);
  });

  it("builds passing lanes toward teammates", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const teammate = buildPlayerMatchState({
      position: new Vector2(70, 40),
      hasBall: false,
    });
    match.home.players.push(teammate);

    carrier.position = new Vector2(60, 34);
    carrier.hasBall = true;

    const world = system.build(match, carrier);

    expect(world.supportPlayers.length).toBeGreaterThan(0);
    expect(world.passingLanes.length).toBeGreaterThan(0);
    expect(world.passingLanes[0].targetId).toBe(teammate.player.id);
  });

  it("detects cross opportunity from a wide advanced position", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const target = buildPlayerMatchState({
      position: new Vector2(98, 34),
      hasBall: false,
      role: "STRIKER",
    });
    match.home.players.push(target);

    carrier.position = new Vector2(95, 8);
    carrier.hasBall = true;

    const world = system.build(match, carrier);

    expect(world.crossOpportunity).toBeGreaterThan(0.25);
  });

  it("uses awareness memory for passing lanes when available", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    carrier.position = new Vector2(60, 34);

    const awareness = PlayerAwareness.create(carrier.player.id);
    const mem = PlayerMemory.create("mem-tm-1", new Vector2(65, 30), 0);
    mem.certainty = 0.8;
    awareness.teammates.set("mem-tm-1", mem);

    const world = system.build(match, carrier, awareness);

    const memLane = world.passingLanes.find((l) => l.targetId === "mem-tm-1");
    expect(memLane).toBeDefined();
    expect(memLane!.certainty).toBe(0.8);
  });
});
