import type { MatchSnapshot } from "../simulation/types";
import { interpolatePoint } from "../simulation/types";

interface PitchProps {
  readonly previous: MatchSnapshot;
  readonly current: MatchSnapshot;
  readonly alpha: number;
}

export function Pitch({ previous, current, alpha }: PitchProps) {
  const ball = interpolatePoint(previous.ball, current.ball, alpha);
  return (
    <div className="pitch-shell">
      <div className="pitch" aria-label="Campo de futebol 2D">
        <div className="halfway" /><div className="center-circle" /><div className="center-dot" />
        <div className="box box-left" /><div className="box box-right" />
        <div className="goal goal-left" /><div className="goal goal-right" />
        {current.players.map((player, index) => {
          const old = previous.players[index] ?? player;
          const point = interpolatePoint(old, player, alpha);
          return (
            <div
              className={`player ${player.team === "HOME" ? "player-home" : "player-away"}`}
              key={player.id}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            ><span>{player.number}</span></div>
          );
        })}
        <div className="ball" style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />
      </div>
    </div>
  );
}
