import { useEffect, useRef, useState } from "react";
import { Activity, Pause, Play, RotateCcw } from "lucide-react";
import { BrowserAnimationScheduler, FixedTimestepLoop } from "@match-engine/runtime";
import { Pitch } from "./components/Pitch";
import { DemoMatchFeed } from "./simulation/DemoMatchFeed";
import type { MatchSnapshot } from "./simulation/types";

export function App() {
  const feed = useRef(new DemoMatchFeed());
  const initial = useRef(feed.current.reset());
  const previous = useRef<MatchSnapshot>(initial.current);
  const current = useRef<MatchSnapshot>(initial.current);
  const loop = useRef<FixedTimestepLoop | null>(null);
  const [frame, setFrame] = useState({ previous: initial.current, current: initial.current, alpha: 0 });
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const runtime = new FixedTimestepLoop({
      scheduler: new BrowserAnimationScheduler(),
      update: (delta) => {
        previous.current = current.current;
        current.current = feed.current.update(delta);
      },
      render: ({ alpha }) => setFrame({ previous: previous.current, current: current.current, alpha }),
    });
    loop.current = runtime;
    runtime.start();
    return () => runtime.stop();
  }, []);

  const toggle = () => {
    if (running) loop.current?.stop(); else loop.current?.start();
    setRunning(!running);
  };

  const reset = () => {
    const snapshot = feed.current.reset();
    previous.current = snapshot;
    current.current = snapshot;
    setFrame({ previous: snapshot, current: snapshot, alpha: 0 });
  };

  const minutes = Math.floor(frame.current.time / 60).toString().padStart(2, "0");
  const seconds = Math.floor(frame.current.time % 60).toString().padStart(2, "0");

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-7">
      <header className="mx-auto mb-5 flex max-w-7xl items-center justify-between">
        <div><p className="eyebrow">Match Engine Lab</p><h1>Live match view</h1></div>
        <div className="status"><span /><Activity size={15} />20 Hz SIM · 60 FPS UI</div>
      </header>
      <section className="scoreboard mx-auto mb-4 max-w-7xl">
        <div className="team"><i className="home-mark" />Aurora FC</div>
        <div className="score"><strong>0</strong><span>{minutes}:{seconds}</span><strong>0</strong></div>
        <div className="team team-away">Racing Sul<i className="away-mark" /></div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[1fr_270px]">
        <Pitch {...frame} />
        <aside className="panel">
          <p className="eyebrow">Controles</p><h2>Simulação</h2>
          <button className="primary" onClick={toggle}>{running ? <Pause size={17} /> : <Play size={17} />}{running ? "Pausar" : "Continuar"}</button>
          <button className="secondary" onClick={reset}><RotateCcw size={16} />Reiniciar</button>
          <div className="divider" />
          <p className="label">Relógios independentes</p>
          <div className="metric"><span>Engine</span><b>0.05s</b></div>
          <div className="metric"><span>Interpolação</span><b>{frame.alpha.toFixed(2)}</b></div>
          <p className="hint">A posição visual é interpolada entre os dois últimos snapshots da engine.</p>
        </aside>
      </section>
    </main>
  );
}
