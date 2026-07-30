import { SeededRandom } from "../../../core/random/SeededRandom";
import type { ActorObservation } from "../observation/ObservationSpace";
import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type { PlayerActionId, PlayerActionMask, PlayerActionMaskEntry } from "../policy/PlayerActionSpace";

export type BaselineId = "RANDOM_VALID" | "IMMEDIATE_SHOT" | "APPROACH_AND_SHOOT" | "OBSERVABLE_HEURISTIC";

export interface BaselineDecisionContext {
  readonly observation: ActorObservation;
  readonly actionMask: PlayerActionMask;
  readonly decisionStep: number;
}

export interface BaselineAgent {
  select(context: BaselineDecisionContext): PlayerActionCommand;
}

export interface BaselineDefinition {
  readonly id: BaselineId;
  readonly description: string;
  create(policySeed: number): BaselineAgent;
}

export interface ApproachAndShootOptions {
  /** Normalized pitch-length distance to the attacking goal. */
  readonly shootWithinDistance?: number;
}

export function createDefaultBaselines(
  approachOptions: ApproachAndShootOptions = {},
): readonly BaselineDefinition[] {
  return Object.freeze([
    randomValidBaseline(),
    immediateShotBaseline(),
    approachAndShootBaseline(approachOptions),
    observableHeuristicBaseline(),
  ]);
}

export function randomValidBaseline(): BaselineDefinition {
  return Object.freeze({
    id: "RANDOM_VALID" as const,
    description: "Uniformly samples a valid discrete action/target using an isolated policy RNG.",
    create: (policySeed: number): BaselineAgent => {
      const random = new SeededRandom(policySeed);
      return Object.freeze({
        select: ({ actionMask }: BaselineDecisionContext): PlayerActionCommand => {
          const commands = validCommands(actionMask);
          const useful = commands.filter(command => command.actionId !== "NONE");
          const pool = useful.length > 0 ? useful : commands;
          if (pool.length === 0) throw new Error("Action mask contains no valid command");
          return pool[random.nextInt(0, pool.length - 1)];
        },
      });
    },
  });
}

export function immediateShotBaseline(): BaselineDefinition {
  return deterministicBaseline(
    "IMMEDIATE_SHOT",
    "Shoots at every legal opportunity; otherwise approaches, holds, or uses the first valid action.",
    ({ actionMask }) => firstAvailable(actionMask, ["SHOT", "DRIBBLE", "HOLD_BALL"]),
  );
}

export function approachAndShootBaseline(options: ApproachAndShootOptions = {}): BaselineDefinition {
  const threshold = options.shootWithinDistance ?? 0.15;
  if (!(threshold > 0 && threshold <= 1)) throw new Error("shootWithinDistance must be in (0, 1]");
  return deterministicBaseline(
    "APPROACH_AND_SHOOT",
    `Approaches the goal and shoots within normalized distance ${threshold}.`,
    ({ observation, actionMask }) => {
      const distance = distanceToAttackingGoal(observation);
      return distance <= threshold
        ? firstAvailable(actionMask, ["SHOT", "DRIBBLE", "HOLD_BALL"])
        : firstAvailable(actionMask, ["DRIBBLE", "SHOT", "HOLD_BALL"]);
    },
  );
}

export function observableHeuristicBaseline(): BaselineDefinition {
  return deterministicBaseline(
    "OBSERVABLE_HEURISTIC",
    "Scores legal actions using actor-observable distance, pressure, possession, and certainty only.",
    context => {
      const distance = distanceToAttackingGoal(context.observation);
      const nearbyOpponents = context.observation.opponents
        .filter(opponent => opponent.present === 1 && opponent.distance < 0.08).length;
      const pressure = Math.min(1, nearbyOpponents / 3);
      const certainty = context.observation.ball.certainty;
      const scores: Partial<Record<PlayerActionId, number>> = {
        SHOT: 1.45 - distance * 3.2 - pressure * 0.25,
        DRIBBLE: 0.75 + distance * 0.55 - pressure * 0.6,
        PASS: 0.52 + pressure * 0.5,
        CROSS: 0.38 + (distance < 0.25 ? 0.35 : 0),
        HOLD_BALL: 0.12 + pressure * 0.25,
        SKILL_MOVE: 0.2 + pressure * 0.2,
        CLEAR: -0.1,
        NONE: -10,
      };
      const ranked = enabledEntries(context.actionMask)
        .map(entry => ({ entry, score: (scores[entry.id] ?? 0) + certainty * 0.01 }))
        .sort((left, right) => right.score - left.score || left.entry.index - right.entry.index);
      if (ranked.length === 0) throw new Error("Action mask contains no valid command");
      return commandFor(ranked[0].entry);
    },
  );
}

export function isCommandAllowed(command: PlayerActionCommand, mask: PlayerActionMask): boolean {
  if (command.actionId === undefined) return false;
  const entry = mask.entries.find(candidate => candidate.id === command.actionId);
  return Boolean(entry?.enabled && entry.validTargetIds.includes(command.targetId ?? null));
}

function deterministicBaseline(
  id: Exclude<BaselineId, "RANDOM_VALID">,
  description: string,
  select: (context: BaselineDecisionContext) => PlayerActionCommand,
): BaselineDefinition {
  return Object.freeze({ id, description, create: (_policySeed: number) => Object.freeze({ select }) });
}

function firstAvailable(mask: PlayerActionMask, priorities: readonly PlayerActionId[]): PlayerActionCommand {
  for (const id of priorities) {
    const entry = mask.entries.find(candidate => candidate.id === id && candidate.enabled);
    if (entry) return commandFor(entry);
  }
  const entry = enabledEntries(mask)[0];
  if (!entry) throw new Error("Action mask contains no valid command");
  return commandFor(entry);
}

function enabledEntries(mask: PlayerActionMask): PlayerActionMaskEntry[] {
  return mask.entries.filter(entry => entry.enabled && entry.validTargetIds.length > 0);
}

function validCommands(mask: PlayerActionMask): PlayerActionCommand[] {
  return enabledEntries(mask).flatMap(entry => [...entry.validTargetIds]
    .sort(compareTargets)
    .map(targetId => targetId === null
      ? Object.freeze({ actionId: entry.id })
      : Object.freeze({ actionId: entry.id, targetId })));
}

function commandFor(entry: PlayerActionMaskEntry): PlayerActionCommand {
  const targetId = [...entry.validTargetIds].sort(compareTargets)[0];
  if (targetId === undefined) throw new Error(`Enabled action ${entry.id} has no valid target variant`);
  return targetId === null ? Object.freeze({ actionId: entry.id }) : Object.freeze({ actionId: entry.id, targetId });
}

function compareTargets(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left.localeCompare(right);
}

function distanceToAttackingGoal(observation: ActorObservation): number {
  return observation.self.attackingDirection === 1
    ? 1 - observation.self.position[0]
    : observation.self.position[0];
}
