import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionDebug } from "../../../src/application/match/decision/DecisionDebug";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { UtilityScore } from "../../../src/application/match/decision/UtilityScore";
import { buildPlayerMatchState } from "../../helpers/builders";

describe("DecisionDebug", () => {
  it("does not record when disabled", () => {
    const debug = new DecisionDebug();
    const player = buildPlayerMatchState();
    const decision = new Decision(DecisionType.PASS, 50);

    debug.record(player, decision, { tick: 1, matchSecond: 0.5 });
    expect(debug.getEntries()).toHaveLength(0);
  });

  it("records and formats a decision with component reasons", () => {
    const logs: string[] = [];
    const debug = new DecisionDebug({
      logToConsole: true,
      logger: (msg) => logs.push(msg),
    });
    debug.enable();

    const player = buildPlayerMatchState({ hasBall: true });
    const score = UtilityScore.fromComponents({
      SPACE: 21,
      PRESSURE: -9,
      TECHNIQUE: 18,
      ROLE: 8,
      RISK: -4,
    });

    const decision = new Decision(
      DecisionType.PASS,
      score.total,
      "teammate-3",
      score.reasons,
      score.components,
    );

    debug.record(player, decision, { tick: 10, matchSecond: 5 });

    expect(debug.getEntries()).toHaveLength(1);
    const formatted = debug.formatEntry(debug.getEntries()[0]);

    expect(formatted).toContain("Decision: PASS");
    expect(formatted).toContain("teammate-3");
    expect(formatted).toContain("Utility:");
    expect(formatted).toContain("SPACE");
    expect(formatted).toContain("PRESSURE");
    expect(formatted).toContain("TECHNIQUE");
    expect(formatted).toContain("+21.0");
    expect(formatted).toContain("-9.0");

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("PASS");
  });

  it("filters entries by player", () => {
    const debug = new DecisionDebug();
    debug.enable();

    const a = buildPlayerMatchState();
    const b = buildPlayerMatchState();

    debug.record(a, new Decision(DecisionType.SHOT, 40), { tick: 1, matchSecond: 0 });
    debug.record(b, new Decision(DecisionType.PASS, 30), { tick: 2, matchSecond: 1 });

    expect(debug.forPlayer(a.player.id)).toHaveLength(1);
    expect(debug.forPlayer(a.player.id)[0].decisionType).toBe(DecisionType.SHOT);
  });
});
