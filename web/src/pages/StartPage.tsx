import { useNavigate } from "react-router-dom";

export function StartPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <section className="flex flex-col items-center gap-8 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Brasileirão Série A
          </p>

          <h1 className="mt-2 text-6xl font-bold tracking-tight">
            Football Manager
          </h1>

          <p className="mt-4 text-muted-foreground">
            Monte seu time, escolha sua tática e dispute a temporada de 2026.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/game")}
          className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Começar
        </button>
      </section>
    </main>
  );
}
