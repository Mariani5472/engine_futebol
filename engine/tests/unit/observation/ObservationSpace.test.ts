import { Vector2 } from "../../../src/core/geometry/Vector2";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { PlayerMemory } from "../../../src/application/match/awareness/memory/PlayerMemory";
import {
  ACTOR_OBSERVATION_VECTOR_SIZE,
  ACTOR_OBSERVATION_VERSION,
  DEBUG_OBSERVATION_VERSION,
  OBSERVATION_SPACE,
  PRIVILEGED_CRITIC_OBSERVATION_VERSION,
  PRIVILEGED_CRITIC_VECTOR_SIZE,
} from "../../../src/application/match/observation/ObservationSpace";
import { PLAYER_ACTION_SPACE } from "../../../src/application/match/policy/PlayerActionSpace";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { buildSimulationConfig } from "../../helpers/builders";

describe("ObservationSpace", () => {
  function fixture() {
    const { state, awarenessMap } = new MatchInitializer().initialize(buildSimulationConfig(51));
    const player = state.home.players[1];
    const awareness = awarenessMap.get(player.player.id)!;
    awareness.teammates.clear();
    awareness.opponents.clear();
    awareness.ball.estimatedPosition = new Vector2(30, 31);
    awareness.ball.estimatedVelocity = new Vector2(4, -2);
    awareness.ball.certainty = 0.7;
    awareness.opponents.set("away-2", new PlayerMemory(
      "away-2", new Vector2(44, 28), new Vector2(-1, 2), 0.6, 8, 8, 1,
    ));
    const mask = PLAYER_ACTION_SPACE.mask(player.player.id, 0, [new Decision(DecisionType.MOVE, 1)]);
    return { state, player, awareness, mask };
  }

  it("has versioned, fixed-size normalized actor features", () => {
    const { state, player, awareness, mask } = fixture();
    const actor = OBSERVATION_SPACE.buildActor(state, player, awareness, 10, mask);

    expect(actor.version).toBe(ACTOR_OBSERVATION_VERSION);
    expect(actor.vector).toHaveLength(ACTOR_OBSERVATION_VECTOR_SIZE);
    expect(actor.vector.every(value => Number.isFinite(value) && value >= -1 && value <= 1)).toBe(true);
    expect(actor.teammates).toHaveLength(10);
    expect(actor.opponents).toHaveLength(11);
    expect(actor.opponents.filter(entity => entity.present)).toHaveLength(1);
    expect(Object.isFrozen(actor)).toBe(true);
  });

  it("does not change when unobserved ground truth or exact ball physics changes", () => {
    const { state, player, awareness, mask } = fixture();
    const before = OBSERVATION_SPACE.buildActor(state, player, awareness, 10, mask);
    const criticBefore = OBSERVATION_SPACE.privilegedCritic(state, player.player.id);
    const debugBefore = OBSERVATION_SPACE.debug(state, player.player.id);

    state.away.players[5].position = new Vector2(100, 67);
    state.away.players[5].velocity = new Vector2(9, -8);
    state.ball.position = new Vector2(104, 1);
    state.ball.velocity = new Vector2(38, 12);
    state.ball.height = 7;

    const after = OBSERVATION_SPACE.buildActor(state, player, awareness, 10, mask);
    expect(after).toEqual(before);
    expect(OBSERVATION_SPACE.privilegedCritic(state, player.player.id)).not.toEqual(criticBefore);
    expect(OBSERVATION_SPACE.debug(state, player.player.id)).not.toEqual(debugBefore);
  });

  it("keeps privileged and raw debug data outside the actor schema", () => {
    const { state, player, awareness, mask } = fixture();
    const actor = OBSERVATION_SPACE.buildActor(state, player, awareness, 10, mask);
    const critic = OBSERVATION_SPACE.privilegedCritic(state, player.player.id);
    const debug = OBSERVATION_SPACE.debug(state, player.player.id);

    expect(critic.version).toBe(PRIVILEGED_CRITIC_OBSERVATION_VERSION);
    expect(debug.version).toBe(DEBUG_OBSERVATION_VERSION);
    expect(critic.players).toHaveLength(22);
    expect(critic.vector).toHaveLength(PRIVILEGED_CRITIC_VECTOR_SIZE);
    expect(critic.vector.every(value => Number.isFinite(value) && value >= -1 && value <= 1)).toBe(true);
    expect(debug.players).toHaveLength(22);
    expect(Object.keys(actor)).not.toEqual(expect.arrayContaining(["players", "ballOwnerId", "score"]));
    expect(JSON.stringify(actor)).not.toContain("targetPosition");
    expect(JSON.stringify(actor)).not.toContain("nextDecisionAt");
    expect(JSON.stringify(critic)).not.toContain("targetPosition");
    expect(JSON.stringify(debug)).toContain("targetPosition");
  });
});
