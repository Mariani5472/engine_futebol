import type { MatchState } from "../../../core/movement/MatchState";
import type { MatchEvent } from "../../../domain";

export interface ReplayFrame {
  readonly timestamp: number;
  readonly ball: { readonly x: number; readonly y: number; readonly height: number; readonly velocityX:number; readonly velocityY:number; readonly motionKind:string|null };
  readonly players: readonly {
    readonly id: string; readonly teamId: string; readonly x: number; readonly y: number;
    readonly velocityX:number; readonly velocityY:number; readonly facingX: number; readonly facingY: number;
    readonly bodyState:string; readonly goalkeeperState:string|null; readonly targetX:number; readonly targetY:number;
    readonly action: string | null;
  }[];
  readonly events: readonly string[];
  readonly camera:{readonly centerX:number;readonly centerY:number;readonly zoom:number};
}

export interface GoalReplay {
  readonly goalEventId: string;
  readonly speed: 1;
  readonly frames: readonly ReplayFrame[];
}

interface ActiveCapture { goalEventId: string; until: number; frames: ReplayFrame[] }

/** Records frames; replay never reruns player intelligence. */
export class GoalReplayRecorder {
  private readonly preRoll: ReplayFrame[] = [];
  private readonly active: ActiveCapture[] = [];
  private readonly completed: GoalReplay[] = [];

  public constructor(private readonly preSeconds = 5, private readonly postSeconds = 3, private readonly tick = .05) {}

  public sample(state: MatchState, events: readonly MatchEvent[]): void {
    const frame = this.frame(state, events);
    this.preRoll.push(frame);
    const maxPreFrames = Math.ceil(this.preSeconds / this.tick);
    if (this.preRoll.length > maxPreFrames) this.preRoll.shift();

    for (const goal of events.filter(event => event.type === "GOAL")) {
      this.active.push({ goalEventId: goal.id, until: state.currentSecond + this.postSeconds, frames: [...this.preRoll] });
    }
    for (let index = this.active.length - 1; index >= 0; index--) {
      const capture = this.active[index];
      if (capture.frames[capture.frames.length - 1] !== frame) capture.frames.push(frame);
      if (state.currentSecond + 1e-9 < capture.until) continue;
      this.completed.push({ goalEventId: capture.goalEventId, speed: 1, frames: capture.frames });
      this.active.splice(index, 1);
    }
  }

  public replays(): readonly GoalReplay[] {
    return [
      ...this.completed,
      ...this.active.map(capture => ({ goalEventId: capture.goalEventId, speed: 1 as const, frames: [...capture.frames] })),
    ];
  }

  private frame(state: MatchState, events: readonly MatchEvent[]): ReplayFrame {
    return {
      timestamp: state.currentSecond,
      ball: { x: state.ball.position.x, y: state.ball.position.y, height: state.ball.height,
        velocityX:state.ball.velocity.x,velocityY:state.ball.velocity.y,motionKind:state.ball.motion?.kind??null },
      players: [
        ...state.home.players.map(player => ({
          id: player.player.id, teamId: state.home.team.id, x: player.position.x, y: player.position.y,
          velocityX:player.velocity.x,velocityY:player.velocity.y,facingX: player.facingDirection.x, facingY: player.facingDirection.y,
          bodyState:player.bodyState,goalkeeperState:player.goalkeeperState,targetX:player.targetPosition.x,targetY:player.targetPosition.y,
          action: player.activeAction ? String(player.activeAction.type) : null,
        })),
        ...state.away.players.map(player => ({
          id: player.player.id, teamId: state.away.team.id, x: player.position.x, y: player.position.y,
          velocityX:player.velocity.x,velocityY:player.velocity.y,facingX: player.facingDirection.x, facingY: player.facingDirection.y,
          bodyState:player.bodyState,goalkeeperState:player.goalkeeperState,targetX:player.targetPosition.x,targetY:player.targetPosition.y,
          action: player.activeAction ? String(player.activeAction.type) : null,
        })),
      ],
      events: events.map(event => event.id),
      camera:{centerX:state.ball.position.x,centerY:state.ball.position.y,zoom:1.35},
    };
  }
}
