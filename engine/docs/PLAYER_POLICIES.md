# Fronteira de políticas de jogador

A simulação usa `PlayerPolicy` como fronteira entre observação, escolha e execução. A política não cria ações nem ignora as regras: ela escolhe entre decisões canônicas produzidas pelos evaluators e filtradas pelo `DecisionFilter`. A `ActionFactory` continua sendo a autoridade que inicia a ação.

## Políticas disponíveis

- `HeuristicPlayerPolicy`: adapter da heurística atual e padrão de todos os jogadores.
- `ScriptedPlayerPolicy`: consome uma sequência de comandos; comandos inválidos recaem na heurística.
- `RandomValidPlayerPolicy`: escolhe somente entre ações válidas usando um RNG injetado e determinístico.
- `ExternalPlayerPolicy`: aceita comandos externos para um jogador; ausência ou comando inválido produz uma ação segura, nunca uma ação ilegal.

Cada escolha gera um `PolicyDecisionRecord` com jogador, instante, política, pedido, decisão aplicada, aceitação e motivo. Esse transcript permite reproduzir e auditar agentes externos.

## Controle incremental

```ts
const session = MatchSession.create(config);
session.controlPlayer("home-10");
session.submitPlayerAction("home-10", {
  actionId: "PASS",
  targetId: "home-7",
});
session.update(0.05);
```

O controle é individual. Os demais jogadores continuam no adapter heurístico. `releasePlayerControl(id)` devolve o jogador à heurística. Também estão disponíveis `useScriptedPolicy`, `useRandomValidPolicy` e `setPlayerPolicy`.

O backend publica a mesma fronteira por HTTP:

- `POST /matches/:id/players/:playerId/control`
- `POST /matches/:id/players/:playerId/actions` com `{ "actionId": "PASS", "targetId": "home-7" }`
- `DELETE /matches/:id/players/:playerId/control`
- `GET /matches/:id/policy-decisions`

O endpoint de ação responde `202` porque o comando foi enfileirado. A aceitação esportiva só é conhecida na próxima janela de decisão e aparece em `policyDecisions` no snapshot e no transcript.

O timestep oficial permanece fixo em 0,05 s. Políticas são consultadas apenas quando o jogador está apto a tomar uma nova decisão; enviar um comando não força execução imediata nem ultrapassa cooldown, posse, alvo, distância ou contexto tático.
