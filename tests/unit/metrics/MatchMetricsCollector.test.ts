import { MatchMetricsCollector } from "../../../src/application/match/metrics/MatchMetricsCollector";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { Milliseconds } from "../../../src/domain";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

describe("MatchMetricsCollector", () => {
  it("counts shots, on-target and goals from events", () => {
    const match = buildMinimalMatchState();
    const collector = new MatchMetricsCollector();
    collector.bindTeams(match.home.team.id, match.away.team.id);

    collector.onEvents(
      [
        {
          id: "s1",
          type: "SHOT",
          timestamp: 1000 as Milliseconds,
          period: "FIRST_HALF",
          teamId: match.home.team.id,
          playerId: match.home.players[0].player.id,
          result: "SAVED",
          targetX: 105,
          targetY: 34,
        },
        {
          id: "s2",
          type: "SHOT",
          timestamp: 2000 as Milliseconds,
          period: "FIRST_HALF",
          teamId: match.home.team.id,
          playerId: match.home.players[0].player.id,
          result: "GOAL",
          targetX: 105,
          targetY: 34,
        },
        {
          id: "g1",
          type: "GOAL",
          timestamp: 2000 as Milliseconds,
          period: "FIRST_HALF",
          teamId: match.home.team.id,
          scorerId: match.home.players[0].player.id,
          assistId: null,
        },
      ],
      match,
    );

    const metrics = collector.finalize();

    expect(metrics.home.shots).toBe(2);
    expect(metrics.home.shotsOnTarget).toBe(2);
    expect(metrics.home.shotsSaved).toBe(1);
    expect(metrics.home.goals).toBe(1);
    expect(metrics.home.xG).toBeGreaterThan(0);
    expect(metrics.totalGoals).toBe(1);
    expect(metrics.totalShots).toBe(2);
  });

  it("tracks passes, progressive passes and PPDA", () => {
    const match = buildMinimalMatchState();
    const collector = new MatchMetricsCollector();
    collector.bindTeams(match.home.team.id, match.away.team.id);

    const homePlayer = match.home.players[0];
    const awayPlayer = match.away.players[0];

    // Home completes 10 passes; away makes 2 tackles → home PPDA related to away defensive actions
    for (let i = 0; i < 10; i++) {
      collector.onActionStarted(homePlayer, DecisionType.PASS, match);
    }
    collector.onActionStarted(awayPlayer, DecisionType.TACKLE, match);
    collector.onActionStarted(awayPlayer, DecisionType.INTERCEPT, match);

    const metrics = collector.finalize();

    expect(metrics.home.passes).toBe(10);
    expect(metrics.away.tackles).toBe(1);
    expect(metrics.away.interceptions).toBe(1);
    // Away faced 10 home passes with 2 defensive actions → PPDA = 5
    expect(metrics.away.ppda).toBe(5);
  });

  it("samples possession and field tilt", () => {
    const match = buildMinimalMatchState();
    const collector = new MatchMetricsCollector();
    collector.bindTeams(match.home.team.id, match.away.team.id);

    // Home keeps ball in attacking third
    match.home.players[0].position = new Vector2(95, 34);
    match.ball.owner = match.home.players[0];

    for (let i = 0; i < 8; i++) {
      collector.sampleState(match);
    }

    // Away gets the ball in own half
    match.away.players[0].position = new Vector2(20, 34);
    match.ball.owner = match.away.players[0];
    for (let i = 0; i < 2; i++) {
      collector.sampleState(match);
    }

    const metrics = collector.finalize();

    expect(metrics.home.possessionPercent).toBeGreaterThan(70);
    expect(metrics.home.fieldTiltPercent).toBeGreaterThan(50);
    expect(metrics.home.attacks).toBeGreaterThanOrEqual(1);
  });

  it("detects high-press recoveries on possession flip in attacking third", () => {
    const match = buildMinimalMatchState();
    const collector = new MatchMetricsCollector();
    collector.bindTeams(match.home.team.id, match.away.team.id);

    // Away has ball deep (near their goal from home perspective = home attacking third)
    const away = match.away.players[0];
    away.position = new Vector2(95, 34);
    match.ball.owner = away;
    collector.sampleState(match);

    // Home recovers high up the pitch
    const home = match.home.players[0];
    home.position = new Vector2(92, 34);
    match.ball.owner = home;
    collector.sampleState(match);

    const metrics = collector.finalize();
    expect(metrics.home.highPressRecoveries).toBeGreaterThanOrEqual(1);
  });

  it("records average shot distance", () => {
    const match = buildMinimalMatchState();
    const collector = new MatchMetricsCollector();
    collector.bindTeams(match.home.team.id, match.away.team.id);

    match.home.players[0].position = new Vector2(90, 34);
    // Shot actions may already have moved/released the ball when metrics run.
    // Distance must still come from the event's playerId.
    match.ball.owner = null;
    match.ball.position = new Vector2(105, 0);

    collector.onEvents(
      [
        {
          id: "s1",
          type: "SHOT",
          timestamp: 1000 as Milliseconds,
          period: "FIRST_HALF",
          teamId: match.home.team.id,
          playerId: match.home.players[0].player.id,
          result: "OFF_TARGET",
          targetX: 105,
          targetY: 34,
        },
      ],
      match,
    );

    const metrics = collector.finalize();
    expect(metrics.home.averageShotDistance).toBeCloseTo(15, 6);
  });
});
