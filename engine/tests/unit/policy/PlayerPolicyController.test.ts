import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { ExternalPlayerPolicy, RandomValidPlayerPolicy, ScriptedPlayerPolicy } from "../../../src/application/match/policy/PlayerPolicies";
import { PlayerPolicyController } from "../../../src/application/match/policy/PlayerPolicyController";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import type { ActorObservation } from "../../../src/application/match/observation/ObservationSpace";

describe("PlayerPolicyController", () => {
  const hold = new Decision(DecisionType.HOLD_BALL, 20);
  const move = new Decision(DecisionType.MOVE, 10);
  const cover = new Decision(DecisionType.COVER, 9, "opponent-7");
  const input = (overrides: Partial<Parameters<PlayerPolicyController["decide"]>[0]> = {}) => ({
    playerId: "home-2",
    matchSecond: 12,
    hasBall: false,
    validDecisions: [move, cover],
    heuristicDecision: () => move,
    buildActorObservation: actionMask => ({
      kind: "ACTOR",
      version: 1,
      playerId: "home-2",
      teamId: "home",
      matchSecond: 12,
      actionMask,
    } as unknown as ActorObservation),
    ...overrides,
  });

  it("uses the current heuristic through the default adapter", () => {
    const controller = new PlayerPolicyController();
    expect(controller.decide(input())).toBe(move);
    expect(controller.decisions()[0]).toMatchObject({
      policyId: "heuristic-v1",
      reason: "HEURISTIC",
      accepted: true,
    });
  });

  it("accepts only evaluator-backed scripted actions and falls back to the heuristic", () => {
    const controller = new PlayerPolicyController();
    controller.bind("home-2", new ScriptedPlayerPolicy([
      { type: DecisionType.COVER, targetId: "opponent-7" },
      { type: DecisionType.PASS, targetId: "missing" },
    ]));

    expect(controller.decide(input())).toBe(cover);
    expect(controller.decide(input())).toBe(move);
    expect(controller.decisions().map(record => record.reason)).toEqual([
      "ACCEPTED",
      "INVALID_FALLBACK",
    ]);
  });

  it("accepts stable action IDs through the same generated mask", () => {
    const controller = new PlayerPolicyController();
    const external = new ExternalPlayerPolicy();
    controller.bind("home-2", external);
    controller.submit("home-2", { actionId: "COVER", targetId: "opponent-7" });

    expect(controller.decide(input())).toBe(cover);
    expect(controller.actionMask("home-2")?.bits[DecisionType.COVER]).toBe(1);
    expect(controller.decisions()[0]).toMatchObject({
      requestedActionId: "COVER",
      selectedActionId: "COVER",
      accepted: true,
    });
  });

  it("passes only the actor observation through the policy boundary", () => {
    const controller = new PlayerPolicyController();
    let received: ActorObservation | undefined;
    controller.bind("home-2", {
      id: "observation-probe",
      fallback: "SAFE",
      decide(policyInput) {
        received = policyInput.observation;
        return { decision: move, canonical: false };
      },
    });

    controller.decide(input());
    expect(received?.kind).toBe("ACTOR");
    expect(received).not.toHaveProperty("players");
    expect(received).not.toHaveProperty("ballOwnerId");
    expect(received).not.toHaveProperty("debug");
  });

  it("selects a deterministic valid action in the random policy", () => {
    const left = new PlayerPolicyController();
    const right = new PlayerPolicyController();
    left.bind("home-2", new RandomValidPlayerPolicy(new SeededRandom(91)));
    right.bind("home-2", new RandomValidPlayerPolicy(new SeededRandom(91)));

    const leftTypes = Array.from({ length: 8 }, () => left.decide(input()).type);
    const rightTypes = Array.from({ length: 8 }, () => right.decide(input()).type);
    expect(leftTypes).toEqual(rightTypes);
    expect(leftTypes.every(type => [DecisionType.MOVE, DecisionType.COVER].includes(type))).toBe(true);
  });

  it("keeps external control on a safe action when a command is absent or invalid", () => {
    const controller = new PlayerPolicyController();
    controller.bind("home-2", new ExternalPlayerPolicy());
    controller.submit("home-2", { type: DecisionType.PASS, targetId: "missing" });

    expect(controller.decide(input({ hasBall: true, validDecisions: [hold] }))).toBe(hold);
    expect(controller.decide(input())).toBe(move);
    expect(controller.decisions().map(record => [record.accepted, record.reason])).toEqual([
      [false, "INVALID_FALLBACK"],
      [false, "EMPTY_FALLBACK"],
    ]);
  });
});
