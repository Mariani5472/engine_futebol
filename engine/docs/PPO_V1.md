# Primeiro PPO — atacante contra goleiro congelado

O experimento v1 treina somente o atacante no cenário discreto criado nas fases anteriores. O goleiro está congelado pela própria configuração autoritativa da engine; os outros jogadores estão isolados e não tomam decisões.

## Algoritmo e espaços

- Algoritmo: `MaskablePPO` 2.9.0.
- Observação: vetor ator v1, `Box(-1, 1, 189)`.
- Ação: action space v1, `Discrete(24)`.
- Ações inválidas: removidas pela máscara da engine durante treino e inferência.
- Reward: Reward v1, sem xG.
- Timestep físico: sempre 0,05 segundo.

O PPO usa MLP `[128, 128]`, `learning_rate=3e-4`, `n_steps=256`, `batch_size=64`, `gamma=0.99`, `gae_lambda=0.95` e `ent_coef=0.01`. Esses valores fazem parte do manifesto `run.json` e devem ser tratados como configuração inicial, não como hiperparâmetros já otimizados.

## Cenários

Treino:

- 14 m, centro;
- 18 m, 4 m à esquerda;
- 18 m, 4 m à direita;
- 22 m, centro.

Generalização, nunca usada para atualizar o modelo:

- 10 m, deslocamento lateral de ±8 m;
- 26 m, centro;
- 24 m, deslocamento lateral de ±7 m.

Seeds de avaliação começam um milhão acima da primeira seed de treino. O script verifica que os conjuntos não se cruzam.

## Executar

Com Docker:

```bash
docker compose --profile training build trainer
docker compose run --rm trainer python python/train_ppo.py \
  --timesteps 100000 \
  --train-envs 4 \
  --worker-mode subprocess \
  --eval-seeds 20 \
  --seed 2026 \
  --output artifacts/ppo-v1
```

Reavaliar um modelo com mais seeds:

```bash
docker compose run --rm trainer python python/evaluate_ppo.py \
  artifacts/ppo-v1/model.zip \
  --seeds 100
```

## Comparação

Cada política usa exatamente as mesmas seeds e cenários:

- aleatória válida;
- chute imediato;
- aproximação e chute;
- heurística observável;
- PPO v1 determinístico.

`evaluation.json` contém episódios brutos, taxas de gol e chute no alvo, retorno, decisões, intervalos de confiança de 95%, deltas do PPO contra cada baseline e o gap entre distribuição de treino e generalização.

Não se considera o PPO aprovado apenas porque o retorno de treino aumentou. O primeiro critério é superar a baseline aleatória no conjunto retido; depois, comparar com chute imediato e heurística. Um intervalo amplo exige mais seeds. O conjunto de generalização não deve ser usado para escolher checkpoints ou ajustar reward.

## Artefatos

- `model.zip`: pesos do PPO.
- `run.json`: seeds, cenários, algoritmo e parâmetros essenciais.
- `evaluation.json`: resultados agregados e episódios auditáveis.

O repositório contém o pipeline e não inclui pesos pré-treinados. Um modelo só deve ser chamado de “treinado” depois que `train_ppo.py` terminar e produzir esses três artefatos.

As versões 2.9.0 de Stable-Baselines3 e sb3-contrib permanecem fixadas juntas. O `MaskablePPO` detecta diretamente o método `action_masks()` do ambiente; a avaliação determinística também passa a máscara explicitamente a `predict()`.
