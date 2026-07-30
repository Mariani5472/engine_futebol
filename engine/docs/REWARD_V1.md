# Reward v1

A primeira recompensa é específica para o cenário atacante contra goleiro. Ela é simples, explicável, determinística e reconstruível a partir de cada transição. Não usa xG, utilidades internas, estado privilegiado, distância prevista ou qualquer estimativa de valor futuro.

## Componentes

Cada chamada a `step()` publica `reward` e `rewardBreakdown`:

```ts
{
  reward: 0.99,
  rewardBreakdown: {
    version: 1,
    outcome: "GOAL",
    components: [
      { id: "DECISION_COST", value: -0.01, source: "DECISION_BOUNDARY" },
      { id: "SEMANTIC_OUTCOME", value: 1, source: "AUTHORITATIVE_OUTCOME" }
    ],
    total: 0.99
  }
}
```

Valores padrão:

| Resultado | Valor |
|---|---:|
| Gol | 1.00 |
| Defesa com rebote | 0.20 |
| Defesa agarrada | 0.15 |
| Trave ou travessão | 0.05 |
| Bloqueado | -0.10 |
| Para fora | -0.20 |
| Perda de posse | -0.35 |
| Timeout | -0.50 |
| Cada decisão | -0.01 |

O bônus pequeno para uma defesa reconhece que o chute foi ao alvo, mas permanece muito abaixo do gol. O custo por decisão desencoraja espera infinita sem depender da quantidade de ticks físicos usada para chegar à próxima decisão.

## Reconstrução e auditoria

`reconstructReward(components)` soma exclusivamente os componentes publicados. `verifyRewardBreakdown()` verifica versão, finitude e igualdade do total. Assim, um dataset pode auditar a recompensa sem executar novamente a heurística ou consultar xG.

O resultado semântico vem do `SHOT_RESOLVED` autoritativo, da perda física de posse ou do motivo de truncamento do ambiente. Eventos intermediários duplicados, como `SHOT_ON_TARGET` junto de `SHOT_RESOLVED`, não são recompensados duas vezes.

## Escopo

O `PureMatchEnvironment` continua neutro (`reward = 0`) porque não conhece o objetivo esportivo do cenário. `AttackerVsGoalkeeperEnvironment` aplica a Reward v1 e substitui esse valor com o detalhamento versionado. Futuras tarefas defensivas ou coletivas devem declarar funções próprias, sem alterar retroativamente a versão 1.

O avaliador interno acumula o retorno do episódio e publica sua média e intervalo de confiança para cada baseline e partição de seeds.
