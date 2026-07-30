# Observabilidade da partida

## Princípio autoritativo

A engine é a única fonte de verdade. O transporte publica coordenadas em metros, eventos causais e estatísticas derivadas desses eventos. O navegador não corrige placar, posse, ações ou estatísticas: `MatchStateAdapter` valida o contrato e apenas converte coordenadas para a escala visual.

Fluxo obrigatório:

```text
MatchEngine -> MatchSession -> NetworkMatchSnapshot -> MatchStateAdapter -> Pitch
                                      |                       |
                                dados brutos          saúde/reconciliação
```

## Relógios e ordenação

- `sequence` / `simulationTick`: update fixo autoritativo de 0,05 s.
- `simulationTimeMs` / `matchSecond`: relógio simulado, independente do tempo real.
- `StoredMatchEvent.sequence`: ordem causal global por partida.
- `lastEventSequence`: cursor do servidor usado para detectar lacunas.
- `generatedAt` e `serverSentAt`: relógio de parede usado somente para latência e jitter.

Eventos nunca devem ser reordenados pelo frontend. Snapshot antigo ou duplicado não substitui o estado visual aceito.

## Estatísticas

`MatchEventStore` normaliza eventos e produz o mesmo `EventDerivedMatchReport` durante e ao final da partida. O snapshot ao vivo não encerra a posse ativa. O relatório inclui posse, passes, progressão, finalizações, xG, reinícios, disciplina, ações defensivas, goleiros, zonas, períodos, jogadores e distância.

O xG atual é uma heurística calibrada por distância. Ele não é um modelo treinado e não deve ser apresentado como probabilidade científica. O inspetor de chutes mantém o evento bruto para auditar os fatores disponíveis.

## Níveis e retenção

- `OFF`: painel removido da tela.
- `BASIC`: resumo operacional.
- `STATISTICS`: relatórios e reconciliação.
- `SYNCHRONIZATION`: transporte, engine × adapter e alertas.
- `FULL`: todas as abas e estado bruto.

Modos locais: `rollingBuffer`, `importantEvents`, `sampled` e `fullDebug`. A exportação JSON inclui versão, snapshot atual, buffers, eventos, alertas e saúde. `fullDebug` é limitado e deve ser usado apenas em diagnóstico porque aumenta memória e tamanho do arquivo.

## Controles de desenvolvimento

Pausar a engine mantém o WebSocket conectado. Congelar o renderer não pausa engine nem recepção. `POST /matches/:id/step` avança 1–100 updates somente com a partida pausada e é desabilitado quando `NODE_ENV=production`.

## Alertas automáticos

O adapter detecta snapshots duplicados/fora de ordem, lacunas de update, lacunas de evento e divergência do cursor de eventos. A aba de reconciliação compara contagens oficiais com contagens reconstruídas do stream causal.

## Limitações conhecidas

- Aceleração ainda é publicada como zero porque a locomação não conserva a aceleração anterior no estado público.
- Estatísticas ao vivo são atualizadas a 1 Hz para não recalcular todo o relatório a 20 Hz.
- A posição “renderer” auditada é a saída do adapter; a interpolação entre dois snapshots é visual e não altera o estado oficial.
- A telemetria usa relógio do cliente e do servidor; latência absoluta pode incluir diferença entre relógios, enquanto jitter continua útil.
