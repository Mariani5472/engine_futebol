import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { WorldAwarenessSystem } from "../awareness/WorldAwarenessSystem";
import { DecisionContext } from "../decision/DecisionContext";
import { DecisionType } from "../decision/DecisionType";
import { ShotEvaluator } from "../decision/evaluators/ShotEvaluator";
import { createPossessionEvaluators } from "../decision/possession/PossessionEvaluators";
import { PossessionDecisionSystem } from "../decision/possession/PossessionDecisionSystem";
import { ActionFactory } from "../action/ActionFactory";
import { ActionExecutionPhase } from "../action/ActionExecution";
import type { ActionExecution } from "../action/ActionExecution";
import { RefereeSystem } from "../referee/RefereeSystem";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { ActionContext } from "../action/ActionContext";

export interface ShotCandidateSnapshot {
  readonly type: string;
  readonly utility: number;
}

export interface ShotFunnelProbeResult {
  readonly world: {
    goalDistance: number;
    shotWindow: number;
    pressure: number;
    fieldThird: string;
    goalAngleQuality: number;
  };
  readonly shotEvaluator: {
    proposed: boolean;
    utility: number;
    components: Readonly<Record<string, number>>;
  };
  readonly candidates: readonly ShotCandidateSnapshot[];
  readonly selected: {
    type: string;
    utility: number;
    isShot: boolean;
  };
  readonly pipeline: {
    started: boolean;
    stepCount: number;
    steps: readonly string[];
  };
  readonly execution: {
    reachedExecuting: boolean;
    shotEvents: number;
    goalEvents: number;
    shotResults: readonly string[];
  };
}

export class ShotFunnelDiagnostics {
  private readonly worldSystem: WorldAwarenessSystem;
  private readonly shotEvaluator = new ShotEvaluator();
  private readonly possessionSystem: PossessionDecisionSystem;
  private readonly actionFactory: ActionFactory;

  constructor(pitchLength: number = 105) {
    this.worldSystem = new WorldAwarenessSystem(pitchLength);
    this.possessionSystem = new PossessionDecisionSystem(
      createPossessionEvaluators(),
      undefined,
      undefined,
      undefined,
      undefined,
      pitchLength,
    );
    this.actionFactory = new ActionFactory(new RefereeSystem(new SeededRandom(1)));
  }

  public probe(
    match: MatchState,
    player: PlayerMatchState,
    options: { tick?: number; deltaTime?: number; maxAdvanceSteps?: number } = {},
  ): ShotFunnelProbeResult {
    const tick = options.tick ?? 0;
    const deltaTime = options.deltaTime ?? 0.5;
    const maxAdvance = options.maxAdvanceSteps ?? 40;

    player.hasBall = true;
    match.ball.owner = player;

    const awareness = PlayerAwareness.create(player.player.id);
    const world = this.worldSystem.build(match, player, awareness);
    const ctx = new DecisionContext(match, player, awareness, tick, deltaTime, world);

    const shotOnly = this.shotEvaluator.evaluate(ctx);
    const shotDecision = shotOnly[0];

    const candidates: ShotCandidateSnapshot[] = [];
    for (const ev of createPossessionEvaluators()) {
      for (const d of ev.evaluate(ctx)) {
        candidates.push({
          type: DecisionType[d.type] ?? String(d.type),
          utility: d.utility,
        });
      }
    }
    candidates.sort((a, b) => b.utility - a.utility);

    const selected = this.possessionSystem.decide(ctx);

    player.activeAction = undefined;
    player.activePipeline = undefined;
    const pipeline = this.actionFactory.tryStart(selected, player, match.currentSecond);
    const steps = pipeline
      ? pipeline.steps.map((s) => DecisionType[s.decision.type] ?? String(s.decision.type))
      : [];

    let reachedExecuting = false;
    let shotEvents = 0;
    let goalEvents = 0;
    const shotResults: string[] = [];

    if (pipeline) {
      let t = match.currentSecond;
      for (let i = 0; i < maxAdvance; i++) {
        t += deltaTime;
        const phase = this.actionFactory.advanceOnly(player, t);
        const activeAction = player.activeAction as ActionExecution | undefined;
        if (phase === ActionExecutionPhase.EXECUTING && activeAction) {
          // If pipeline has CONTROL then SHOT, first EXECUTING may be CONTROL.
          const actionType = activeAction.type;
          const isHome = match.home.players.includes(player);
          const team = isHome ? match.home : match.away;
          const actionCtx: ActionContext = {
            player,
            decision: activeAction.decision,
            match,
            pitch: match.pitch,
            random: new SeededRandom(99),
            tick: tick + i,
            deltaTime,
            teamSide: isHome ? "HOME" : "AWAY",
            attackingDirection: team.attackingDirection,
            matchSecond: t,
          };
          const result = this.actionFactory.resolveExecuting(activeAction, actionCtx);

          if (actionType === DecisionType.SHOT) {
            reachedExecuting = true;
            for (const e of result.events) {
              if (e.type === "SHOT") {
                shotEvents++;
                shotResults.push((e as { result: string }).result);
              }
              if (e.type === "GOAL") goalEvents++;
            }
            break;
          }
          // Continue advancing pipeline after CONTROL etc.
          continue;
        }
        if (phase === ActionExecutionPhase.COMPLETED && !player.activePipeline) break;
        if (!player.activePipeline && !player.activeAction) break;
      }
    }

    return {
      world: {
        goalDistance: world.goalDistance,
        shotWindow: world.shotWindow,
        pressure: world.pressure,
        fieldThird: String(world.fieldThird),
        goalAngleQuality: world.goalAngleQuality,
      },
      shotEvaluator: {
        proposed: !!shotDecision,
        utility: shotDecision?.utility ?? 0,
        components: shotDecision?.components
          ? Object.fromEntries(Object.entries(shotDecision.components).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
          : {},
      },
      candidates,
      selected: {
        type: DecisionType[selected.type] ?? String(selected.type),
        utility: selected.utility,
        isShot: selected.type === DecisionType.SHOT,
      },
      pipeline: {
        started: !!pipeline,
        stepCount: steps.length,
        steps,
      },
      execution: {
        reachedExecuting,
        shotEvents,
        goalEvents,
        shotResults,
      },
    };
  }

  public static format(result: ShotFunnelProbeResult): string {
    return [
      "=== Shot funnel probe ===",
      `World: dist=${result.world.goalDistance.toFixed(1)}m window=${result.world.shotWindow.toFixed(2)} pressure=${result.world.pressure.toFixed(2)} third=${result.world.fieldThird}`,
      `ShotEvaluator: proposed=${result.shotEvaluator.proposed} utility=${result.shotEvaluator.utility.toFixed(1)}`,
      `Top candidates: ${result.candidates.slice(0, 5).map((c) => `${c.type}=${c.utility.toFixed(1)}`).join(", ")}`,
      `Selected: ${result.selected.type} (${result.selected.utility.toFixed(1)}) shot=${result.selected.isShot}`,
      `Pipeline: started=${result.pipeline.started} steps=[${result.pipeline.steps.join(" → ")}]`,
      `Execution: shotExecuting=${result.execution.reachedExecuting} shots=${result.execution.shotEvents} goals=${result.execution.goalEvents} results=[${result.execution.shotResults.join(",")}]`,
    ].join("\n");
  }
}
