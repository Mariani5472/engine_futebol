import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Athlete } from "@/domain/team/teams";
import type { TacticalPosition } from "@/context/GameState";
import { TacticalPlayer } from "./TacticalPlayer";

type Props = { 
  positions: TacticalPosition[]; 
  playersById: Map<string, Athlete>; 
  selectedPlayerId: string | null; 
  onSelect: (playerId: string) => void; 
  onMove: (playerId: string, x: number, y: number) => void 
};

export function TacticalPitch({ positions, playersById, selectedPlayerId, onSelect, onMove }: Props) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    
    if (!draggingPlayerId || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((event.clientY - rect.top) / rect.height) * 100));
    onMove(draggingPlayerId, x, y);
    setDraggingPlayerId(null);
  }

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div 
        ref={pitchRef} 
        onDragOver={(event) => event.preventDefault()} 
        onDrop={handleDrop} 
        className="relative mx-auto aspect-[3/4] w-full max-w-[620px] overflow-hidden rounded-lg border-2 border-white/70 bg-emerald-700 shadow-inner"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[length:10%_10%]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
          <div className="absolute inset-x-[25%] top-0 h-[16%] border-x border-b border-white/70" />
          <div className="absolute inset-x-[25%] bottom-0 h-[16%] border-x border-t border-white/70" />
          <div className="absolute inset-x-[40%] top-0 h-[7%] border-x border-b border-white/70" />
          <div className="absolute inset-x-[40%] bottom-0 h-[7%] border-x border-t border-white/70" />
            {positions.map((position) => { 
              const player = playersById.get(position.playerId); 
              if (!player) return null; 
              return (
                <TacticalPlayer 
                  key={position.playerId} 
                  player={player} 
                  x={position.x} 
                  y={position.y} 
                  selected={selectedPlayerId === position.playerId} 
                  onSelect={() => onSelect(position.playerId)} 
                  onDragStart={() => setDraggingPlayerId(position.playerId)} 
                />
              ); 
            })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Arraste os jogadores para qualquer ponto do campo.</p>
    </div>
  );  
}
