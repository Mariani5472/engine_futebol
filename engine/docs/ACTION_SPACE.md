# Action space e action mask

O espaço de ações do jogador é discreto, versionado e independente da ordem acidental de declarações no código. A versão atual é `PLAYER_ACTION_SPACE_VERSION = 1`, publicada pelo manifesto como `versions.actionSpace = 2` porque substitui o contrato anterior baseado diretamente no enum.

Existem 24 índices fixos, de `NONE = 0` até `TACTICAL_FOUL = 23`. Todos os valores de `DecisionType` são explícitos e adicionar uma ação não pode renumerar as existentes.

## Estrutura da mask

Cada `PlayerActionMask` contém:

- `bits`: vetor fixo de 24 posições, com `1` para ação permitida e `0` para bloqueada;
- `entries`: ID estável, índice, `DecisionType` e alvos válidos de cada ação;
- `playerId`, `matchSecond` e versão do contrato.

A ação é hierárquica: o primeiro valor discreto escolhe o tipo e `targetId` escolhe um alvo dentro de `validTargetIds`. Ações sem alvo usam `null` nessa lista. Isso mantém o vetor fixo mesmo quando elencos e IDs de jogadores mudam.

## Invariante mask → execução

A mask e a execução recebem a mesma coleção de `Decision` canônicas, produzida pelos evaluators, pela prontidão da ação e pelo `DecisionFilter`.

`PlayerActionSpace.resolve()` somente devolve a própria decisão canônica quando tipo e alvo aparecem nessa coleção. O `PlayerPolicyController` usa exclusivamente esse resolvedor para aceitar comandos scripted, aleatórios ou externos. Portanto:

- bit desligado nunca é aceito;
- alvo ausente da entrada nunca é aceito;
- bit ligado e alvo listado resolvem para a mesma decisão entregue ao `ActionFactory`;
- uma mask antiga não autoriza uma ação: a validação usa novamente o contexto da janela atual.

O snapshot publica `actionMasks` para jogadores com política vinculada. `MatchSession.actionMask(playerId)` devolve a mask mais recente daquele jogador.

O backend também publica:

- `GET /action-space`: catálogo fixo e versão;
- `GET /matches/:id/players/:playerId/action-mask`: mask mais recente;
- campo `actionMasks` nos snapshots WebSocket.

Uma mask ainda não calculada responde `409`; isso acontece entre a ativação do controle e a primeira janela de decisão do jogador.
