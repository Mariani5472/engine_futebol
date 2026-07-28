# Timestep oficial

O timestep oficial do Match Engine e **0.05 segundo (20 Hz)**.

- `MatchEngine` usa 0.05s quando `tickDeltaSeconds` nao e informado.
- `CalibrationRunner` e `npm run calibrate` usam o mesmo valor por padrao.
- A simulacao deve avancar com fixed-step de 0.05s para manter determinismo e
  preservar as metricas calibradas.
- A interface 2D pode renderizar em outra frequencia. Nesse caso, ela deve
  interpolar os estados da simulacao em vez de alterar o timestep da engine.

Ticks maiores continuam permitidos para testes rapidos, por exemplo:

```bash
npm run calibrate -- --matches 10 --tick 2
```

Resultados produzidos com ticks maiores sao aproximacoes de desenvolvimento e
nao substituem a regressao nem a calibracao oficial em 0.05s.

## Renderizacao independente

`FixedTimestepLoop` separa o relogio da engine do relogio visual. Em um monitor
de 60 Hz, `render` e chamado aproximadamente 60 vezes por segundo, enquanto
`update` recebe sempre exatamente 0.05s e roda 20 vezes por segundo.

```ts
const loop = new FixedTimestepLoop({
  scheduler: new BrowserAnimationScheduler(),
  update: (fixedDelta) => simulation.update(fixedDelta),
  render: ({ alpha }) => field.renderInterpolated(alpha),
});

loop.start();
```

O renderer deve guardar os estados visual anterior e atual e usar `alpha` para
interpolar posicoes. Pausas longas sao limitadas para evitar uma espiral de
atualizacoes que congele a interface.

## Validacao

O teste `tests/integration/Tick005Smoke.test.ts` executa as seeds fixas 1, 7 e
19 no timestep oficial. Ele usa uma janela curta para detectar rapidamente
regressoes estruturais e explosoes de eventos. A calibracao estatistica final
deve continuar sendo executada com partidas completas e uma amostra maior:

```bash
npm run calibrate -- --matches 20 --tick 0.05
```
