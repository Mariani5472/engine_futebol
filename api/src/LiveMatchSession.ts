import type { WebSocket } from "ws";
import { MatchSession, type MatchSnapshot } from "../../engine/src/application/match/engine/MatchSession.js";
import { createMatchConfig } from "./createMatchConfig.js";

const STEP_SECONDS = 0.05;

export interface NetworkMatchSnapshot extends MatchSnapshot {
  readonly type: "snapshot";
  readonly matchId: string;
  readonly status: "RUNNING" | "PAUSED" | "FINISHED";
  readonly speed: number;
  readonly pitch: { readonly length: number; readonly width: number };
}

export class LiveMatchSession {
  private readonly session: MatchSession;
  private readonly clients = new Set<WebSocket>();
  private readonly timer: NodeJS.Timeout;

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
  public current(): NetworkMatchSnapshot { const snapshot=this.session.snapshot(); return {...snapshot,type:"snapshot",matchId:this.id,status:this.session.isFinished()?"FINISHED":this.session.isPaused()?"PAUSED":"RUNNING",speed:this.session.getSpeed(),pitch:{length:105,width:68}}; }
  public dispose(): void { clearInterval(this.timer); this.clients.forEach(client=>client.close()); }
  private tick(): void {
    if(!this.session.isPaused()&&!this.session.isFinished()) for(let i=0;i<this.session.getSpeed()&&!this.session.isFinished();i++) this.session.update(STEP_SECONDS);
    this.broadcast(this.current());
  }

  private broadcast(message: NetworkMatchSnapshot | { type: "speed_changed"; speed: number }): void {
    const payload=JSON.stringify(message);
    this.clients.forEach(client=>{if(client.readyState===client.OPEN)client.send(payload);});
  }
}
