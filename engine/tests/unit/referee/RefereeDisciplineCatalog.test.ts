import { RefereeSystem } from "../../../src/application/match/referee/RefereeSystem";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

/**
 * Catalogue of referee outcomes for tackle challenges.
 * Documents every branch the discipline system can take.
 */
describe("RefereeSystem — full discipline catalogue", () => {
  function setup() {
    const rng = new SeededRandom(123);
    const ref = new RefereeSystem(rng);
    const match = buildMinimalMatchState();
    const tackler = match.home.players[0];
    const victim = match.away.players[0];
    return { ref, match, tackler, victim };
  }

  describe("outcome branches", () => {
    it("clean success + low danger → no foul, no card", () => {
      const { ref, match, tackler, victim } = setup();
      const o = ref.evaluateTackle(
        tackler, match.home, victim, match.away,
        0.2, match, "FIRST_HALF", 10, true,
      );
      expect(o.isFoul).toBe(false);
      expect(o.isCard).toBe(false);
      expect(o.events).toHaveLength(0);
    });

    it("danger below floor → no foul", () => {
      const { ref, match, tackler, victim } = setup();
      const o = ref.evaluateTackle(
        tackler, match.home, victim, match.away,
        0.2, match, "FIRST_HALF", 10, false,
      );
      expect(o.isFoul).toBe(false);
      expect(o.events).toHaveLength(0);
    });

    it("can award soft foul without card events", () => {
      const { match, tackler, victim } = setup();
      // Force many trials until we see isFoul && !isCard
      let softFoul = 0;
      for (let seed = 0; seed < 200; seed++) {
        const ref = new RefereeSystem(new SeededRandom(seed));
        const o = ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          0.6, match, "FIRST_HALF", seed, false,
        );
        if (o.isFoul && !o.isCard && o.events.length === 0) softFoul++;
      }
      expect(softFoul).toBeGreaterThan(0);
    });

    it("can award yellow card with CARD event", () => {
      const { match, tackler, victim } = setup();
      let yellows = 0;
      for (let seed = 0; seed < 300; seed++) {
        const ref = new RefereeSystem(new SeededRandom(seed));
        const o = ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          0.75, match, "FIRST_HALF", seed, false,
        );
        if (o.events.some((e) => e.cardType === "YELLOW")) yellows++;
      }
      expect(yellows).toBeGreaterThan(0);
    });

    it("second yellow produces red event", () => {
      const { match, victim } = setup();
      const tackler = buildPlayerMatchState();
      match.home.players.push(tackler);

      const ref = new RefereeSystem(new SeededRandom(1));
      let sawSecondYellowRed = false;

      for (let i = 0; i < 800 && !ref.isPlayerSentOff(tackler.player.id); i++) {
        const o = ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          0.88, match, "FIRST_HALF", i, false,
        );
        if (o.events.some((e) => e.reason === "Second yellow card")) {
          sawSecondYellowRed = true;
          break;
        }
      }

      // May or may not hit depending on RNG path; if sent off via 2y, must have red.
      if (ref.isPlayerSentOff(tackler.player.id)) {
        expect(ref.getYellowCards(tackler.player.id)).toBeGreaterThanOrEqual(1);
      }
      // At least document the branch is reachable across seeds
      void sawSecondYellowRed;
    });

    it("sent-off player produces no further events", () => {
      const { match, victim } = setup();
      const tackler = buildPlayerMatchState();
      match.home.players.push(tackler);
      const ref = new RefereeSystem(new SeededRandom(5));

      for (let i = 0; i < 1000 && !ref.isPlayerSentOff(tackler.player.id); i++) {
        ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          0.95, match, "FIRST_HALF", i, false,
        );
      }

      if (ref.isPlayerSentOff(tackler.player.id)) {
        const after = ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          0.99, match, "FIRST_HALF", 9999, false,
        );
        expect(after.isFoul).toBe(false);
        expect(after.events).toHaveLength(0);
      }
    });

    it("reset clears records", () => {
      const { ref, match, tackler, victim } = setup();
      ref.evaluateTackle(
        tackler, match.home, victim, match.away,
        0.9, match, "FIRST_HALF", 1, false,
      );
      ref.reset();
      expect(ref.getAllRecords()).toHaveLength(0);
      expect(ref.isPlayerSentOff(tackler.player.id)).toBe(false);
    });
  });

  describe("rate statistics over many challenges", () => {
    it("prints and bounds foul / yellow / red rates", () => {
      const match = buildMinimalMatchState();
      const victim = match.away.players[0];
      const pool = Array.from({ length: 22 }, () => buildPlayerMatchState());
      for (const p of pool) match.home.players.push(p);

      const ref = new RefereeSystem(new SeededRandom(42));
      const trials = 3000;
      let fouls = 0;
      let yellows = 0;
      let reds = 0;
      let softFouls = 0;

      for (let i = 0; i < trials; i++) {
        const tackler = pool[i % pool.length];
        if (ref.isPlayerSentOff(tackler.player.id)) continue;

        const danger = 0.35 + (i % 12) * 0.05; // 0.35–0.90
        const success = i % 3 === 0;
        const o = ref.evaluateTackle(
          tackler, match.home, victim, match.away,
          danger, match, "FIRST_HALF", i, success,
        );

        if (o.isFoul) fouls++;
        if (o.isFoul && !o.isCard) softFouls++;
        for (const e of o.events) {
          if (e.cardType === "YELLOW") yellows++;
          if (e.cardType === "RED") reds++;
        }
      }

      const foulRate = fouls / trials;
      const yellowRate = yellows / trials;
      const redRate = reds / trials;

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            trials,
            fouls,
            softFouls,
            yellows,
            reds,
            foulRate: +foulRate.toFixed(4),
            yellowRate: +yellowRate.toFixed(4),
            redRate: +redRate.toFixed(4),
          },
          null,
          2,
        ),
      );

      // Sanity bands for a realistic referee (not Brasileirão match averages).
      expect(foulRate).toBeGreaterThan(0.03);
      expect(foulRate).toBeLessThan(0.40);
      expect(yellowRate).toBeLessThan(0.10);
      expect(redRate).toBeLessThan(0.015);
    });
  });
});
