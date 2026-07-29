import { Vector3 } from "../core/geometry/Vector3";
import { Vector2 } from "../core/geometry/Vector2";
import type { PreferredFoot } from "./player";

export type ShotType = "PLACED" | "POWER" | "CHIP" | "VOLLEY" | "HEADER";
export type ShotLifecycle = "PREPARING" | "IN_FLIGHT" | "DEFLECTED" | "RESOLVED";
export type ShotFinalOutcome =
  | "GOAL"
  | "SAVED_CAUGHT"
  | "SAVED_PARRIED"
  | "BLOCKED"
  | "OFF_TARGET"
  | "POST"
  | "CROSSBAR";

export interface GoalFrame {
  readonly goalLineX: number;
  readonly leftY: number;
  readonly rightY: number;
  readonly bottomZ: number;
  readonly topZ: number;
  readonly netDepth: number;
  readonly ballRadius: number;
}

export interface ShotExecution {
  readonly id: string;
  readonly shooterId: string;
  readonly teamId: string;
  readonly defendingTeamId: string;
  readonly goalkeeperId: string | null;
  readonly goalkeeperInitialPosition:Vector2|null;
  readonly origin: Vector3;
  readonly intendedTarget: Vector3;
  actualTarget: Vector3;
  readonly initialVelocity: Vector3;
  readonly speed: number;
  readonly shotType: ShotType;
  readonly footUsed: PreferredFoot;
  readonly expectedArrivalTime: number;
  readonly executionQuality: number;
  readonly pressureLevel: number;
  readonly bodyPosture: string;
  readonly balance: number;
  readonly contactQuality: number;
  readonly curve: number;
  readonly startedAt: number;
  readonly goalFrame: GoalFrame;
  lifecycle: ShotLifecycle;
  outcome: ShotFinalOutcome | null;
  deflectionCount: number;
  lastInteractionPlayerId: string | null;
  goalkeeperDecision:string|null;
  goalkeeperReactionTime:number|null;
}

export function createGoalFrame(
  goalLineX: number,
  centreY: number,
  width: number,
  height: number,
): GoalFrame {
  return {
    goalLineX,
    leftY: centreY - width / 2,
    rightY: centreY + width / 2,
    bottomZ: 0,
    topZ: height,
    netDepth: 2,
    ballRadius: .11,
  };
}
