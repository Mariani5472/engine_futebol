import { useEffect, useRef, useState } from "react";
import { Activity, Pause, Play, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { Pitch } from "./components/Pitch";
import { DebugPanel } from "./components/DebugPanel";
import type { PitchLayers } from "./components/Pitch";
import { DemoMatchFeed } from "./simulation/DemoMatchFeed";
import type { GoalReplay, MatchFeedEvent, MatchSnapshot } from "./simulation/types";
import { interpolatePoint } from "./simulation/types";
import { controlMatch, getGoalReplay, getOrCreateMatch, recoverMatch, setMatchSpeed, stepMatch, subscribeToMatch } from "./api/matchClient";
import { MatchStateAdapter, type CommunicationHealth, type DebugAlert, type DebugLevel, type RawNetworkSnapshot, type ReconciliationRow, type RetentionMode } from "./debug/observability";

export function App() {
  const initialSeed = Number(new URLSearchParams(window.location.search).get("seed") ?? 1) || 1;
  const initial = useRef(new DemoMatchFeed().reset());
  const previous = useRef<MatchSnapshot>(initial.current);
  const current = useRef<MatchSnapshot>(initial.current);
  const lastSnapshotAt = useRef(performance.now());
  const adapter=useRef(new MatchStateAdapter());
  const rendererFrozenRef=useRef(false);
  const lastRenderCaptureAt=useRef(0);
  const [frame, setFrame] = useState({ previous: initial.current, current: initial.current, alpha: 0 });
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8 | 50>(1);
  const [seed, setSeed] = useState(initialSeed);
  const [feed, setFeed] = useState<MatchFeedEvent[]>([]);
  const [goalReplay, setGoalReplay] = useState<GoalReplay | null>(null);
  const [replayFrameIndex, setReplayFrameIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [layers, setLayers] = useState<PitchLayers>({ influence:false, targets:false, passingLines:false, pressure:false, anchors:false, sectorLines:false, roles:false, logicalBall:false, enginePositions:false, velocityVectors:false, orientation:false });
  const [rawSnapshot,setRawSnapshot]=useState<RawNetworkSnapshot|null>(null);
  const [health,setHealth]=useState<CommunicationHealth>(adapter.current.health());
  const [alerts,setAlerts]=useState<readonly DebugAlert[]>([]);
  const [reconciliation,setReconciliation]=useState<readonly ReconciliationRow[]>([]);
  const [selectedPlayerId,setSelectedPlayerId]=useState<string|null>(null);
  const [rendererFrozen,setRendererFrozen]=useState(false);
  const [debugLevel,setDebugLevel]=useState<DebugLevel>("FULL");
  const [retention,setRetention]=useState<RetentionMode>("rollingBuffer");
  const [renderedState,setRenderedState]=useState<{players:Readonly<Record<string,{x:number;y:number}>>;ball:{x:number;y:number};capturedAt:number}>({players:{},ball:{x:50,y:50},capturedAt:0});

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let animationFrame = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async (existingId?: string) => {
      try {
        const { id } = existingId
          ? await recoverMatch(existingId, initialSeed)
          : await getOrCreateMatch(initialSeed);
        if (!active) return;
        setMatchId(id);
        socket = subscribeToMatch(id, {
          onSnapshot: (raw) => {
            let result;
            try { result=adapter.current.ingest(raw); }
            catch (error) { console.error("Snapshot rejected by adapter",error); return; }
            setRawSnapshot(raw);
            setHealth(result.health);
            setAlerts([...result.alerts]);
            setReconciliation(adapter.current.reconcile(raw));
            const snapshot=result.snapshot;
            if(!snapshot)return;
            previous.current = current.current;
            current.current = snapshot;
            lastSnapshotAt.current = performance.now();
            setRunning(snapshot.status !== "PAUSED");
            const normalizedEvents=result.newEvents.map(event=>({...event,...event.metadata,timestamp:event.simulationTimeMs}) as MatchFeedEvent);
            const visible = [...normalizedEvents,...(snapshot.diagnostics??[])].filter(event=>["SHOT","SHOT_STARTED","SHOT_ON_TARGET","SHOT_OFF_TARGET","SHOT_BLOCKED","WOODWORK","GOALKEEPER_SAVE","REBOUND","GOAL","FOUL","CORNER","THROW_IN","GOAL_KICK","POSSESSION_CHANGED","BALL_TELEPORT"].includes(event.type));
            if(visible.length)setFeed(previousFeed=>deduplicateFeed([...visible,...previousFeed]).slice(0,40));
          },
          onSpeedChanged: setSpeed,
        });
        socket.addEventListener("open", () => setConnected(true));
        socket.addEventListener("close", () => {
          setConnected(false);
          if (active) reconnectTimer = setTimeout(() => void connect(id), 750);
        });
      } catch {
        setConnected(false);
        if (active) reconnectTimer = setTimeout(() => void connect(existingId), 1000);
      }
    };
    void connect();

    const render = (timestamp: number) => {
      const alpha = Math.max(0, Math.min(1, (timestamp-lastSnapshotAt.current)/50));
      if(!rendererFrozenRef.current){
        setFrame({ previous:previous.current, current:current.current, alpha });
        if(timestamp-lastRenderCaptureAt.current>=200){
          lastRenderCaptureAt.current=timestamp;
          const positions=Object.fromEntries(current.current.players.map(player=>{const old=previous.current.players.find(candidate=>candidate.id===player.id)??player;return [player.id,interpolatePoint(old,player,alpha)];}));
          setRenderedState({players:positions,ball:interpolatePoint(previous.current.ball,current.current.ball,alpha),capturedAt:Date.now()});
        }
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => { active = false; if(reconnectTimer)clearTimeout(reconnectTimer); socket?.close(); cancelAnimationFrame(animationFrame); };
  }, []);

  useEffect(() => {
    if (!goalReplay || !replayPlaying) return;
    const timer = window.setInterval(() => {
      setReplayFrameIndex(index => {
        if (index >= goalReplay.frames.length - 1) {
          setReplayPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [goalReplay, replayPlaying]);

  const toggle = async () => {
    if (!matchId) return;
    await controlMatch(matchId, running ? "pause" : "resume");
    setRunning(!running);
  };

  const replay = () => { const url=new URL(window.location.href); url.searchParams.set("seed",String(Math.max(1,Math.floor(seed)))); window.location.href=url.toString(); };
  const changeSpeed = async (nextSpeed: 1 | 2 | 4 | 8 | 50) => {
    if (!matchId || !connected) return;
    await setMatchSpeed(matchId, nextSpeed);
  };
  const toggleLayer = (layer: keyof PitchLayers) => setLayers(value => ({ ...value, [layer]:!value[layer] }));
  const setRendererFreeze=(value:boolean)=>{rendererFrozenRef.current=value;setRendererFrozen(value);if(!value)setFrame({previous:previous.current,current:current.current,alpha:1});};
  const changeRetention=(value:RetentionMode)=>{adapter.current.setRetention(value);setRetention(value);};
  const advanceOneTick=async()=>{if(matchId)await stepMatch(matchId,1);};
  const openGoalReplay = async (goalEventId: string) => {
    if (!matchId) return;
    const loaded = await getGoalReplay(matchId, goalEventId);
    setGoalReplay(loaded);
    setReplayFrameIndex(0);
    setReplayPlaying(true);
  };
  const closeGoalReplay = () => { setGoalReplay(null); setReplayPlaying(false); setReplayFrameIndex(0); };
  const pitchFrame = goalReplay ? buildReplayPitchFrame(goalReplay, replayFrameIndex, frame.current) : frame;
  const minutes = Math.floor(frame.current.time/60).toString().padStart(2,"0");
  const seconds = Math.floor(frame.current.time%60).toString().padStart(2,"0");
  const tenths = Math.floor((frame.current.time%1)*10);
  const phaseLabels: Record<MatchSnapshot["phase"], string> = { READY:"Preparando saída", KICKOFF_PASS:"Passe inicial", RECEIVED:"Bola recebida", OPEN_PLAY:"Bola rolando", FIRST_HALF:"Primeiro tempo", SECOND_HALF:"Segundo tempo", FINISHED:"Encerrada" };
  const diagnostics=frame.current.tacticalDiagnostics?.home;
  const funnel=frame.current.offensiveFunnel;
  const latestDecision=[...(frame.current.decisionTrace??[])].reverse().find(entry=>entry.selected);

  return <main className="min-h-screen px-4 py-5 md:px-8 md:py-7">
    <header className="mx-auto mb-5 flex max-w-7xl items-center justify-between">
      <div><p className="eyebrow">Match Engine Lab</p><h1>Live match view</h1></div>
      <div className="status"><span className={connected ? "" : "offline"}/>{connected?<Wifi size={15}/>:<WifiOff size={15}/>} {connected?"API + WS ONLINE":"CONECTANDO"}</div>
    </header>
    <section className="scoreboard mx-auto mb-4 max-w-7xl">
      <div className="team"><i className="home-mark"/>Aurora FC</div>
      <div className="score"><strong>{frame.current.score?.homeGoals??0}</strong><span>{minutes}:{seconds}.{tenths}</span><strong>{frame.current.score?.awayGoals??0}</strong></div>
      <div className="team team-away">Racing Sul<i className="away-mark"/></div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[1fr_270px]">
      <Pitch {...pitchFrame} layers={layers} selectedId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}/>
      <aside className="panel"><p className="eyebrow">Controles</p><h2>Partida remota</h2>
        {goalReplay&&<div className="replay-controls"><div><b>Replay do gol</b><span>{(goalReplay.frames[replayFrameIndex]?.timestamp??0).toFixed(2)}s</span></div><button aria-label="Pausar ou reproduzir replay" onClick={()=>setReplayPlaying(value=>!value)}>{replayPlaying?<Pause size={14}/>:<Play size={14}/>}</button><button aria-label="Reiniciar replay" onClick={()=>{setReplayFrameIndex(0);setReplayPlaying(true)}}><RotateCcw size={14}/></button><button onClick={closeGoalReplay}>Voltar ao vivo</button></div>}
        <button className="primary" onClick={toggle} disabled={!connected}>{running?<Pause size={17}/>:<Play size={17}/>} {running?"Pausar":"Continuar"}</button>
        <div className="speed-controls" aria-label="Velocidade da partida">
          {([1,2,4,8,50] as const).map(value=><button key={value} className={speed===value?"speed-active":""} onClick={()=>changeSpeed(value)} disabled={!connected}>{value}x</button>)}
        </div>
        <div className="seed-control"><label>Seed</label><input type="number" min="1" step="1" value={seed} onChange={event=>setSeed(Number(event.target.value)||1)}/></div>
        <button className="secondary" onClick={replay}><RotateCcw size={16}/>Repetir pela seed</button>
        <div className="divider"/><p className="label">Servidor autoritativo</p>
        <div className="metric"><span>WebSocket</span><b>{connected?"conectado":"offline"}</b></div>
        <div className="metric"><span>Sequência</span><b>{frame.current.sequence??0}</b></div>
        <div className="metric"><span>Seed ativa</span><b>{frame.current.seed??initialSeed}</b></div>
        <div className="metric"><span>Velocidade</span><b>{speed}x</b></div>
        <div className="metric"><span>Estado</span><b>{phaseLabels[frame.current.phase]}</b></div>
        <div className="metric"><span>Aurora</span><b>{frame.current.homePhase??"—"}</b></div>
        <div className="metric"><span>Racing</span><b>{frame.current.awayPhase??"—"}</b></div>
        <div className="metric"><span>Posse provável</span><b>{frame.current.possessionPrediction?.likelyTeamId??"disputada"} · {((frame.current.possessionPrediction?.confidence??0)*100).toFixed(0)}%</b></div>
        <div className="metric"><span>Motivo</span><b>{frame.current.possessionPrediction?.transitionReason??"—"}</b></div>
        <div className="metric"><span>Interpolação</span><b>{frame.alpha.toFixed(2)}</b></div>
        <div className="divider"/><p className="label">Camadas de análise</p>
        <div className="layer-controls">
          {([['logicalBall','Bola lógica × visual'],['enginePositions','Posições da engine'],['velocityVectors','Vetores de velocidade'],['orientation','Orientação corporal'],['anchors','Âncoras táticas'],['targets','Alvos atuais'],['sectorLines','Linhas entre setores'],['passingLines','Portador e opções'],['roles','Funções ativas'],['influence','Área de influência'],['pressure','Pressão']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={()=>toggleLayer(key)}/><span>{label}</span></label>)}
        </div>
        {diagnostics&&<><div className="divider"/><p className="label">Diagnósticos — Aurora</p>
          <div className="metric"><span>Linhas D / M / A</span><b>{diagnostics.averageLineHeight.defence} / {diagnostics.averageLineHeight.midfield} / {diagnostics.averageLineHeight.attack}m</b></div>
          <div className="metric"><span>Bloco L × P</span><b>{diagnostics.blockWidth} × {diagnostics.blockDepth}m</b></div>
          <div className="metric"><span>Distâncias D–M / M–A</span><b>{diagnostics.defenceMidfieldDistance} / {diagnostics.midfieldAttackDistance}m</b></div>
          <div className="metric"><span>À frente da bola</span><b>{diagnostics.averagePlayersAheadOfBall}</b></div>
          <div className="metric"><span>Entradas 1/3 / área</span><b>{diagnostics.finalThirdEntries} / {diagnostics.penaltyAreaEntries}</b></div>
          <div className="metric"><span>Corridas progressivas</span><b>{diagnostics.progressiveRuns}</b></div>
          <div className="metric"><span>Transição média</span><b>{diagnostics.averageTransitionSeconds}s</b></div>
          <div className="metric"><span>PPDA</span><b>{diagnostics.ppda??'—'}</b></div>
          <div className="metric"><span>Pressão B / M / A</span><b>{diagnostics.pressureByZone.ownThird} / {diagnostics.pressureByZone.middleThird} / {diagnostics.pressureByZone.finalThird}</b></div>
          <div className="metric"><span>Circulação da bola</span><b>{diagnostics.ballCirculationSpeed} m/s</b></div>
          <div className="metric"><span>Funções mapeadas</span><b>{Object.keys(diagnostics.averagePositionByRole).length}</b></div>
        </>}
        {funnel&&<><div className="divider"/><p className="label">Funil ofensivo</p>
          <div className="funnel-head"><span>Etapa</span><b>AUR</b><b>RAC</b></div>
          {([['Posses','possessions'],['Progressões','progressions'],['Último terço','finalThirdEntries'],['Entradas na área','penaltyAreaEntries'],['Recepções na área','receptionsInArea'],['Finalizações','shots'],['No alvo','shotsOnTarget'],['Gols','goals'],['Estéreis','sterilePossessions']] as const).map(([label,key])=><div className="funnel-row" key={key}><span>{label}</span><b>{funnel.home[key]}</b><b>{funnel.away[key]}</b></div>)}
          <details className="funnel-details"><summary>Motivos de término/atrito</summary>{Object.keys(funnel.home.reasons).map(reason=><div className="funnel-row" key={reason}><span>{reasonLabel(reason)}</span><b>{funnel.home.reasons[reason]}</b><b>{funnel.away.reasons[reason]}</b></div>)}</details>
          <details className="funnel-details"><summary>Contextos de gol</summary>{Object.keys(funnel.home.goalContexts).map(context=><div className="funnel-row" key={context}><span>{contextLabel(context)}</span><b>{funnel.home.goalContexts[context]}</b><b>{funnel.away.goalContexts[context]}</b></div>)}</details>
        </>}
        {latestDecision&&<details className="funnel-details"><summary>Ãšltima decisÃ£o explicada</summary>
          <div className="metric"><span>Jogador / objetivo</span><b>{latestDecision.playerId} Â· {latestDecision.objective}</b></div>
          <div className="metric"><span>AÃ§Ã£o / utilidade</span><b>{String(latestDecision.decisionType)} Â· {latestDecision.utility.toFixed(1)}</b></div>
          <div className="metric"><span>Fase / intenÃ§Ã£o</span><b>{latestDecision.tacticalPhase??'â€”'} Â· {latestDecision.currentIntent?.type??'sem intenÃ§Ã£o persistente'}</b></div>
          {latestDecision.predictedOutcome&&<>
            <div className="metric"><span>Posse / perda prevista</span><b>{(latestDecision.predictedOutcome.possessionProbability*100).toFixed(0)}% / {(latestDecision.predictedOutcome.turnoverProbability*100).toFixed(0)}%</b></div>
            <div className="metric"><span>AmeaÃ§a / progressÃ£o</span><b>{latestDecision.predictedOutcome.expectedGoalThreat.toFixed(2)} xG Â· {latestDecision.predictedOutcome.territorialProgression.toFixed(1)}m</b></div>
          </>}
          {latestDecision.selectionReason&&<p className="hint">{latestDecision.selectionReason}</p>}
          {(frame.current.decisionTrace??[]).filter(entry=>!entry.selected).slice(-4).map((entry,index)=><div className="metric" key={`${entry.playerId}-${index}`}><span>Rejeitada {String(entry.decisionType)}</span><b>{entry.rejectionReasons.join(", ")}</b></div>)}
        </details>}
        <div className="divider"/><p className="label">Eventos e posse</p>
        <div className="event-feed">{feed.length?feed.map((event,index)=><div className={`feed-event feed-${event.type.toLowerCase()}`} key={eventKey(event,index)}><b>{formatEventTime(event)}</b><span>{describeEvent(event)}</span></div>):<p className="hint">Aguardando eventos da partida.</p>}</div>
        <div className="divider"/><p className="label">Timeline</p>
        <div className="match-timeline">{frame.current.timeline?.length?frame.current.timeline.slice(-20).reverse().map(entry=><button className="timeline-entry" key={entry.eventId} disabled={!entry.replayAvailable} onClick={()=>void openGoalReplay(entry.eventId)}><b>{entry.minute}'{entry.stoppageTime?`+${entry.stoppageTime}`:""}</b><span>{entry.label}</span>{entry.replayAvailable&&<i>replay</i>}</button>):<p className="hint">Aguardando eventos normalizados.</p>}</div>
        <p className="hint">A API produz snapshots a 20 Hz. O navegador somente interpola e desenha.</p>
      </aside>
    </section>
    <div className="mx-auto mt-4 max-w-7xl"><DebugPanel raw={rawSnapshot} snapshot={frame.current} renderedState={renderedState} health={health} alerts={alerts} reconciliation={reconciliation} adapter={adapter.current} selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId} rendererFrozen={rendererFrozen} onRendererFrozen={setRendererFreeze} debugLevel={debugLevel} onDebugLevel={setDebugLevel} retention={retention} onRetention={changeRetention} onStep={()=>void advanceOneTick()}/></div>
  </main>;
}

function stableEventKey(event:MatchFeedEvent){return event.id??`${event.type}|${event.matchSecond??event.timestamp??0}|${event.playerId??""}|${event.reason??""}`}
function eventKey(event:MatchFeedEvent,index:number){return `${stableEventKey(event)}|${index}`}
function deduplicateFeed(events:MatchFeedEvent[]){const seen=new Set<string>();return events.filter(event=>{const key=stableEventKey(event);if(seen.has(key))return false;seen.add(key);return true})}
function formatEventTime(event:MatchFeedEvent){const seconds=event.matchSecond??((event.timestamp??0)/1000);return `${Math.floor(seconds/60).toString().padStart(2,"0")}:${Math.floor(seconds%60).toString().padStart(2,"0")}`}
function describeEvent(event:MatchFeedEvent){
  if(event.type==="SHOT_STARTED")return `Chute iniciado — ${event.playerId??""}`;
  if(event.type==="SHOT_ON_TARGET")return "Finalização no alvo";
  if(event.type==="SHOT_OFF_TARGET")return "Finalização para fora";
  if(event.type==="SHOT_BLOCKED")return "Finalização bloqueada";
  if(event.type==="WOODWORK")return "Bola na trave";
  if(event.type==="GOALKEEPER_SAVE")return `Defesa — ${event.playerId??"goleiro"}`;
  if(event.type==="REBOUND")return "Rebote em jogo";
  if(event.type==="SHOT")return `Finalização ${event.result??""}`;
  if(event.type==="GOAL")return `GOL — ${event.teamId??""}`;
  if(event.type==="FOUL")return `Falta — ${event.playerId??""}`;
  if(event.type==="CORNER")return `Escanteio — ${event.teamId??""}`;
  if(event.type==="THROW_IN")return `Lateral — ${event.teamId??""}`;
  if(event.type==="GOAL_KICK")return `Tiro de meta — ${event.teamId??""}`;
  if(event.type==="BALL_TELEPORT")return `TELEPORTE ${event.distance?.toFixed(1)}m (${event.reason})`;
  return `Posse: ${event.playerId??""} · ${event.reason} · distância ${event.distanceToBall?.toFixed(1)}m · bola ${event.ballSpeed?.toFixed(1)}m/s · ação ${event.previousAction??"—"}`;
}
function reasonLabel(reason:string){return ({PASS_BLOCKED:'Passe bloqueado',PASS_NO_OPTION:'Passe sem opção',OFFSIDE:'Impedimento',SHOT_DECLINED:'Chute recusado',SHOT_BLOCKED:'Chute bloqueado',SHOT_SAVED:'Chute defendido',SHOT_OFF_TARGET:'Chute para fora',POSSESSION_RECYCLED:'Posse reciclada',BALL_LOST:'Bola perdida'} as Record<string,string>)[reason]??reason}
function contextLabel(context:string){return ({THROUGH_BALL:'Passe em profundidade',CROSS:'Cruzamento',REBOUND:'Rebote',TRANSITION:'Transição',POSITIONAL:'Ataque posicional'} as Record<string,string>)[context]??context}

function buildReplayPitchFrame(replay:GoalReplay,index:number,live:MatchSnapshot) {
  const currentFrame=replay.frames[Math.min(index,replay.frames.length-1)];
  const previousFrame=replay.frames[Math.max(0,Math.min(index-1,replay.frames.length-1))]??currentFrame;
  return { previous:replaySnapshot(previousFrame,live), current:replaySnapshot(currentFrame,live), alpha:1 };
}

function replaySnapshot(replayFrame:GoalReplay["frames"][number]|undefined,live:MatchSnapshot):MatchSnapshot {
  if(!replayFrame)return live;
  const sourceById=new Map(live.players.map(player=>[player.id,player]));
  return {
    ...live,
    time:replayFrame.timestamp,
    events:[],
    diagnostics:[],
    players:replayFrame.players.map(player=>{
      const source=sourceById.get(player.id);
      return {
        id:player.id,
        number:source?.number??Number(player.id.match(/(\d+)$/)?.[1]??0),
        team:player.teamId==="home"?"HOME":"AWAY",
        x:player.x/105*100,
        y:player.y/68*100,
        hasBall:false,
        role:source?.role,
        tacticalResponsibility:source?.tacticalResponsibility,
        targetPosition:{x:player.targetX/105*100,y:player.targetY/68*100},
        goalkeeperState:player.goalkeeperState??source?.goalkeeperState,
      };
    }),
    ball:{ x:replayFrame.ball.x/105*100, y:replayFrame.ball.y/68*100, height:replayFrame.ball.height },
    replayCamera:{centerX:replayFrame.camera.centerX/105*100,centerY:replayFrame.camera.centerY/68*100,zoom:replayFrame.camera.zoom},
  };
}
