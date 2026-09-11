import type { Athlete } from "@/domain/team/teams";
import { getPositionOverall } from "@/domain/tactic/playerOverall";

type Props = {
  player: Athlete;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
};

export function TacticalPlayer({ player, x, y, selected, onSelect, onDragStart }: Props) {
  const role = y > 84 ? "GK" : y > 65 ? "D" : y > 42 ? "M" : "F";
  const overall = getPositionOverall(player, role);

  return (
    <button
      type="button"
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      title={`${player.name} • OVR ${overall}`}
      className="absolute z-10 flex w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full border-2 bg-background text-xs font-bold shadow-lg transition ${selected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
        {player.photoUrl ? (
          <img src={player.photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          player.shortName?.charAt(0) || player.name.charAt(0)
        )}
      </span>
      <span className="mt-1 max-w-full truncate rounded bg-background/95 px-1.5 text-[11px] font-semibold shadow-sm">
        {player.shortName || player.name}
      </span>
      <span className="text-[10px] font-bold text-muted-foreground">{overall}</span>
    </button>
  );
}
