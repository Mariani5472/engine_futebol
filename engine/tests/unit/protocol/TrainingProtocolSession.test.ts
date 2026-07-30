import { TrainingProtocolSession } from "../../../src/application/match/protocol/TrainingProtocolSession";
import { TRAINING_PROTOCOL_VERSION, type TrainingRequest, type TrainingResponse } from "../../../src/application/match/protocol/TrainingProtocol";

let sequence = 0;
function request<T>(type: TrainingRequest["type"], payload?: T, version = TRAINING_PROTOCOL_VERSION): TrainingRequest<T> {
  return { protocolVersion: version, requestId: `request-${++sequence}`, type, payload };
}

function successful<T>(response: TrainingResponse<T>): T {
  if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
  return response.payload;
}

describe("TrainingProtocolSession", () => {
  it("negotiates all schema versions before environment use", () => {
    const payload = successful<Record<string, unknown>>(new TrainingProtocolSession().handle(request("HELLO")));
    expect(payload).toMatchObject({
      protocolVersion: 1,
      observationVersion: 1,
      actionSpaceVersion: 1,
      rewardVersion: 1,
      environmentVersion: 1,
      scenarioVersion: 1,
    });
  });

  it("keeps an environment alive across reset and step messages", () => {
    const session = new TrainingProtocolSession();
    const created = successful<{ environmentId: string }>(session.handle(request("CREATE", {
      environmentId: "persistent-1",
      kind: "ATTACKER_VS_GOALKEEPER",
      seed: 41,
      maxDecisionSteps: 5,
      maxEpisodePhysicalTicks: 500,
    })));
    expect(created.environmentId).toBe("persistent-1");
    expect(session.environmentCount()).toBe(1);

    const reset = successful<any>(session.handle(request("RESET", { environmentId: "persistent-1", seed: 41 })));
    expect(reset.observation.vector).toHaveLength(189);
    expect(reset.actionMask.entries).toHaveLength(24);
    expect(reset.actionMask.entries.find((entry: any) => entry.id === "SHOT").enabled).toBe(true);

    const transition = successful<any>(session.handle(request("STEP", {
      environmentId: "persistent-1",
      action: { actionId: "SHOT" },
    })));
    expect(transition.outcome).not.toBeNull();
    expect(transition.rewardBreakdown.version).toBe(1);
    expect(transition.reward).toBe(transition.rewardBreakdown.total);
    expect(session.environmentCount()).toBe(1);
  });

  it("publishes a compact PPO payload without actor entities or event history", () => {
    const session = new TrainingProtocolSession();
    successful(session.handle(request("CREATE", {
      environmentId: "full-reference",
      kind: "ATTACKER_VS_GOALKEEPER",
      wireFormat: "FULL",
      seed: 9,
    })));
    const created = successful<any>(session.handle(request("CREATE", {
      environmentId: "compact",
      kind: "ATTACKER_VS_GOALKEEPER",
      wireFormat: "COMPACT",
      seed: 9,
    })));
    expect(created.wireFormat).toBe("COMPACT");
    const reset = successful<any>(session.handle(request("RESET", { environmentId: "compact", seed: 9 })));
    expect(reset.observation).toEqual(expect.objectContaining({ kind: "ACTOR", version: 1 }));
    expect(reset.observation.vector).toHaveLength(189);
    expect(reset.observation.self).toBeUndefined();
    expect(reset.info.events).toBeUndefined();
    expect(reset.actionMask.entries).toHaveLength(24);
    const full = successful<any>(session.handle(request("RESET", { environmentId: "full-reference", seed: 9 })));
    expect(JSON.stringify(reset).length).toBeLessThan(JSON.stringify(full).length * 0.5);
  });

  it("runs a versioned multi-agent curriculum environment over the persistent protocol", () => {
    const session = new TrainingProtocolSession();
    const hello = successful<any>(session.handle(request("HELLO")));
    expect(hello.capabilities).toEqual(expect.arrayContaining(["curriculum", "multi_agent", "shared_policy", "self_play"]));
    successful(session.handle(request("CREATE", {
      environmentId: "passing-curriculum",
      kind: "CURRICULUM",
      stage: "PASS",
      playerIds: ["home-10", "home-9"],
      wireFormat: "COMPACT",
      seed: 63,
      maxJointDecisionSteps: 8,
      maxEpisodePhysicalTicks: 1_000,
    })));
    const reset = successful<any>(session.handle(request("RESET", { environmentId: "passing-curriculum", seed: 63 })));
    expect(reset.activeAgentIds.length).toBeGreaterThan(0);
    expect(reset.info.events).toBeUndefined();
    const actions = Object.fromEntries(reset.activeAgentIds.map((playerId: string) => {
      const entries = reset.actionMasks[playerId].entries;
      const entry = playerId === "home-10"
        ? entries.find((candidate: any) => candidate.id === "PASS" && candidate.enabled && candidate.validTargetIds.includes("home-9"))
        : entries.find((candidate: any) => candidate.enabled && candidate.id !== "NONE");
      if (!entry) throw new Error(`No valid curriculum action for ${playerId}`);
      return [playerId, { actionId: entry.id, targetId: entry.validTargetIds.find((id: string | null) => id !== null) }];
    }));
    const transition = successful<any>(session.handle(request("STEP", { environmentId: "passing-curriculum", actions })));
    expect(transition.rewards).toHaveProperty("home-10");
    expect(transition.info.jointDecisionStep).toBe(1);
  });

  it("returns structured recoverable errors without killing the session", () => {
    const session = new TrainingProtocolSession();
    successful(session.handle(request("CREATE", { environmentId: "safe", kind: "ATTACKER_VS_GOALKEEPER", seed: 2 })));
    successful(session.handle(request("RESET", { environmentId: "safe", seed: 2 })));

    const invalid = session.handle(request("STEP", { environmentId: "safe", action: { actionId: "NONE" } }));
    expect(invalid).toMatchObject({ ok: false, error: { code: "ENVIRONMENT_ERROR", recoverable: true } });
    const valid = session.handle(request("STEP", { environmentId: "safe", action: { actionId: "SHOT" } }));
    expect(valid.ok).toBe(true);

    const missing = session.handle(request("RESET", { environmentId: "missing" }));
    expect(missing).toMatchObject({ ok: false, error: { code: "ENVIRONMENT_NOT_FOUND", recoverable: true } });
  });

  it("rejects incompatible versions and duplicate IDs explicitly", () => {
    const session = new TrainingProtocolSession();
    expect(session.handle(request("HELLO", {}, 99))).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_VERSION", recoverable: false },
    });
    successful(session.handle(request("CREATE", { environmentId: "duplicate", kind: "ATTACKER_VS_GOALKEEPER" })));
    expect(session.handle(request("CREATE", { environmentId: "duplicate", kind: "ATTACKER_VS_GOALKEEPER" })))
      .toMatchObject({ ok: false, error: { code: "ENVIRONMENT_EXISTS" } });
  });

  it("closes individual environments and supports graceful process shutdown", () => {
    const session = new TrainingProtocolSession();
    successful(session.handle(request("CREATE", { environmentId: "close-me", kind: "ATTACKER_VS_GOALKEEPER" })));
    expect(successful(session.handle(request("CLOSE_ENV", { environmentId: "close-me" })))).toEqual({ environmentId: "close-me", closed: true });
    expect(session.environmentCount()).toBe(0);
    expect(successful(session.handle(request("SHUTDOWN")))).toEqual({ shutdown: true });
    expect(session.isShutdownRequested()).toBe(true);
  });
});
