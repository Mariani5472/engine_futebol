import { UtilityScore } from "../../../src/application/match/decision/UtilityScore";

describe("UtilityScore — component model (Phase 7)", () => {
  it("sums named components into total", () => {
    const score = UtilityScore.fromComponents({
      SPACE: 21,
      PRESSURE: -9,
      TECHNIQUE: 18,
      ROLE: 8,
      RISK: -4,
      BODY: 6,
    });

    expect(score.total).toBeCloseTo(21 - 9 + 18 + 8 - 4 + 6);
  });

  it("exposes each component for debug", () => {
    const score = UtilityScore.fromComponents({
      SPACE: 21,
      PRESSURE: -9,
      TECHNIQUE: 18,
    });

    expect(score.components.SPACE).toBe(21);
    expect(score.components.PRESSURE).toBe(-9);
    expect(score.components.TECHNIQUE).toBe(18);
  });

  it("formatDebug lists components and total", () => {
    const score = UtilityScore.fromComponents({
      SPACE: 21,
      PRESSURE: -9,
      TECHNIQUE: 18,
    });

    const debug = score.formatDebug("SHOT");
    expect(debug).toContain("SHOT");
    expect(debug).toContain("SPACE");
    expect(debug).toContain("PRESSURE");
    expect(debug).toContain("TECHNIQUE");
    expect(debug).toContain("TOTAL");
  });

  it("legacy constructor still works", () => {
    const score = new UtilityScore(50, 10, 5, 8, [{ code: "BASE", value: 50 }]);
    expect(score.total).toBe(50 + 10 + 5 - 8);
  });

  it("treats non-finite component values as zero", () => {
    const score = UtilityScore.fromComponents({
      SPACE: 10,
      PRESSURE: Number.NaN,
      TECHNIQUE: 5,
    });
    expect(score.total).toBe(15);
    expect(score.components.PRESSURE).toBe(0);
  });
});
