import { useEffect, useRef, useState } from "react";
import { Activity, Pause, Play, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { Pitch } from "./components/Pitch";
import type { PitchLayers } from "./components/Pitch";
import { DemoMatchFeed } from "./simulation/DemoMatchFeed";
import type { MatchFeedEvent, MatchSnapshot } from "./simulation/types";
import { controlMatch, getOrCreateMatch, setMatchSpeed, subscribeToMatch } from "./api/matchClient";

export function App() {
  const initialSeed = Number(new URLSearchParams(window.location.search).get("seed") ?? 1) || 1;
  const initial = useRef(new DemoMatchFeed().reset());
  const previous = useRef<MatchSnapshot>(initial.current);
  const current = useRef<MatchSnapshot>(initial.current);
  const lastSnapshotAt = useRef(performance.now());
  const [frame, setFrame] = useState({ previous: initial.current, current: initial.current, alpha: 0 });
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(1);
  const [seed, setSeed] = useState(initialSeed);
  const [feed, setFeed] = useState<MatchFeedEvent[]>([]);
  const [layers, setLayers] = useState<PitchLayers>({ influence:false, targets:false, passingLines:false, pressure:false, anchors:false, sectorLines:false, roles:false, logicalBall:false });

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let animationFrame = 0;

    getOrCreateMatch(initialSeed).then(({ id }) => {
      if (!active) return;
      setMatchId(id);
      socket = subscribeToMatch(id, {
        onSnapshot: (snapshot) => {
          previous.current = current.current;
          current.current = snapshot;
          lastSnapshotAt.current = performance.now();
          setRunning(snapshot.status !== "PAUSED");
          const visible = [...(snapshot.events??[]),...(snapshot.diagnostics??[])].filter(event=>["SHOT","GOAL","FOUL","CORNER","POSSESSION_CHANGED","BALL_TELEPORT"].includes(event.type));
          if(visible.length)setFeed(previousFeed=>deduplicateFeed([...visible,...previousFeed]).slice(0,40));
        },
        onSpeedChanged: setSpeed,
      });
      socket.addEventListener("open", () => setConnected(true));
      socket.addEventListener("close", () => setConnected(false));
    }).catch(() => setConnected(false));

    const render = (timestamp: number) => {
      const alpha = Math.max(0, Math.min(1, (timestamp-lastSnapshotAt.current)/50));
      setFrame({ previous:previous.current, current:current.current, alpha });
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => { active = false; socket?.close(); cancelAnimationFrame(animationFrame); };
  }, []);

  const toggle = async () => {
    if (!matchId) return;
    await controlMatch(matchId, running ? "pause" : "resume");
    setRunning(!running);
  };

  const replay = () => { const url=new URL(window.location.href); url.searchParams.set("seed",String(Math.max(1,Math.floor(seed)))); window.location.href=url.toString(); };
  const changeSpeed = async (nextSpeed: 1 | 2 | 4 | 8) => {
    if (!matchId || !connected) return;
    await setMatchSpeed(matchId, nextSpeed);
  };
  const toggleLayer = (layer: keyof PitchLayers) => setLayers(value => ({ ...value, [layer]:!value[layer] }));
  const minutes = Math.floor(frame.current.time/60).toString().padStart(2,"0");
  const seconds = Math.floor(frame.current.time%60).toString().padStart(2,"0");
  const tenths = Math.floor((frame.current.time%1)*10);
  const phaseLabels: Record<MatchSnapshot["phase"], string> = { READY:"Preparando saída", KICKOFF_PASS:"Passe inicial", RECEIVED:"Bola recebida", OPEN_PLAY:"Bola rolando", FIRST_HALF:"Primeiro tempo", SECOND_HALF:"Segundo tempo", FINISHED:"Encerrada" };
  const diagnostics=frame.current.tacticalDiagnostics?.home;

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
      <Pitch {...frame} layers={layers}/>
      <aside className="panel"><p className="eyebrow">Controles</p><h2>Partida remota</h2>
        <button className="primary" onClick={toggle} disabled={!connected}>{running?<Pause size={17}/>:<Play size={17}/>} {running?"Pausar":"Continuar"}</button>
        <div className="speed-controls" aria-label="Velocidade da partida">
          {([1,2,4,8] as const).map(value=><button key={value} className={speed===value?"speed-active":""} onClick={()=>changeSpeed(value)} disabled={!connected}>{value}x</button>)}
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
        <div className="metric"><span>Interpolação</span><b>{frame.alpha.toFixed(2)}</b></div>
        <div className="divider"/><p className="label">Camadas de análise</p>
        <div className="layer-controls">
          {([['logicalBall','Bola lógica × visual'],['anchors','Âncoras táticas'],['targets','Alvos atuais'],['sectorLines','Linhas entre setores'],['passingLines','Portador e opções'],['roles','Funções ativas'],['influence','Área de influência'],['pressure','Pressão']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={()=>toggleLayer(key)}/><span>{label}</span></label>)}
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
        <div className="divider"/><p className="label">Eventos e posse</p>
        <div className="event-feed">{feed.length?feed.map((event,index)=><div className={`feed-event feed-${event.type.toLowerCase()}`} key={eventKey(event,index)}><b>{formatEventTime(event)}</b><span>{describeEvent(event)}</span></div>):<p className="hint">Aguardando eventos da partida.</p>}</div>
        <p className="hint">A API produz snapshots a 20 Hz. O navegador somente interpola e desenha.</p>
      </aside>
    </section>
  </main>;
}

function stableEventKey(event:MatchFeedEvent){return event.id??`${event.type}|${event.matchSecond??event.timestamp??0}|${event.playerId??""}|${event.reason??""}`}
function eventKey(event:MatchFeedEvent,index:number){return `${stableEventKey(event)}|${index}`}
function deduplicateFeed(events:MatchFeedEvent[]){const seen=new Set<string>();return events.filter(event=>{const key=stableEventKey(event);if(seen.has(key))return false;seen.add(key);return true})}
function formatEventTime(event:MatchFeedEvent){const seconds=event.matchSecond??((event.timestamp??0)/1000);return `${Math.floor(seconds/60).toString().padStart(2,"0")}:${Math.floor(seconds%60).toString().padStart(2,"0")}`}
function describeEvent(event:MatchFeedEvent){
  if(event.type==="SHOT")return `Finalização ${event.result??""}`;
  if(event.type==="GOAL")return `GOL — ${event.teamId??""}`;
  if(event.type==="FOUL")return `Falta — ${event.playerId??""}`;
  if(event.type==="CORNER")return `Escanteio — ${event.teamId??""}`;
  if(event.type==="BALL_TELEPORT")return `TELEPORTE ${event.distance?.toFixed(1)}m (${event.reason})`;
  return `Posse: ${event.playerId??""} · ${event.reason} · distância ${event.distanceToBall?.toFixed(1)}m · bola ${event.ballSpeed?.toFixed(1)}m/s · ação ${event.previousAction??"—"}`;
}
