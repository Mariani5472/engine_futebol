# Cenário atacante contra goleiro

`AttackerVsGoalkeeperEnvironment` especializa o ambiente puro `reset/step` sem criar uma física alternativa. Finalização, trajetória, trave, gol e contato do goleiro continuam sendo resolvidos por `ShotAction`, `BallPhysicsSystem` e pelos eventos causais normais.

```ts
const environment = new AttackerVsGoalkeeperEnvironment({
  attackerId: "home-10",
  goalkeeperId: "away-1",
  initialSeed: 42,
  configFactory: seed => buildConfig(seed),
  scenario: {
    attackerDistanceFromGoal: 18,
    attackerLateralOffset: 2,
    goalkeeperDepthFromGoalLine: 1,
    goalkeeperLateralOffset: 0,
  },
});

const initial = environment.reset();
const result = environment.step({ actionId: "SHOT" });
```

## Configuração

- posição exata ou distância do atacante para o gol;
- deslocamento lateral do atacante;
- posição exata ou profundidade do goleiro;
- deslocamento lateral do goleiro;
- isolamento dos outros 20 jogadores;
- congelamento do goleiro, habilitado por padrão;
- seed, limites de decisões e ticks do ambiente puro.

O atacante começa com domínio físico da bola e voltado para o gol adversário. Outros jogadores isolados permanecem nas bordas, sem decisões ou movimento, para não acrescentarem pressão e bloqueios artificiais.

## Goleiro congelado

Congelamento significa posição e velocidade invariantes. O goleiro não fecha ângulo, não avança e não mergulha. Ele ainda ocupa volume físico e pode agarrar ou rebater uma bola que passe dentro do seu alcance estático. Mesmo uma defesa agarrada não transporta o goleiro até o ponto de contato.

O wrapper verifica a coordenada após cada `step()` e falha imediatamente se o goleiro congelado tiver se deslocado.

## Resultados semânticos

O episódio termina com um dos resultados:

- `GOAL`;
- `SAVED_CAUGHT`;
- `SAVED_PARRIED`;
- `BLOCKED`;
- `OFF_TARGET`;
- `POST`;
- `CROSSBAR`;
- `POSSESSION_LOST`;
- `TIMEOUT`.

Os sete resultados de chute vêm de `SHOT_RESOLVED.finalOutcome`. `POSSESSION_LOST` exige perda física sem chute iniciado. `TIMEOUT` representa término/truncamento sem desfecho ofensivo.

## Reprodução

O cenário completo integra `SimulationConfig` e, portanto, entra no hash do manifesto. `reset(seed)` recria estado, posições, action space, observation space e streams de RNG. Mesma configuração, seed e sequência de ações produzem observações, eventos e resultado idênticos.
