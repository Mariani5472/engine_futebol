# Ambiente puro `reset/step`

`PureMatchEnvironment` é a fronteira síncrona para treinamento e avaliação. Ele importa somente a engine, não possui timer, relógio real, frontend, WebSocket, HTTP ou dependência da API.

```ts
const environment = new PureMatchEnvironment({
  playerId: "home-10",
  configFactory: seed => buildConfig(seed),
  initialSeed: 42,
});

const initial = environment.reset();
const transition = environment.step({
  actionId: "PASS",
  targetId: "home-7",
});
```

## Decision gate

No `reset`, a simulação avança em ticks fixos de 0,05 s até o jogador alcançar uma janela de decisão. A política do ambiente então responde `waitForAction`: nenhuma ação automática é aplicada e o cooldown de decisão não começa.

`step(action)` libera o gate, valida a ação contra a mask e avança internamente todos os ticks físicos necessários até a próxima janela. Portanto uma decisão do agente normalmente representa dezenas de atualizações físicas, sem alterar o timestep oficial.

## Resultado

Cada step retorna:

- `observation` e `actionMask` da próxima fronteira;
- `reward: 0` no ambiente puro neutro; wrappers de cenário podem aplicar uma recompensa versionada (Reward v1 no atacante contra goleiro);
- `terminated`: a partida atingiu seu fim natural;
- `truncated`: um limite externo interrompeu o episódio;
- `info.physicalTicks`: ticks físicos executados nessa decisão;
- decisão aceita/rejeitada e motivo do encerramento.
- eventos causais emitidos durante todos os ticks internos em `info.events`.

Limites de truncamento disponíveis:

- `maxDecisionSteps`;
- `maxEpisodePhysicalTicks`;
- `maxPhysicalTicksPerStep`, proteção contra jogador sem nova janela.

O fim configurado da partida é sempre `terminated`, nunca `truncated`. Após qualquer um dos dois, `step()` falha até um novo `reset()`.

## Determinismo

`reset(seed)` reconstrói toda a `MatchSession`, streams de RNG, política e contadores. Dois ambientes com a mesma configuração, seed e ações produzem transições idênticas, independentemente da ordem em que forem chamados.
