import type { MatchFeedEvent, MatchSnapshot, PlayerSnapshot, Point } from "../simulation/types";

export type DebugLevel = "OFF" | "BASIC" | "STATISTICS" | "SYNCHRONIZATION" | "FULL";
export type RetentionMode = "rollingBuffer" | "importantEvents" | "sampled" | "fullDebug";

export interface RawStoredEvent extends MatchFeedEvent {
  readonly sequence:number;
  readonly simulationTick:number;
  readonly simulationTimeMs:number;
  readonly matchMinute:number;
  readonly metadata?:Readonly<Record<string,unknown>>;
}

export interface RawNetworkSnapshot {
  readonly type:"snapshot";
  readonly seed:number;
  readonly matchId:string;
  readonly sequence:number;
  readonly simulationTick:number;
  readonly simulationTimeMs:number;
  readonly matchMinute:number;
  readonly stoppageTimeSeconds:number;
  readonly lastEventSequence:number;
  readonly matchSecond:number;
  readonly generatedAt:number;
  readonly serverSentAt:number;
  readonly speed:1|2|4|8|50;
  readonly status:"RUNNING"|"PAUSED"|"FINISHED";
  readonly phase:string;
  readonly score:{readonly homeGoals:number;readonly awayGoals:number};
  readonly possessionTeamId:string|null;
  readonly pitch:{readonly length:number;readonly width:number};
  readonly players:readonly RawPlayerSnapshot[];
  readonly ball:RawBallSnapshot;
  readonly sequencedEvents:readonly RawStoredEvent[];
  readonly analytics?:RawAnalytics|null;
  readonly transport?:{readonly fixedStepSeconds:number;readonly snapshotsPerSecond:number;readonly updatesExecuted:number;readonly lastUpdateDurationMs:number};
  readonly [key:string]:unknown;
}

export interface RawPlayerSnapshot {
  readonly id:string; readonly teamId:string;
  readonly position:Point; readonly velocity:Point; readonly acceleration?:Point;
  readonly facingDirection:Point; readonly bodyOrientation?:number;
  readonly role:string; readonly action:string|null; readonly hasBall:boolean; readonly bodyState:string;
  readonly targetPosition:Point; readonly tacticalAnchorPosition:Point; readonly runCorridorOrigin?:Point;
  readonly acceptedTargetChanges?:number; readonly tacticalResponsibility?:string|null; readonly occupiedChannel?:string|null;
  readonly goalkeeperState?:string|null; readonly goalkeeperInterceptionTarget?:Point|null; readonly goalkeeperInterceptionHeight?:number|null;
  readonly animationState?:string; readonly stamina?:number; readonly fatigue?:number; readonly condition?:number;
  readonly currentIntent?:string|null; readonly actionTargetId?:string|null; readonly lastDecisionAt?:number|null;
}

export interface RawBallSnapshot {
  readonly position:Point; readonly logicalPosition:Point; readonly velocity:Point;
  readonly height:number; readonly state:string; readonly ownerId:string|null;
  readonly motion?:{readonly kind:string;readonly hasExplicitEffect:boolean}|null;
  readonly activeShot?:Record<string,unknown>|null;
}

export interface RawTeamReport { readonly [metric:string]:unknown }
export interface RawAnalytics { readonly teams:Readonly<Record<string,RawTeamReport>>; readonly players:Readonly<Record<string,Readonly<Record<string,unknown>>>>; readonly possessionIntervals?:readonly unknown[] }

export interface CommunicationHealth {
  readonly connection:"HEALTHY"|"DEGRADED"|"ERROR";
  readonly received:number; readonly accepted:number; readonly duplicates:number;
  readonly outOfOrder:number; readonly missingSnapshots:number; readonly missingEvents:number;
  readonly lastSequence:number; readonly lastEventSequence:number;
  readonly latencyMs:number; readonly jitterMs:number; readonly snapshotsPerSecond:number;
}

export interface DebugAlert {
  readonly id:string; readonly severity:"INFO"|"WARNING"|"ERROR";
  readonly code:string; readonly message:string; readonly sequence:number; readonly createdAt:number;
}

export interface ReconciliationRow { readonly metric:string; readonly teamId:string; readonly official:number; readonly derived:number; readonly delta:number; readonly ok:boolean }
export interface ActionLifecycleRecord { readonly playerId:string; readonly action:string; readonly simulationTick:number; readonly engineAt:number; readonly sentAt:number; readonly receivedAt:number; readonly queuedAt:number; readonly animation:string; }

const IMPORTANT = new Set(["GOAL","SHOT","SHOT_ON_TARGET","SHOT_OFF_TARGET","SHOT_BLOCKED","WOODWORK","GOALKEEPER_SAVE","FOUL","CARD","CORNER","THROW_IN","GOAL_KICK","OFFSIDE","POSSESSION_CHANGED","BALL_TELEPORT"]);

/** The only boundary allowed to translate authoritative metres into renderer percentages. */
export class MatchStateAdapter {
  private lastSequence=0;
  private lastEventSequence=0;
  private lastSimulationTick=0;
  private lastSimulationTimeMs=0;
  private received=0;
  private accepted=0;
  private duplicates=0;
  private outOfOrder=0;
  private missingSnapshots=0;
  private missingEvents=0;
  private latency=0;
  private jitter=0;
  private lastArrival=0;
  private arrivals:number[]=[];
  private rawSnapshots:RawNetworkSnapshot[]=[];
  private events:RawStoredEvent[]=[];
  private derivedCounts=new Map<string,number>();
  private alerts:DebugAlert[]=[];
  private actionLifecycles=new Map<string,ActionLifecycleRecord>();

  public constructor(private retention:RetentionMode="rollingBuffer") {}

  public setRetention(mode:RetentionMode):void { this.retention=mode; this.trim(); }

  public ingest(raw:RawNetworkSnapshot,receivedAt=Date.now()):{snapshot:MatchSnapshot|null;newEvents:readonly RawStoredEvent[];health:CommunicationHealth;alerts:readonly DebugAlert[]} {
    this.validate(raw);
    this.received++;
    const previousArrival=this.lastArrival;
    if(raw.sequence===this.lastSequence){this.duplicates++;return {snapshot:null,newEvents:[],health:this.health(),alerts:this.alerts};}
    if(raw.sequence<this.lastSequence){this.outOfOrder++;this.addAlert("WARNING","SNAPSHOT_OUT_OF_ORDER",`Snapshot ${raw.sequence} chegou após ${this.lastSequence}`,raw.sequence);return {snapshot:null,newEvents:[],health:this.health(),alerts:this.alerts};}
    if(raw.simulationTick<this.lastSimulationTick)this.addAlert("ERROR","TICK_REGRESSION",`Tick regrediu de ${this.lastSimulationTick} para ${raw.simulationTick}`,raw.sequence);
    if(raw.simulationTimeMs<this.lastSimulationTimeMs)this.addAlert("ERROR","CLOCK_REGRESSION",`Relógio regrediu de ${this.lastSimulationTimeMs} para ${raw.simulationTimeMs} ms`,raw.sequence);
    if(this.lastSequence&&raw.simulationTick-this.lastSimulationTick!==raw.sequence-this.lastSequence)this.addAlert("WARNING","SEQUENCE_TICK_DIVERGENCE",`Delta de sequência ${raw.sequence-this.lastSequence}, delta de tick ${raw.simulationTick-this.lastSimulationTick}`,raw.sequence);
    if(this.lastSequence&&raw.sequence>this.lastSequence+Math.max(1,raw.speed)){
      const missing=raw.sequence-this.lastSequence-Math.max(1,raw.speed);
      this.missingSnapshots+=missing;
      this.addAlert("WARNING","SNAPSHOT_GAP",`${missing} updates não foram observados entre snapshots`,raw.sequence);
    }
    const wireEvents=raw.sequencedEvents??[];
    const freshEvents=wireEvents.filter(event=>event.sequence>this.lastEventSequence);
    for(const event of freshEvents){
      if(this.lastEventSequence&&event.sequence!==this.lastEventSequence+1){
        this.missingEvents+=Math.max(0,event.sequence-this.lastEventSequence-1);
        this.addAlert("ERROR","EVENT_GAP",`Evento esperado ${this.lastEventSequence+1}, recebido ${event.sequence}`,raw.sequence);
      }
      this.lastEventSequence=Math.max(this.lastEventSequence,event.sequence);
    }
    if(raw.lastEventSequence!==undefined&&raw.lastEventSequence!==this.lastEventSequence)this.addAlert("WARNING","EVENT_CURSOR_MISMATCH",`Servidor informa evento ${raw.lastEventSequence}; cliente tem ${this.lastEventSequence}`,raw.sequence);
    const nextLatency=Math.max(0,receivedAt-(raw.serverSentAt??receivedAt));
    if(nextLatency>250)this.addAlert("WARNING","HIGH_LATENCY",`Latência observada de ${Math.round(nextLatency)} ms`,raw.sequence);
    for(const event of freshEvents)if(event.type==="BALL_TELEPORT")this.addAlert("ERROR","BALL_TELEPORT",`Detector de teleporte acionado no evento ${event.sequence}`,raw.sequence);
    for(const player of raw.players){
      if(player.position.x<0||player.position.x>raw.pitch.length||player.position.y<0||player.position.y>raw.pitch.width)this.addAlert("WARNING","PLAYER_OUT_OF_BOUNDS",`${player.id} fora do campo em ${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}`,raw.sequence);
      if(player.action){const key=`${player.id}|${player.action}`;if(!this.actionLifecycles.has(key))this.actionLifecycles.set(key,{playerId:player.id,action:player.action,simulationTick:raw.simulationTick,engineAt:raw.generatedAt,sentAt:raw.serverSentAt,receivedAt,queuedAt:receivedAt,animation:player.animationState??"UNKNOWN"});}
    }
    this.jitter=this.accepted?this.jitter*.8+Math.abs(nextLatency-this.latency)*.2:0;
    this.latency=this.accepted?this.latency*.8+nextLatency*.2:nextLatency;
    this.lastArrival=receivedAt;
    if(previousArrival)this.arrivals.push(receivedAt-previousArrival);
    this.arrivals=this.arrivals.slice(-100);
    this.lastSequence=raw.sequence;
    this.lastSimulationTick=raw.simulationTick;
    this.lastSimulationTimeMs=raw.simulationTimeMs;
    this.accepted++;
    this.events.push(...freshEvents);
    for(const event of freshEvents){const key=`${event.teamId??"none"}|${event.type}`;this.derivedCounts.set(key,(this.derivedCounts.get(key)??0)+1);}
    this.rawSnapshots.push(raw);
    this.trim();
    return {snapshot:mapSnapshot(raw),newEvents:freshEvents,health:this.health(),alerts:this.alerts};
  }

  public health():CommunicationHealth {
    const avg=this.arrivals.length?this.arrivals.reduce((sum,value)=>sum+value,0)/this.arrivals.length:0;
    const bad=this.outOfOrder+this.missingEvents;
    return {connection:bad?"ERROR":this.missingSnapshots||this.latency>250?"DEGRADED":"HEALTHY",received:this.received,accepted:this.accepted,duplicates:this.duplicates,outOfOrder:this.outOfOrder,missingSnapshots:this.missingSnapshots,missingEvents:this.missingEvents,lastSequence:this.lastSequence,lastEventSequence:this.lastEventSequence,latencyMs:round(this.latency),jitterMs:round(this.jitter),snapshotsPerSecond:avg?round(1000/avg):0};
  }

  public retainedEvents():readonly RawStoredEvent[]{return this.events;}
  public retainedSnapshots():readonly RawNetworkSnapshot[]{return this.rawSnapshots;}
  public currentAlerts():readonly DebugAlert[]{return this.alerts;}
  public actionLifecycle():readonly ActionLifecycleRecord[]{return [...this.actionLifecycles.values()].slice(-200);}
  public reconcile(raw:RawNetworkSnapshot):readonly ReconciliationRow[]{
    if(!raw.analytics)return [];
    const mapping={goals:"GOAL",shots:"SHOT",shotsOnTarget:"SHOT_ON_TARGET",passesAttempted:"PASS_ATTEMPTED",passesCompleted:"PASS_COMPLETED",fouls:"FOUL",corners:"CORNER"} as const;
    return Object.entries(raw.analytics.teams).flatMap(([teamId,report])=>Object.entries(mapping).map(([metric,type])=>{
      const official=Number(report[metric]??0); const derived=this.derivedCounts.get(`${teamId}|${type}`)??0;
      return {metric,teamId,official,derived,delta:official-derived,ok:official===derived};
    }));
  }

  public export(raw:RawNetworkSnapshot|null):string{return JSON.stringify({version:1,exportedAt:new Date().toISOString(),retention:this.retention,health:this.health(),alerts:this.alerts,actionLifecycle:this.actionLifecycle(),currentSnapshot:raw,snapshots:this.rawSnapshots,events:this.events},null,2);}

  private validate(raw:RawNetworkSnapshot):void {
    if(!raw||raw.type!=="snapshot"||!Number.isFinite(raw.sequence)||!Array.isArray(raw.players)||!raw.pitch)throw new Error("Invalid authoritative match snapshot");
  }
  private addAlert(severity:DebugAlert["severity"],code:string,message:string,sequence:number):void {
    const id=`${code}-${sequence}`; if(this.alerts.some(alert=>alert.id===id))return;
    this.alerts=[{id,severity,code,message,sequence,createdAt:Date.now()},...this.alerts].slice(0,100);
  }
  private trim():void {
    const snapshotLimit=this.retention==="fullDebug"?5000:this.retention==="sampled"?120:this.retention==="importantEvents"?20:600;
    if(this.retention==="sampled")this.rawSnapshots=this.rawSnapshots.filter((_,index,array)=>index===array.length-1||index%20===0);
    this.rawSnapshots=this.rawSnapshots.slice(-snapshotLimit);
    if(this.retention==="importantEvents")this.events=this.events.filter(event=>IMPORTANT.has(event.type));
    this.events=this.events.slice(-(this.retention==="fullDebug"?20000:2000));
  }
}

export function mapSnapshot(wire:RawNetworkSnapshot):MatchSnapshot {
  const point=(value:Point):Point=>({x:value.x/wire.pitch.length*100,y:value.y/wire.pitch.width*100});
  const players:PlayerSnapshot[]=wire.players.map(player=>({id:player.id,number:Number(player.id.match(/(\d+)$/)?.[1]??0),team:player.teamId==="home"?"HOME":"AWAY",x:point(player.position).x,y:point(player.position).y,enginePosition:player.position,velocity:player.velocity,acceleration:player.acceleration,bodyOrientation:player.bodyOrientation,facingDirection:player.facingDirection,hasBall:player.hasBall,targetPosition:point(player.targetPosition),tacticalAnchorPosition:point(player.tacticalAnchorPosition),runCorridorOrigin:player.runCorridorOrigin?point(player.runCorridorOrigin):undefined,acceptedTargetChanges:player.acceptedTargetChanges,role:player.role,action:player.action,bodyState:player.bodyState,tacticalResponsibility:player.tacticalResponsibility,occupiedChannel:player.occupiedChannel,goalkeeperState:player.goalkeeperState,goalkeeperInterceptionTarget:player.goalkeeperInterceptionTarget?point(player.goalkeeperInterceptionTarget):null,goalkeeperInterceptionHeight:player.goalkeeperInterceptionHeight,animationState:player.animationState,stamina:player.stamina,fatigue:player.fatigue,condition:player.condition,currentIntent:player.currentIntent,actionTargetId:player.actionTargetId,lastDecisionAt:player.lastDecisionAt}));
  const anyWire=wire as Record<string,unknown>;
  return {type:"snapshot",seed:wire.seed,matchId:wire.matchId,sequence:wire.sequence,simulationTick:wire.simulationTick,simulationTimeMs:wire.simulationTimeMs,lastEventSequence:wire.lastEventSequence,generatedAt:wire.generatedAt,serverSentAt:wire.serverSentAt,time:wire.matchSecond,status:wire.status==="FINISHED"?"PAUSED":wire.status,phase:wire.phase as MatchSnapshot["phase"],score:wire.score,possessionTeamId:wire.possessionTeamId,events:wire.sequencedEvents??[],analytics:wire.analytics,players,ball:{...point(wire.ball.position),enginePosition:wire.ball.position,velocity:wire.ball.velocity,height:wire.ball.height,state:wire.ball.state,ownerId:wire.ball.ownerId,motionKind:wire.ball.motion?.kind??null,hasExplicitEffect:wire.ball.motion?.hasExplicitEffect??false,logicalPosition:point(wire.ball.logicalPosition),activeShot:wire.ball.activeShot as MatchSnapshot["ball"]["activeShot"]},homePhase:anyWire.homePhase as string|undefined,awayPhase:anyWire.awayPhase as string|undefined,homePossessionState:anyWire.homePossessionState as string|undefined,awayPossessionState:anyWire.awayPossessionState as string|undefined,possessionPrediction:anyWire.possessionPrediction as MatchSnapshot["possessionPrediction"],diagnostics:anyWire.diagnostics as MatchSnapshot["diagnostics"],timeline:anyWire.timeline as MatchSnapshot["timeline"],replayGoalIds:anyWire.replayGoalIds as readonly string[]|undefined,tacticalDiagnostics:anyWire.tacticalDiagnostics as MatchSnapshot["tacticalDiagnostics"],offensiveFunnel:anyWire.offensiveFunnel as MatchSnapshot["offensiveFunnel"],tacticalDebug:mapTacticalDebug(anyWire.tacticalDebug,wire.pitch),decisionTrace:anyWire.decisionTrace as MatchSnapshot["decisionTrace"]};
}

function mapTacticalDebug(value:unknown,pitch:{length:number;width:number}):MatchSnapshot["tacticalDebug"]{
  const source=value as {carrierId:string|null;passOptionIds:readonly string[];homeSectors:Record<string,Point|null>;awaySectors:Record<string,Point|null>}|undefined;
  if(!source)return undefined;
  const sectors=(input:Record<string,Point|null>)=>Object.fromEntries(Object.entries(input).map(([key,point])=>[key,point?{x:point.x/pitch.length*100,y:point.y/pitch.width*100}:null]));
  return {carrierId:source.carrierId,passOptionIds:source.passOptionIds,homeSectors:sectors(source.homeSectors) as never,awaySectors:sectors(source.awaySectors) as never};
}
const round=(value:number)=>Math.round(value*10)/10;
