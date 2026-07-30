# Curriculum e self-play v1

Esta fase expande o ambiente causal das fases anteriores; ela não cria uma física ou
uma simulação alternativa. Todos os cenários rodam por `MatchSession`, com timestep
fixo de `0.05s`, action mask autoritativa e observação de ator sem estado privilegiado.

## Ordem estável

1. `PASS`: um passador controlado e um receptor físico.
2. `TWO_V_ONE`: dois atacantes contra um defensor e goleiro congelado.
3. `THREE_V_TWO`: três atacantes contra dois defensores e goleiro congelado.
4. `FIVE_V_FIVE`: quatro jogadores de linha e um goleiro por equipe.
5. `LEARNED_GOALKEEPER`: goleiro controlado externamente contra checkpoint atacante.
6. `ELEVEN_V_ELEVEN`: uma equipe compartilhando a política contra heurística.
7. `COLLECTIVE_POLICY`: checkpoint atacante + goleiro como inicialização coletiva.
8. `SELF_PLAY`: 22 atores; cada equipe pode usar um checkpoint compartilhado distinto.

A ordem faz parte do contrato (`CURRICULUM_STAGE_ORDER`). IDs de agentes, versões do
action/observation space e hashes dos checkpoints também fazem parte do contrato.

## Portões de promoção

`evaluateCurriculumGate` exige, antes de promover:

- etapa anterior concluída;
- checkpoints obrigatórios e compatíveis;
- seeds de treino e avaliação disjuntas;
- amostra mínima;
- limite inferior de Wilson para sucesso;
- limite inferior do intervalo da recompensa média;
- gap máximo entre treino e avaliação.

Self-play exige ainda pelo menos dois adversários históricos. Uma média pontual alta
não promove uma etapa se a incerteza ainda for grande.

## Política coletiva

`MultiAgentMatchEnvironment` publica uma fronteira conjunta. Somente agentes que
precisam decidir aparecem em `activeAgentIds`; `step()` exige exatamente uma ação
válida para cada um. Compartilhamento de parâmetros acontece no treinador: todos os
IDs da mesma equipe consultam a mesma rede usando suas próprias observações e masks.
Isso mantém identidade, crédito por jogador e permite uma rede separada para goleiro.

## Self-play

`OpponentPool` aceita somente checkpoints coletivos imutáveis. O matchmaking é
determinístico pela seed e mistura adversário mais recente, rating próximo e histórico.
O learner nunca joga contra o próprio ID. Resultados atualizam apenas o rating do
registro; o arquivo do modelo e seu hash não mudam.

O wrapper Python `ParallelCurriculumEnv` usa o protocolo persistente:

```python
from football_env import ParallelCurriculumEnv

with ParallelCurriculumEnv("TWO_V_ONE", seed=1001) as env:
    observations, infos = env.reset(seed=1001)
    masks = env.action_masks()
    # A mesma rede pode escolher uma ação para cada agente ativo.
```

Para `SELF_PLAY`, encaminhe os jogadores `home-*` ao checkpoint learner e os
`away-*` ao checkpoint escolhido pelo pool. O ambiente não conhece o framework de
ML e, portanto, não permite que detalhes do PPO vazem para as regras do jogo.

## Critério operacional

Uma fase só está treinada quando há checkpoint real, avaliação held-out e portão
`COMPLETE`. A presença do cenário e do wrapper significa que a infraestrutura está
pronta; não afirma que um modelo já convergiu.
