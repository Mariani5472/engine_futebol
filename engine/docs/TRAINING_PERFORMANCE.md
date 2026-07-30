# Performance do ambiente de treinamento

A Fase 12 separa quatro decisões: custo da engine, custo do transporte, paralelismo e escala segura. O timestep esportivo permanece fixo em 0,05 segundo em todos os testes.

## Profiling TypeScript

```bash
cd engine
npm run profile:training -- --environments=1,2,4,8 --episodes=5 --warmups=1
```

O relatório mede tempo de reset e step, ticks físicos por segundo, decisões por segundo, episódios por segundo, heap, tamanho JSON e proporção gasta em serialização. Warmups não entram nas métricas.

O profiler recomenda `CONSIDER_BINARY` somente quando a serialização representa pelo menos 15% do tempo ou o payload médio passa de 64 KiB. A recomendação não troca o protocolo automaticamente.

## Wire format compacto

`CREATE` aceita `wireFormat: "FULL" | "COMPACT"`:

- `FULL`: observação estruturada, eventos e dados de auditoria. Usado pelas baselines explicáveis e debugging.
- `COMPACT`: vetor de 189 floats, máscara, reward, resultado e contadores essenciais. Usado pelo PPO.

Ambos representam a mesma transição e usam as mesmas versões. O compacto não altera observação, ação, reward, seed ou física; apenas deixa de transportar campos que o PPO não consome.

## Workers

O treino aceita:

```bash
python python/train_ppo.py --train-envs 4 --worker-mode subprocess
```

- `dummy`: ambientes intercalados em um processo Python.
- `subprocess`: um worker Python e um processo TypeScript persistente por ambiente.
- `auto`: `dummy` para um ambiente e `subprocess` para dois ou mais.

`SubprocVecEnv` usa `spawn`, inclusive para evitar herdar pipes e RNGs. Cada worker tem sua própria faixa determinística de seeds.

## Escala gradual

Dentro do container trainer:

```bash
python python/benchmark_workers.py --scales 1,2,4,8 --episodes-per-worker 5
```

Promova a escala somente enquanto episódios por segundo aumentarem de maneira material e memória/CPU permanecerem aceitáveis. O padrão inicial é 4 workers; 8 não deve virar padrão antes de ser medido na máquina de treino.

## Formato binário

O protocolo v1 continua JSON Lines. Formato binário está deliberadamente adiado porque:

1. o payload compacto remove as estruturas mais caras;
2. JSON preserva inspeção e diagnóstico;
3. introduzir binário antes do profiling criaria outro schema para manter.

Se o profiler recomendar binário de forma consistente, a próxima versão deve transportar apenas `Float32Array` da observação e bits da máscara, mantendo envelopes, eventos de erro e negociação em JSON.
