# Baselines e avaliação interna

A Fase 8 fornece uma avaliação pareada e reproduzível para o cenário atacante contra goleiro. Ela não depende de frontend, HTTP, WebSocket nem relógio real.

## Baselines v1

- `RANDOM_VALID`: sorteia uniformemente uma variante válida da máscara. Seu RNG é exclusivo da política.
- `IMMEDIATE_SHOT`: chuta sempre que a máscara permite; aproxima ou segura como fallback.
- `APPROACH_AND_SHOOT`: conduz até uma distância normalizada configurável e então chuta.
- `OBSERVABLE_HEURISTIC`: pontua ações usando apenas a observação do ator e a máscara. Não lê estado privilegiado nem internos da heurística da engine.

Todas as baselines retornam `PlayerActionCommand` e passam pela mesma validação de máscara usada pelo ambiente. IDs de ação continuam sendo os IDs estáveis do action space.

## Seeds e comparação pareada

`createEvaluationSeedSplit(rootSeed, developmentCount, evaluationCount)` cria duas partições determinísticas, únicas e sem interseção:

- `development`: para desenvolvimento e ajuste;
- `evaluation`: conjunto retido para avaliação final.

O avaliador recusa seeds duplicadas ou presentes nas duas partições. Dentro de uma partição, todas as baselines recebem exatamente as mesmas seeds de cenário. A seed aleatória de uma política é derivada por `BASELINE_POLICY:<partição>:<baseline>` e nunca é consumida pela engine.

```ts
const split = createEvaluationSeedSplit(2026, 100, 500);
const report = new InternalBaselineEvaluator({
  seedSplit: split,
  environmentFactory: seed => new AttackerVsGoalkeeperEnvironment({
    attackerId: "home-10",
    goalkeeperId: "away-1",
    initialSeed: seed,
    configFactory: buildConfig,
  }),
}).evaluate();
```

Não selecione configurações olhando a partição `evaluation`. Se ela passar a orientar ajustes, deve ser aposentada e substituída por novas seeds retidas.

## Relatório

Para cada baseline e partição, o relatório contém:

- registros brutos por episódio, incluindo seed de cenário e seed da política;
- contagem e taxa de cada resultado semântico;
- taxa de gol, chute no alvo e conclusão sem timeout;
- média de decisões e ticks físicos até o fim.
- retorno médio da Reward v1, com o mesmo intervalo de confiança das demais médias.

Taxas usam o intervalo de Wilson. Médias usam intervalo normal sobre o erro-padrão amostral. O nível padrão é 95% e pode ser configurado por `confidenceLevel`. Em amostras pequenas, preserve os registros brutos e interprete os intervalos como incerteza, não como aprovação automática de uma política.

## Invariantes

1. A mesma seed de cenário e política reproduz a mesma trajetória.
2. Uma baseline nunca pode executar ação mascarada.
3. Desenvolvimento e avaliação não podem compartilhar seeds.
4. Alterar o consumo aleatório da baseline não desloca RNGs da engine.
5. Comparações entre baselines são pareadas por seed, reduzindo ruído de cenário.
