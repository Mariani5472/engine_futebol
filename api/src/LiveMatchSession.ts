import type { WebSocket } from "ws";
import { MatchSession, type MatchSnapshot } from "../../engine/src/application/match/engine/MatchSession.js";
import type { GoalReplay } from "../../engine/src/application/match/replay/GoalReplayRecorder.js";
import { createMatchConfig } from "./createMatchConfig.js";

const STEP_SECONDS = 0.05;

export interface NetworkMatchSnapshot extends MatchSnapshot {
  readonly type: "snapshot";
  readonly matchId: string;
  readonly status: "RUNNING" | "PAUSED" | "FINISHED";
  readonly speed: number;
  readonly pitch: { readonly length: number; readonly width: number };
  readonly generatedAt: number;
  readonly serverSentAt: number;
  readonly transport: {
    readonly fixedStepSeconds: 0.05;
    readonly snapshotsPerSecond: 20;
    readonly updatesExecuted: number;
    readonly lastUpdateDurationMs: number;
  };
}

export class LiveMatchSession {
  private readonly session: MatchSession;
  private readonly clients = new Set<WebSocket>();
  private readonly timer: NodeJS.Timeout;
  private updatesExecuted = 0;
  private lastUpdateDurationMs = 0;

  constructor(public readonly id: string, public readonly seed = 1) {
    this.session = MatchSession.create(createMatchConfig(id, seed));
    this.timer = setInterval(() => this.tick(), STEP_SECONDS * 1000);
  }
  public addClient(socket: WebSocket): void { this.clients.add(socket); socket.send(JSON.stringify(this.current())); socket.on("close",()=>this.clients.delete(socket)); }
  public pause(): NetworkMatchSnapshot { this.session.pause(); return this.current(); }
  public resume(): NetworkMatchSnapshot { this.session.resume(); return this.current(); }
  public setSpeed(speed: number): NetworkMatchSnapshot {
    this.session.setSpeed(speed);
    this.broadcast({ type: "speed_changed", speed });
    return this.current();
  }
  public step(count = 1): NetworkMatchSnapshot {
    if (process.env.NODE_ENV === "production") throw new Error("Manual stepping is disabled in production");
    if (!this.session.isPaused()) throw new Error("Pause the match before stepping");
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Step count must be between 1 and 100");
    const startedAt = performance.now();
    this.session.resume();
    for (let index = 0; index < count && !this.session.isFinished(); index++) {
      this.session.advance(STEP_SECONDS);
      this.updatesExecuted++;
    }
    this.session.pause();
    this.lastUpdateDurationMs = performance.now() - startedAt;
    const snapshot = this.current();
    this.broadcast(snapshot);
    return snapshot;
  }
  public current(): NetworkMatchSnapshot {
    const snapshot=this.session.snapshot();
    const generatedAt=Date.now();
    return {...snapshot,type:"snapshot",matchId:this.id,status:this.session.isFinished()?"FINISHED":this.session.isPaused()?"PAUSED":"RUNNING",speed:this.session.getSpeed(),pitch:{length:105,width:68},generatedAt,serverSentAt:Date.now(),transport:{fixedStepSeconds:STEP_SECONDS,snapshotsPerSecond:20,updatesExecuted:this.updatesExecuted,lastUpdateDurationMs:this.lastUpdateDurationMs}};
  }
  public dispose(): void { clearInterval(this.timer); this.clients.forEach(client=>client.close()); }
  public goalReplay(goalEventId: string): GoalReplay | null { return this.session.goalReplay(goalEventId); }
  public archive(){return this.session.archive();}
  private tick(): void {
    const startedAt=performance.now();
    if(!this.session.isPaused()&&!this.session.isFinished()) for(let i=0;i<this.session.getSpeed()&&!this.session.isFinished();i++) { this.session.advance(STEP_SECONDS); this.updatesExecuted++; }
    this.lastUpdateDurationMs=performance.now()-startedAt;
    this.broadcast(this.current());
  }

  private broadcast(message: NetworkMatchSnapshot | { type: "speed_changed"; speed: number }): void {
    const payload=JSON.stringify(message);
    this.clients.forEach(client=>{if(client.readyState===client.OPEN)client.send(payload);});
  }
}
