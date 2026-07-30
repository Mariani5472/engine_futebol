# Definições estatísticas autoritativas

## Autoridade e fluxo

A autoridade estatística da engine é:

```text
resultado físico ou aplicação de regra
→ MatchEvent com ID estável
→ MatchEventStore idempotente
→ EventDerivedMatchReport
→ MatchResult.analytics / projeção compatível MatchResult.metrics
```

Nenhum contador paralelo pode alterar uma estatística oficial. Diagnósticos táticos
amostram estado contínuo, mas não contam gols, passes, chutes, faltas ou cartões.

Um evento repetido com o mesmo ID e conteúdo é ignorado. O mesmo ID com conteúdo
diferente é uma violação. Eventos causados por ações carregam `actionId`; eventos de
período e relógio podem não possuir ação causadora.

## Definições por métrica

| Métrica | Evento/estado de origem | Momento da contagem | Sucesso, falha e exclusões |
|---|---|---|---|
| Posse | intervalos derivados do controle físico da bola | entre aquisição e mudança, disputa ou fim do período | bola sem controlador encerra o intervalo; voo de passe mantém a equipe do passador como origem do intervalo |
| Passe tentado | `PASS_ATTEMPTED` | quando o pé inicia uma trajetória de passe válida | reinício sem evento de passe não conta |
| Passe completo | `PASS_COMPLETED` | quando um companheiro obtém controle físico | o recebedor real pode diferir do pretendido; adversário controlando gera `PASS_INTERCEPTED` |
| Precisão de passe | completos / tentados | projeção do relatório | zero quando não há tentativa |
| Passe progressivo | `PASS_COMPLETED.forwardGain >= 8m` | na recepção controlada | usa progresso real, não a intenção inicial |
| Passe no último terço | `PASS_COMPLETED` ligado ao alvo do passe | na recepção | alvo deve atingir o último terço na direção ofensiva daquele período |
| Passe na área | `PASS_COMPLETED` ligado ao alvo do passe | na recepção | alvo deve estar na profundidade e largura regulamentar da área |
| Cruzamento | `PASS_ATTEMPTED.passKind=CROSS` | início da trajetória | conta tentativa, independentemente do resultado |
| Condução | `CARRY_STARTED` | início de uma condução física | troca meramente tática de alvo não conta |
| Finalização | `SHOT` | início de um chute espacial válido | chute recusado antes da execução não conta |
| No alvo | `SHOT_ON_TARGET` | trajetória alcança a abertura do gol ou é defendida nela | bloqueio anterior não conta |
| Para fora | `SHOT_OFF_TARGET` ou `WOODWORK` | resolução física | madeira permanece separável pelo evento, mas integra o agregado compatível de fora do alvo |
| Bloqueada | `SHOT_BLOCKED` | colisão com defensor no segmento percorrido | não inclui defesa do goleiro |
| Gol | `GOAL` | bola inteira cruza o plano dentro da baliza | anulação futura deverá emitir evento compensatório autoritativo antes de afetar o placar oficial |
| xG | distância da origem de `SHOT_STARTED` | projeção | faixas atuais: até 6m=.35; 12m=.18; 18m=.09; 25m=.04; 35m=.02; além=.01, multiplicadas por `xGScale` |
| Distância média do chute | origem de `SHOT_STARTED` ao centro do gol atacado | projeção | zero sem chutes |
| Defesa do goleiro | `GOALKEEPER_SAVE` | contato resolvido | `caught=true` é agarrada; `false` é rebatida |
| Rebote | `REBOUND` | bola permanece viva após intervenção | fonte distingue goleiro, defensor e madeira |
| Escanteio | `CORNER` | concessão do reinício | pertence à equipe atacante beneficiada |
| Lateral | `THROW_IN` | concessão do reinício | pertence à equipe beneficiada |
| Tiro de meta | `GOAL_KICK` | concessão do reinício | pertence à equipe beneficiada |
| Falta | `FOUL` | decisão concluída do árbitro | contato sem falta não conta |
| Amarelo/vermelho | `CARD` | cartão efetivamente emitido | segundo amarelo produz seu amarelo e o vermelho disciplinar correspondente |
| Tackle | `TACKLE` | duelo físico executado | tentativa tática sem contato não conta |
| Tackle ganho | `TACKLE.successful=true` | resolução do duelo | sucesso exige resultado físico do evento |
| Interceptação | `POSSESSION_CHANGED.reason=INTERCEPTION` | controle físico pelo adversário | proximidade sem domínio não conta |
| Recuperação | aquisição após `INTERCEPTION`, `TACKLE` ou disputa física contra adversário | aquisição | recepção normal entre companheiros não conta |
| Duelo | tackle ou `PHYSICAL_CLAIM` contestado contra adversário | resolução | aproximações repetidas sem mudança causal não contam |
| Perda de posse | intervalo encerrado por `TEAM_CHANGE` | mudança de equipe controladora | troca entre companheiros não conta |
| Recuperação alta | `POSSESSION_CHANGED` no último terço ofensivo da equipe recuperadora | aquisição | posição é interpretada conforme lado e período |
| Distância percorrida | diferença entre amostras consecutivas de posição | a cada tick amostrado | agregada por jogador e equipe |

## Métricas derivadas e compatibilidade

- `MatchResult.analytics` é o relatório rico oficial.
- `MatchResult.metrics` é uma projeção compatível do mesmo relatório.
- `fieldTiltPercent` compatível usa a proporção de ações autoritativas no último terço.
- `ppda` compatível usa passes tentados do adversário divididos por tackles e interceptações.
- `clearances` permanece `0` até existir um evento autoritativo `CLEARANCE`; não será mantido um contador paralelo.
- Estatísticas por período usam o período gravado no evento, nunca inferência posterior pelo relógio.

## Invariantes

1. `gols da equipe = quantidade de GOAL da equipe = placar final da equipe`.
2. `passes completos <= passes tentados` para o mesmo conjunto de eventos.
3. Todo `SHOT_RESOLVED.shotId` referencia exatamente um evento `SHOT`.
4. Todo evento derivado de ação possui um `actionId` existente e estável.
5. IDs de eventos são únicos no escopo da partida.
6. Reprocessar eventos não altera sequências nem estatísticas.
7. Ler snapshot ou relatório não avança tempo, RNG, ação ou física.
8. Alterar nível de instrumentação não pode alterar o resultado esportivo.

## Mudança de definição

Qualquer mudança no evento de origem, critério de sucesso, exclusão ou fórmula exige:

1. atualização deste documento;
2. teste de invariantes;
3. nova calibração multi-seed;
4. incremento futuro da versão do contrato estatístico.
