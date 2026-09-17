import type { Formation } from "@/context/GameState";

const formations: Formation[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"];

type Props = {
  value: Formation;
  onChange: (formation: Formation) => void;
};

export function FormationSelector({ value, onChange }: Props) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formação</p>
        <h2 className="mt-1 text-xl font-bold">{value}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {formations.map((formation) => (
          <button
            key={formation}
            type="button"
            onClick={() => onChange(formation)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              value === formation
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {formation}
          </button>
        ))}
      </div>
    </section>
  );
}
