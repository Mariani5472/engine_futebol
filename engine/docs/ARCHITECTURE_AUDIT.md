# Auditoria arquitetural da engine

Data da auditoria: 31/07/2026.

## Escopo e regra de segurança

Esta auditoria cobre apenas a engine TypeScript em `engine/src` e seus testes. API,
frontend, Python e o roadmap de aprendizado não fazem parte da refatoração proposta.
Nenhuma física, regra, probabilidade ou resultado esportivo foi alterado nesta etapa.

Levantamento objetivo:

- 217 arquivos TypeScript de produção: 179 em `application`, 26 em `core` e 11 em `domain`;
- 76 arquivos de teste: 69 unitários, 5 de integração, 1 de determinismo e auxiliares;
- 993 métodos/funções; 109 têm 40 linhas ou mais e 18 têm 80 linhas ou mais;
- 3 componentes fortemente conexos, isto é, ciclos reais no grafo de imports;
- 156 atribuições diretas a campos centrais de estado feitas pela camada `application`;
- 49 arquivos importam o barrel amplo `domain/index.ts`;
- 175 linhas de produção excedem 140 caracteres;
- `strict` está ativo, mas `noUnusedLocals` e `noUnusedParameters` estão desativados;
- não há lint, formatter ou verificador de fronteiras arquiteturais configurado.

## 1. Estrutura atual

```text
src/
├── domain/                 entidades de configuração, eventos e tipos básicos
├── core/
│   ├── geometry/           vetores, interseções e trajetórias
│   ├── movement/           estado mutável e sistemas de movimento/posse
│   ├── pitch/              grade e zonas
│   └── random/             RNG e streams determinísticos
├── application/match/
│   ├── engine/             composição, loop, sessão, reinícios e manifesto
│   ├── action/             ciclo de execução e ações concretas
│   ├── decision/           avaliadores e seleção
│   ├── tactical/           fase coletiva, papéis e inteligência tática
│   ├── physics/            movimento e resolução causal da bola
│   ├── perception/         percepção espacial
│   ├── awareness/          memória e predição percebida
│   ├── analytics|metrics/  eventos, relatórios e métricas coexistentes
│   ├── diagnostics/        funis e detectores
│   └── demais módulos      referee, goalkeeper, replay, runtime etc.
└── index.ts                API pública ampla
```

A organização por capacidade já é melhor que uma estrutura totalmente horizontal,
mas `core` não é uma camada inferior de fato: ele importa `application`, e a maior
parte da simulação está concentrada em um único orquestrador.

## 2–10. Problemas encontrados

| Problema | Arquivo ou módulo | Impacto | Solução recomendada | Prioridade |
| --- | --- | --- | --- | --- |
| Ciclo principal de 15 arquivos | `domain/index.ts`, `domain/*`, `PlayerMatchState`, `ActionExecution`, `PipelineExecution`, `ActionExecutionProfile` | Ordem de inicialização frágil, fronteiras falsas e alterações com efeito distante | Remover imports internos via barrel e extrair contratos neutros de ação antes de mover implementações | P0 |
| Ciclo analytics ↔ estado da bola | `BallMatchState.ts` ↔ `AssistPolicy.ts` | O núcleo físico conhece política de analytics | Extrair `AssistIntervention` e `LastCompletedPass` para contrato causal neutro; analytics depende dele | P0 |
| Ciclo reward ↔ cenário | `RewardV1.ts` ↔ `AttackerVsGoalkeeperEnvironment.ts` | Reward e ambiente não podem evoluir/testar isoladamente | Extrair `AttackerVsGoalkeeperOutcome` para contrato específico do cenário | P0 |
| Domínio depende de runtime mutável | `domain/common.ts` importa `PlayerMatchState` para `PossessionCandidate` | Inversão direta de dependência; o barrel de domínio contamina todo o grafo | Mover o candidato para o módulo de posse; `domain/common` deve conter somente valores autônomos | P0 |
| Core depende da aplicação | `PlayerMatchState`, `MovementSystem`, `PossessionSystem`, `BallMatchState` | `core` não é reutilizável nem estável; produz a maior parte dos ciclos | Extrair contratos mínimos ou reposicionar o estado de simulação em `simulation/state`; não mover às cegas | P0 |
| Orquestrador monolítico | `MatchEngine.ts` (850 linhas) | Compõe dependências, controla períodos, executa tick, publica eventos, calcula analytics, finaliza e reproduz | Manter `MatchEngine` como façade e extrair composição, loop, período, publicação e montagem do resultado | P1 |
| Método monolítico de inicialização | `runIncrementally` (287 linhas) | Difícil testar inicialização/finalização sem executar partida | Introduzir `MatchRuntimeFactory`, `MatchLifecycle` e `MatchResultAssembler` com dados explícitos | P1 |
| Tick com dependências demais | `runTick` (215 linhas, mais de 20 parâmetros) | Forte acoplamento temporal; adicionar sistema exige editar o centro | Criar `MatchRuntime` explícito e um pipeline ordenado de sistemas, sem service locator global | P1 |
| Sessão mistura controle e apresentação | `MatchSession.ts` (385 linhas), `snapshot` (107) | Sessão conhece animação, setores, debug, analytics, policy e transporte | Extrair contratos de snapshot e `MatchSnapshotMapper`; sessão preserva ciclo de vida e controle | P1 |
| Estado do jogador é um “god state” | `PlayerMatchState.ts` | Ação, pipeline, locomação, goleiro, tática, combinações e cenário compartilham um objeto mutável | Agrupar estado em componentes coesos gradualmente; primeiro encapsular mutações e expor contratos | P1 |
| Estado da bola mistura física e analytics | `BallMatchState.ts` | Movimento, posse, passe estatístico, assistência e filas de eventos se alteram juntos | Separar estado físico, proveniência causal e journal transitório, preservando uma bola autoritativa | P1 |
| Mutações diretas distribuídas | 156 atribuições em actions, physics, kickoff, restart, scenario e engine | Invariantes como `owner ↔ hasBall ↔ BallState` podem divergir | Criar operações de transição específicas (`release`, `acquire`, `placeForRestart`, `startMotion`) e testes de invariantes | P1 |
| Física concentra muitas responsabilidades | `BallPhysicsSystem.ts` (692 linhas) | Integração, campo, gol, goleiro, bloqueio, rebote, assistência e eventos ficam inseparáveis | Extrair componentes internos: integrador, boundary resolver, shot interaction e contact resolver | P1 |
| Physics depende de engine/analytics | `BallPhysicsSystem` importa reinício e assistência | Fluxo de dependência lateral/invertido | Física produz outcomes causais; lifecycle decide reinício; analytics apenas consome evento | P1 |
| Analytics monolítico | `MatchEventStore.ts` (467), `buildReport` (123) | Armazena/idempotência, normaliza, mede distância/posse, projeta relatório, timeline e xG | Separar `EventJournal`, `EventNormalizer`, `PossessionTracker`, `MatchReportProjector` e `TimelineProjector` | P1 |
| Snapshot de analytics muta e desfaz estado | `MatchEventStore.snapshot()` | `closePossession`, `splice` e restauração manual são frágeis | Projetar intervalo aberto sem alterar o journal | P1 |
| Duas fontes de métricas | `MatchMetricsCollector.ts` e `MatchEventStore`/`EventDerivedMatchMetrics` | Definições podem divergir; uma implementação está fora do fluxo oficial | Marcar collector legado, migrar consumidores e remover somente após teste de equivalência/uso | P1 |
| xG duplicado | `MatchEventStore.estimateXG` e `MatchMetricsCollector` | Alteração em um caminho não atualiza o outro | Um projetor/estimador único consumido por analytics | P2 |
| Contratos públicos dentro de implementações grandes | `MatchEngine`, `MatchSession`, `ObservationSpace`, `MatchEventStore`, environments etc. | Imports puxam implementação para usar apenas tipos; ciclos ficam mais prováveis | Extrair apenas contratos públicos/reutilizados para arquivos específicos, não toda interface privada | P2 |
| Evento de partida gigantesco | `domain/match-events.ts` (260 linhas) | Alto fan-in; qualquer alteração recompila/acopla todos os consumidores | Dividir por família (`shot`, `pass`, `discipline`, `lifecycle`) e manter union pública em um index explícito | P2 |
| Barrel interno excessivo | `domain/index.ts`, 49 consumidores | Oculta direção real e participa do ciclo principal | Internamente importar arquivos concretos; reservar barrels para a API pública | P2 |
| Tipos geométricos duplicados | interface `Vector2` em `domain/common.ts` e classe `core/geometry/Vector2.ts` | Conversões implícitas e identidade ambígua | Definir `Vector2Like` como contrato estrutural e `Vector2` como value object operacional, com nomes claros | P2 |
| Posição lógica e visual coexistem | `BallMatchState` e `MatchSession` | Duas representações autoritativas podem divergir; `HeaderAction` lê a visual | Manter uma posição física; interpolação visual pertence ao consumidor. Migrar com teste de equivalência | P2 |
| Configuração de calibração é dependência global | 11 módulos importam `ENGINE_CALIBRATION_PARAMETERS` | Testes e substituição de perfis exigem estado implícito/constante global | Criar `MatchSimulationProfile` imutável na composição e injetar somente os subconjuntos necessários | P2 |
| Valores de duração/tick repetidos | engine, manifest, calibration, protocol e observation | Defaults podem divergir | Contrato único de tempo em perfil/config normalizada | P2 |
| Protocolo faz parsing e serialização sem tipos seguros | `TrainingProtocolSession.ts`, uso de `any` | Erros de schema aparecem tarde e compactação pode omitir campos acidentalmente | Validadores explícitos de request/response e mappers FULL/COMPACT separados | P2 |
| Inicializador de cenário cresce por condicionais | `MatchScenarioInitializer.applyCurriculum` (99 linhas) | Cada cenário aumenta um switch e mutações duplicadas | Estratégias internas por `kind/stage` somente quando houver segunda variação real; compartilhar primitivas de colocação | P2 |
| Nomenclatura de camada enganosa | `core` contém estado que depende de application; `application` contém física/domínio | Leitores inferem uma regra de dependência que não existe | Adotar `simulation` como bounded context e reservar `application` para casos de uso | P2 |
| Formatação inconsistente | 175 linhas > 140; trechos sem espaços em arquivos centrais | Revisão e diff difíceis; aumenta erro em lógica densa | Configurar formatter/lint depois dos ciclos, em commit mecânico isolado | P3 |
| Baseline unitário vermelho | `RefereeSystem.test.ts` | Refatoração não terá sinal totalmente verde | Alinhar teste e configuração em decisão separada de comportamento; não esconder a falha | P0 |
| Cobertura direta desigual | nenhum teste diretamente associado a `perception` ou `cognitive` | Mudanças internas dependem apenas de integração | Adicionar characterization tests antes de decompor esses sistemas | P1 |
| Teste lento opcional | `MatchSession.test.ts` depende de `RUN_SLOW_SESSION_TESTS` | Invariante de 108.000 updates não roda normalmente | Manter job separado e obrigatório em CI noturna/pré-release | P2 |

## 3. Módulos mais acoplados

Fan-out de arquivos mais críticos:

| Arquivo | Dependências internas diretas |
| --- | ---: |
| `src/index.ts` | 70 |
| `MatchEngine.ts` | 57 |
| `ActionFactory.ts` | 18 |
| `PossessionDecisionSystem.ts` | 18 |
| `MatchSession.ts` | 18 |

Fan-in:

| Arquivo | Consumidores internos |
| --- | ---: |
| `DecisionType.ts` | 68 |
| `PlayerMatchState.ts` | 64 |
| `Vector2.ts` | 57 |
| `Decision.ts` | 49 |
| `domain/index.ts` | 49 |
| `DecisionContext.ts` | 44 |
| `MatchState.ts` | 37 |

`DecisionType`, `PlayerMatchState`, `Vector2` e `MatchState` são contratos centrais.
Movê-los sem adaptadores causaria um diff amplo e alto risco; devem ser estabilizados
antes da reorganização de diretórios.

## 4. Responsabilidades excessivas

Os maiores pontos não são apenas arquivos longos:

- `MatchEngine`: composition root + lifecycle + scheduler + regras de período +
  decisions + actions + physics + observabilidade + resultado;
- `BallPhysicsSystem`: integração + colisões + finalização + goleiro + boundary +
  rebote + efeitos de analytics;
- `MatchEventStore`: journal + normalização + deduplicação + tracking contínuo +
  relatório + timeline + xG;
- `MatchSession`: ciclo de vida + policy control + replay + mapeamento DTO + campos
  específicos de animação/debug;
- `PlayerMatchState`: estado de pelo menos seis subdomínios;
- `MatchMetricsCollector`: collector legado completo coexistindo com a fonte oficial.

## 5. Tipos e interfaces mal posicionados

Extrações seguras e justificadas:

- `AttackerVsGoalkeeperOutcome`: usado por cenário e reward;
- `AssistIntervention`/`LastCompletedPass`: usado por física/estado e analytics;
- `MatchResult`, `IncrementalMatchFrame`, `MatchDiagnosticEvent`: contratos públicos do
  engine, hoje definidos junto do orquestrador;
- `MatchSnapshot`, `PlayerSnapshot`, `BallSnapshot`: DTOs públicos, hoje junto da sessão;
- payloads e responses do protocolo: manter no módulo de protocolo, mas separados dos
  handlers/serializadores;
- `PossessionCandidate`: pertence ao contrato do sistema de posse, não a `domain/common`.

Interfaces pequenas usadas exclusivamente dentro de uma classe devem continuar no
mesmo arquivo ou privadas. A meta não é criar um diretório global `interfaces/`.

## 6. Ciclos e dependências perigosas

```text
BallMatchState ──type──> AssistPolicy
      ^                       │
      └────── LastCompletedPass

RewardV1 ──type──> AttackerVsGoalkeeperEnvironment
   ^                            │
   └──────── reward function ───┘

domain barrel → PlayerMatchState → Action/Pipeline → domain barrel
```

Além dos ciclos, há dependências invertidas de `core` para `application` em movimento,
ação, decisão, analytics e tática. A correção deve começar pelos contratos, não por
renomear pastas.

## 7. Duplicações

- montagem de `MatchResult` aparece no término dentro do loop e novamente após o loop;
- defaults de duração/tick são repetidos em seis módulos;
- xG é calculado em dois collectors;
- métricas por evento coexistem com o collector antigo;
- reset de bola/jogadores é repetido entre kickoff, restart e scenario initializer;
- FULL/COMPACT protocol mapping repete projeção de máscaras;
- `PureMatchEnvironment` e `MultiAgentMatchEnvironment` repetem lifecycle, limites,
  avanço até boundary e validação de ação;
- posição física/visual da bola mantém campos e sincronizações paralelas.

## 8. Nomenclatura

- `core` sugere independência, mas depende da aplicação;
- `MatchMetricsCollector` parece oficial, porém o fluxo oficial usa eventos;
- `visualPosition` está dentro do estado físico e pode ser entendido como fonte;
- `MatchEventStore` faz muito além de armazenar eventos;
- `runTick` é, na prática, o pipeline inteiro da simulação;
- `MatchSession.snapshot` também calcula campos derivados de apresentação.

## 9. Violações de domínio

- `domain/common` conhece `PlayerMatchState` mutável;
- física dispara preocupações de assistência e reinício;
- estado da bola contém intervenções de assistência;
- sessão da engine decide `animationState` e setores de debug;
- analytics usa diretamente `MatchState` mutável para interpretar eventos históricos;
- normalização de evento calcula zona com limites fixos 35/70 em vez do pitch do evento;
- `resolveStrictness` ignora o árbitro e retorna `0.5` fixo; é comportamento incompleto,
  mas não deve ser alterado dentro de uma refatoração estrutural.

## 10. Riscos de regressão

1. Ordem dos sistemas por tick é comportamento observável e deve permanecer idêntica.
2. Consumo dos streams RNG não pode mudar de ordem.
3. IDs, ordem e idempotência dos eventos fazem parte do hash reproduzível.
4. Trocar mutações diretas por métodos pode mudar o instante de `owner/hasBall`.
5. Separar analytics pode alterar arredondamento, posse e xG.
6. Mover tipos usados em barrels pode introduzir ciclos de runtime se `import type` for
   convertido em import de valor.
7. Formatação/movimentação em massa esconderia alterações semânticas no diff.
8. A suíte já possui uma falha de disciplina; ela deve ser isolada antes de comparar.
9. Testes estatísticos e de integração são lentos e não devem ser substituídos apenas
   por testes unitários.

## 11. Arquitetura-alvo

A estrutura é vertical por bounded context; pastas `contracts`, `types`, `events` etc.
existem dentro do módulo que as possui, não como depósitos globais.

```text
src/
├── domain/
│   ├── match/
│   │   ├── entities/          Match, Team, Player, Pitch, Referee
│   │   ├── value-objects/     IDs, AttributeValue, tempo
│   │   ├── events/            lifecycle, pass, shot, discipline + union
│   │   └── contracts/         configuração imutável
│   └── geometry/
│       ├── value-objects/     Vector2, Vector3
│       └── contracts/         Vector2Like, RectLike
├── simulation/
│   ├── state/                 MatchState, TeamState, PlayerState, BallState
│   ├── engine/
│   │   ├── services/          MatchLifecycle, MatchTickPipeline
│   │   ├── factories/         MatchRuntimeFactory
│   │   ├── contracts/         MatchResult, IncrementalFrame, SimulationConfig
│   │   └── MatchEngine.ts     façade
│   ├── action/
│   │   ├── contracts/         Action, context, result
│   │   ├── types/             status/type/phase
│   │   ├── execution/         ActionExecution, PipelineExecution
│   │   ├── actions/           implementações concretas
│   │   ├── factories/         ActionFactory
│   │   └── validators/        invariantes de início/execução
│   ├── physics/
│   │   ├── systems/           BallIntegrator
│   │   ├── services/          boundary, contact, shot resolution
│   │   └── events/            outcomes físicos
│   ├── movement|possession|decision|tactical|referee|goalkeeper/
│   │   └── contracts, systems e services específicos quando necessários
│   └── configuration/         MatchSimulationProfile imutável
├── observability/
│   ├── events/                EventJournal e normalização
│   ├── analytics/             projetores e trackers
│   ├── metrics/               contrato oficial único
│   ├── diagnostics/           collectors opcionais
│   └── replay/
├── application/
│   └── match/
│       ├── MatchSession.ts    lifecycle e controle
│       ├── snapshots/         contratos + mapper
│       └── policies/          fronteira substituível
├── infrastructure/
│   ├── protocol/              validators, handlers, serializers
│   └── runtime/               schedulers/adapters externos
└── index.ts                   API pública, sem uso por módulos internos
```

Essa é uma direção final, não um pedido para mover 217 arquivos imediatamente.

### Direção permitida

```text
infrastructure → application → simulation → domain
                              ↘ observability (consome eventos)
```

`simulation` não importa protocolo, frontend, Python ou projetores de analytics.
Observabilidade não altera estado esportivo. O composition root conecta implementações.

## 12. Ordem segura de refatoração

### Etapa 0 — Guardrails

- manter `npm test` da raiz como comando canônico e documentar que o binário Jest não deve ser chamado diretamente fora de `engine`;
- documentar/corrigir separadamente o baseline vermelho do árbitro;
- adicionar teste automatizado de ciclos e fronteiras;
- registrar hashes de partidas curtas com seeds fixas;
- nenhuma mudança esportiva.

### Etapa 1 — Quebrar os três ciclos

- mover somente `PossessionCandidate`, contratos de assistência e outcome do cenário;
- substituir imports internos do barrel de domínio por imports concretos nos arquivos
  do ciclo;
- validar build, unitários, determinismo e hashes.

### Etapa 2 — Encapsular invariantes de estado

- introduzir operações de transição na bola e no jogador;
- migrar um produtor por vez: actions, physics, kickoff, restart, scenario;
- criar testes para `owner/hasBall/state/motion` após cada migração.

### Etapa 3 — Decompor MatchEngine sem reordenar o tick

- extrair `MatchRuntimeFactory`;
- extrair `MatchResultAssembler` e remover finalização duplicada;
- extrair `MatchLifecycle` para períodos/reinícios;
- por último encapsular `MatchTickPipeline`, preservando a ordem atual explicitamente.

### Etapa 4 — Isolar snapshots

- mover contratos DTO e `MatchSnapshotMapper` para arquivos próprios;
- retirar `animationState` e agregações visuais da sessão sem mudar o JSON publicado;
- golden tests do snapshot.

### Etapa 5 — Separar física

- primeiro characterization tests por outcome;
- extrair integração, boundary, contato e shot resolution internamente;
- outcomes físicos viram eventos/retornos, sem chamar analytics.

### Etapa 6 — Unificar eventos, analytics e métricas

- separar journal de projetores;
- tornar snapshot de analytics uma leitura pura;
- provar equivalência do collector legado e migrar/remover sua exportação;
- centralizar xG e definições.

### Etapa 7 — Decision, perception e tactical

- adicionar testes diretos de percepção/cognição;
- separar evaluators puros de orquestração;
- reduzir contextos amplos somente com evidência de dependências não usadas.

### Etapa 8 — Organização física e qualidade

- mover diretórios já desacoplados para a árvore-alvo;
- formatter/lint em alteração mecânica isolada;
- ativar `noUnusedLocals`/`noUnusedParameters` progressivamente;
- remover código morto apenas com busca de consumidores e teste.

## Baseline verificado

Comando de typecheck executado com sucesso:

```text
tsc --noEmit -p engine/tsconfig.json
```

Suíte unitária executada a partir de `engine/`:

```text
Test Suites: 68 passed, 1 failed, 69 total
Tests:       314 passed, 1 failed, 315 total
```

Falha preexistente: `RefereeSystem.test.ts` espera taxa de faltas `< 0.45`; a seed 42
produz `0.623` com `baseFoulChance: 0.92`. Corrigir essa diferença é uma decisão de
calibração/teste e está fora desta auditoria arquitetural.

Executar diretamente o binário Jest pela raiz sem indicar a configuração da engine
produz falhas de parsing. Isso não é defeito do workspace: o comando canônico
`npm test` da raiz já delega ao workspace `engine` e deve ser usado por CI e pessoas.

## Estado desta entrega

Arquivos criados: somente este documento.

Arquivos de produção movidos, alterados ou removidos: nenhum.

Mudança de comportamento: nenhuma.

Problemas que permanecem: todos os itens da tabela; a auditoria deliberadamente vem
antes da primeira refatoração. O próximo passo recomendado é exclusivamente a Etapa 0,
seguida da Etapa 1 em mudanças pequenas e verificáveis.

## Registro incremental posterior à auditoria

### Etapa 0 — guardrail arquitetural

- adicionado `tests/architecture/DependencyBoundaries.test.ts`;
- o teste congela componentes cíclicos e violações de camada conhecidos;
- dívida removida exige reduzir explicitamente o baseline; dívida nova falha;
- comportamento esportivo preservado.

### Etapa 1A — contratos causais

- `PossessionCandidate` saiu de `domain/common` para o contrato do sistema de posse;
- `AssistIntervention` e `LastCompletedPass` foram unidos em contrato causal neutro;
- `AttackerVsGoalkeeperOutcome` saiu da implementação do ambiente;
- ciclos analytics ↔ bola e reward ↔ cenário foram eliminados;
- o ciclo principal caiu de 15 para 4 arquivos;
- violações de camada conhecidas caíram de 11 para 9;
- exports públicos anteriores foram preservados por re-export onde aplicável.

Na Etapa 1B, os três vínculos restantes de `ActionExecution`,
`ActionExecutionProfile` e `PipelineExecution` com `PlayerMatchState` foram declarados
corretamente como dependências somente de tipo. O grafo de imports executados em
runtime ficou acíclico. O acoplamento estrutural de tipos permanece registrado como
dívida de camada e será reduzido por contratos, sem forçar uma migração ampla agora.

Validação após a Etapa 1A:

```text
Build TypeScript: passou
Determinismo: 2/2 testes passaram
Arquitetura + unitários: 69 suítes passaram, 1 falhou
Testes: 316 passaram, 1 falhou
```

### Etapa 2 — invariantes de posicionamento da bola

- criado `BallPlacement` como ponto único para kickoff, reinícios e cenários;
- centralizadas as transições de proprietário, movimento, altura e estado da bola;
- `KickoffSystem`, `RestartSystem` e `MatchScenarioInitializer` deixaram de repetir
  mutações parciais do agregado;
- testes de caracterização cobrem kickoff, bola parada, cenário e retenção;
- a representação pública ainda não foi fechada: consumidores legados continuam
  podendo ler o estado, e a migração de todas as escritas será incremental.

### Etapa 3A — contratos e resultado de `MatchEngine`

- `MatchResult`, `IncrementalMatchFrame` e `MatchDiagnosticEvent` saíram da classe
  orquestradora para contratos dedicados, com re-exports compatíveis;
- `MatchResultAssembler` passou a ser a única implementação da projeção final,
  incluindo métricas derivadas, hash esportivo e filtros de instrumentação;
- removida a montagem duplicada dos caminhos normal e de encerramento do generator;
- ordem de ticks, streams de RNG, eventos, física e decisões não foram alteradas.

Validação desta fatia:

```text
Build TypeScript: passou
Arquitetura: 2/2 testes passaram
Determinismo: 2/2 testes passaram
MatchSession + kickoff + reinícios + BallPlacement: 18 passaram, 1 ignorado
```

Próxima fatia segura: extrair o mapeamento de snapshots de `MatchSession` com golden
tests antes de separar a inicialização e o loop de runtime de `MatchEngine`.

A única falha continua sendo exatamente o baseline preexistente de taxa de faltas em
`RefereeSystem.test.ts` (`0.623`, limite antigo `< 0.45`). Nenhuma falha nova surgiu.
