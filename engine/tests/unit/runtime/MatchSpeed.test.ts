import { MatchSession, type MatchSpeed } from "../../../src/application/match/engine/MatchSession";
import { buildSimulationConfig } from "../../helpers/builders";

describe("logical equivalence across server speeds", () => {
  const simulate = (speed: MatchSpeed) => {
    const session = MatchSession.create({ ...buildSimulationConfig(77), maxDurationSeconds: 2, tickDeltaSeconds: .05 });
    session.setSpeed(speed);
    while (!session.isFinished()) {
      for (let update = 0; update < speed && !session.isFinished(); update++) session.update(.05);
    }
    return session.result()!;
  };

  it.each([1, 2, 4, 8, 50] as MatchSpeed[])("keeps seed 77 equivalent at %sx", speed => {
    const baseline = simulate(1);
    const accelerated = simulate(speed);
    expect(accelerated.homeScore).toBe(baseline.homeScore);
    expect(accelerated.awayScore).toBe(baseline.awayScore);
    expect(accelerated.events).toEqual(baseline.events);
    expect(accelerated.diagnostics).toEqual(baseline.diagnostics);
  });
});
