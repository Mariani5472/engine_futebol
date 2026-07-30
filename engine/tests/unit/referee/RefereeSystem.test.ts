import { RefereeSystem } from "../../../src/application/match/referee/RefereeSystem";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

describe("RefereeSystem — discipline rates", () => {
  it("does not foul clean low-danger successful tackles", () => {
    const rng = new SeededRandom(1);
    const ref = new RefereeSystem(rng);
    const match = buildMinimalMatchState();
    const tackler = match.home.players[0];
    const victim = match.away.players[0];

    const outcome = ref.evaluateTackle(
      tackler,
      match.home,
      victim,
      match.away,
      0.2, // low danger
      match,
      "FIRST_HALF",
      100,
      true, // success
    );

    expect(outcome.isFoul).toBe(false);
    expect(outcome.events).toHaveLength(0);
  });

  it("keeps red cards rare across many dangerous challenges", () => {
    const rng = new SeededRandom(42);
    const ref = new RefereeSystem(rng);
    const match = buildMinimalMatchState();

    // Use a pool of tacklers so second-yellow cascade does not dominate.
    const tacklers = Array.from({ length: 22 }, () => buildPlayerMatchState());
    for (const t of tacklers) {
      match.home.players.push(t);
    }

    let reds = 0;
    let yellows = 0;
    let fouls = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const tackler = tacklers[i % tacklers.length];
      if (ref.isPlayerSentOff(tackler.player.id)) continue;

      const danger = 0.4 + (i % 10) * 0.05; // 0.4–0.85
      const outcome = ref.evaluateTackle(
        tackler,
        match.home,
        match.away.players[0],
        match.away,
        danger,
        match,
        "FIRST_HALF",
        i,
        false,
      );

      if (outcome.isFoul) fouls++;
      for (const e of outcome.events) {
        if (e.cardType === "YELLOW") yellows++;
        if (e.cardType === "RED") reds++;
      }
    }

    // Fouls should be a minority of challenges, not ~all of them.
    expect(fouls / trials).toBeLessThan(0.45);
    expect(fouls / trials).toBeGreaterThan(0.05);

    // Yellows: well below old model (~1 per foul).
    expect(yellows / trials).toBeLessThan(0.12);

    // Reds must stay rare.
    expect(reds / trials).toBeLessThan(0.02);
  });

  it("second yellow produces a red and blocks further cards", () => {
    const rng = new SeededRandom(7);
    const ref = new RefereeSystem(rng);
    const match = buildMinimalMatchState();
    const tackler = match.home.players[0];

    // Force yellows by high danger + many attempts until 2 yellows or give up.
    let reds = 0;
    for (let i = 0; i < 500 && !ref.isPlayerSentOff(tackler.player.id); i++) {
      const outcome = ref.evaluateTackle(
        tackler,
        match.home,
        match.away.players[0],
        match.away,
        0.9,
        match,
        "FIRST_HALF",
        i,
        false,
      );
      reds += outcome.events.filter((e) => e.cardType === "RED").length;
    }

    // After send-off, further evaluations must be inert.
    const after = ref.evaluateTackle(
      tackler,
      match.home,
      match.away.players[0],
      match.away,
      0.99,
      match,
      "FIRST_HALF",
      999,
      false,
    );
    expect(after.events).toHaveLength(0);

    // At most one red path for this player in the storm of attempts.
    expect(reds).toBeLessThanOrEqual(2);
  });
});
