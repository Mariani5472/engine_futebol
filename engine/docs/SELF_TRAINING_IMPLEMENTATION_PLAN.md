# Plano de implantação do self-training

## Objetivo

Transformar a engine em um ambiente de aprendizado progressivo e reproduzível:

```text
habilidades individuais
→ duelos
→ pequenas unidades
→ transições
→ bolas paradas
→ setores
→ jogo coletivo
→ partida completa
→ self-play
```

Este documento é o roteiro operacional. Ele complementa, sem substituir,
`PURE_ENVIRONMENT.md`, `ACTION_SPACE.md`, `OBSERVATION_SPACE.md`, `REWARD_V1.md`,
`PPO_V1.md`, `TYPESCRIPT_PYTHON_PROTOCOL.md` e `CURRICULUM_AND_SELF_PLAY.md`.

## Estado de implementação

Legenda: `[x]` implementado e validado; `[-]` parcial; `[ ]` pendente.

### Base já disponível

- [x] `MatchSession` causal com timestep fixo de `0.05s`.
- [x] Ambiente puro `reset/step` sem frontend, HTTP ou relógio real.
- [x] Action space discreto, action mask autoritativa e observation space versionada.
- [x] Protocolo persistente TypeScript–Python e wrapper Gymnasium.
- [x] Cenário atacante × goleiro, baselines internas, reward v1 e primeiro PPO.
- [x] Ambiente multiagente, gates estatísticos e pool determinístico de adversários.

### Implementado neste incremento

- [x] Catálogo autoritativo e versionado de cenários executáveis.
- [x] Contrato `TrainingScenarioDefinition` com família, agentes, política,
  adversário, dificuldade, intervalo, limite, término, sucesso, reward e capacidades.
- [x] IDs únicos, definições imutáveis e validação estrutural no carregamento.
- [x] O `CurriculumPlan` obtém seus presets por meio do catálogo.
- [x] Teste de reset determinístico para todos os oito presets executáveis do v1.
- [x] Exportação pública do catálogo e de suas versões.
- [x] `MovementScenarioEnvironment` com alvo físico fixo, chegada sem teleporte,
  resultado `TARGET_REACHED`, timeout e reward de progresso reconstruível.
- [x] `BallControlScenarioEnvironment` com bola inicialmente livre, aproximação pela
  locomoção real e sucesso somente após aquisição física autoritativa.
- [x] `PassingScenarioEnvironment` com recebedor físico e resultados derivados de
  `PASS_COMPLETED`/`PASS_INTERCEPTED`, sem entrega instantânea.
- [x] `ShootingScenarioEnvironment` sem goleiro na zona de defesa, usando trajetória,
  trave, saída e gol resolvidos pelo `BallPhysicsSystem`.
- [x] Reward fundamental v1 com custo de decisão, progresso limitado e outcome
  semântico; o total é integralmente reconstruível.
- [x] Ordem mestre oficial inicia em `MOVEMENT → BALL_CONTROL → PASSING →
  SHOOTING_EMPTY_GOAL`, antes do currículo legado iniciado por `PASS`.
- [x] Os quatro ambientes estão disponíveis no protocolo persistente e no wrapper
  Python/Gymnasium `FundamentalSkillEnv`.
- [x] Baselines fundamentais `RANDOM_VALID` e `SCRIPTED_SKILL`; a scripted escolhe
  `MOVE`, `CONTROL`, `PASS` ou `SHOT` conforme a habilidade e nunca ignora a mask.
- [x] Sampler determinístico de dificuldade com distância, tolerância e variação
  lateral progressivas por habilidade.
- [x] Partições disjuntas `TRAINING`, `SELECTION`, `EVALUATION`, `GENERALIZATION` e
  `REGRESSION`, todas derivadas de uma seed raiz sem sobreposição.
- [x] Avaliador pareado com registros por episódio, retorno médio, taxa de sucesso,
  Wilson 95% e reprodução de seeds/policy seeds.
- [x] Gate de promoção exige amostra mínima, limites inferiores de avaliação,
  generalização e regressão, retorno mínimo e gap máximo seleção–avaliação.
- [x] `FundamentalCurriculumManager` Python consome plano/gate autoritativos, coleta
  evidências e nunca promove um resultado diferente de `COMPLETE`.
- [x] Model registry persiste checkpoint imutável, SHA-256, lineage, versões,
  manifesto e relatório; índices JSON são atualizados por substituição atômica.

### Parcial

- [-] Marco A: catálogo, contratos e famílias fundamentais básicas estão prontos;
  falta validar capacidades dinamicamente e ampliar a parametrização por dificuldade.
- [-] Nível 2: atacante × goleiro está implementado; os demais duelos ainda não.
- [-] Nível 3: `PASS`, `TWO_V_ONE` e `THREE_V_TWO` existem, mas rewards e gates ainda
  precisam ser especializados por competência.
- [-] Níveis 7–9: infraestrutura de 5×5, 11×11, política coletiva e self-play existe;
  isso não significa que checkpoints convergidos ou a liga completa existam.

### Pendente imediato

- [ ] Expandir movimento para trajetórias, zonas, mudança de direção e orientação.
- [ ] Expandir domínio para passes fortes/aéreos, condução e pé dominante.
- [ ] Ampliar passe para alvo móvel, alturas, força e passe no espaço.
- [ ] Ampliar finalização para ângulos, distâncias, regiões, força e ambos os pés.
- [x] Baselines scripted e matriz held-out para essas quatro famílias.
- [x] Loop MaskablePPO conectado ao `FundamentalCurriculumManager`, com sampler
  autoritativo, avaliação held-out, gate e promoção no registry.
- [ ] Aplicar rehearsal em 20–30% dos episódios posteriores.
- [ ] Demais duelos, transições, bolas paradas, setores, minijogos e liga completa.

## Princípios obrigatórios

1. Existe uma única física: treino, avaliação, frontend e partida completa usam
   `MatchSession` e timestep fixo de `0.05s`.
2. Cenários configuram estado inicial, agentes, limite e resultado; não reimplementam
   passe, chute, disputa, goleiro, impedimento ou reinício.
3. A engine TypeScript é autoritativa para estado, action mask, término e eventos.
4. O Python escolhe ações e treina modelos; não corrige ações inválidas nem regras.
5. Seeds de treino, seleção, avaliação e generalização são disjuntas.
6. Promoção depende de avaliação held-out com intervalo de confiança, não da curva de
   reward de treino.
7. Todo reward deve ser nomeado, limitado e reconstruível a partir da transição e dos
   eventos causais.
8. Cada checkpoint registra versões, configuração, hashes, código e métricas.
9. Uma política nova precisa manter competências anteriores; regressão bloqueia a
   promoção.
10. Self-play começa apenas após políticas úteis contra baselines congeladas.

## Arquitetura-alvo

```text
Scenario Library
  → Curriculum Manager
    → Environment Workers
      → Experience Collector
        → Trainer
          → Evaluator
            → Checkpoint League
              → Self-Play Manager
                → Model Registry
```

### Fronteiras

- **Engine/Scenario Library:** cria estados válidos e resultados semânticos.
- **Curriculum Manager:** amostra tarefa e dificuldade e decide promoção.
- **Workers:** executam ambientes isolados por seed e RNG.
- **Collector:** grava observação, mask, ação, reward, término e versão.
- **Trainer:** otimiza a política sem conhecer internals da engine.
- **Evaluator:** executa seeds congeladas e compara baselines/checkpoints.
- **League:** preserva adversários históricos imutáveis e ratings.
- **Registry:** guarda artefatos, manifesto, lineage e status de promoção.

Não criar uma classe por exercício. Implementar famílias configuráveis:

```text
MovementScenario       BallControlScenario    PassingScenario
ShootingScenario       GoalkeeperScenario     DuelScenario
OverloadScenario       TransitionScenario     SetPieceScenario
PositionalScenario     SmallSidedGameScenario FullMatchScenario
```

## Contrato comum de cenário

Todo cenário deve declarar, em dados versionados:

```ts
interface TrainingScenarioDefinition {
  id: string;
  family: string;
  version: number;
  controlledAgentIds: readonly string[];
  policyMode: "SINGLE_AGENT" | "SHARED_TEAM" | "SELF_PLAY";
  opponentMode: "NONE" | "FROZEN" | "HEURISTIC" | "CHECKPOINT" | "OPPONENT_POOL";
  difficulty: Record<string, number | boolean | string>;
  decisionIntervalTicks: number;
  timeLimitSeconds: number;
  terminationRules: readonly string[];
  successRules: readonly string[];
  rewardProfileId: string;
  requiredCapabilities: readonly string[];
}
```

`reset(seed)` deve produzir o mesmo estado inicial. `step(actions)` deve consumir
exatamente as ações dos agentes ativos, executar uma quantidade fixa de ticks e
retornar observações, masks, rewards, resultados semânticos, `terminated` e
`truncated`.

## Currículo mestre

### Nível 0 — validação da infraestrutura

Entregas:

- determinismo de `reset/step` e isolamento de ambientes simultâneos;
- manifesto e replay reproduzível;
- action mask e execução usando a mesma regra;
- teste contra vazamento da observação do ator;
- baseline aleatória válida, scripted e heurística;
- profiling com 1, 2, 4 e 8 ambientes.

Portão: zero divergências em replay, zero ações aceitas fora da mask e nenhuma seed
compartilhada entre treino e avaliação.

### Nível 1 — controle individual sem adversário

Famílias e competências:

- `MovementScenario`: alvo, trajetória, zona, orientação, aceleração, frenagem e
  limites do campo;
- `BallControlScenario`: domínio parado/rasteiro/forte/aéreo, condução, mudança de
  direção, proteção e preparação corporal;
- `PassingScenario`: alvo parado/em movimento, força, altura, pé e passe no espaço;
- `ShootingScenario`: ângulo, distância, região do gol, força, primeira finalização
  e pé não dominante, inicialmente sem goleiro.

Dificuldade: tolerância ampla → menor; bola parada → móvel; alvo grande → pequeno;
tempo longo → curto; pé dominante → ambos.

Portão sugerido: limite inferior de Wilson ≥ 0,90 em tarefas básicas e ≥ 0,80 nas
variações difíceis; nenhuma competência básica pode regredir mais de 5 pontos
percentuais.

### Nível 2 — resultado e duelos individuais

- atacante × goleiro;
- atacante × defensor;
- defensor × atacante;
- goleiro × finalização;
- rebote e segunda ação.

Variar distância, ângulo, velocidade, atributos, lado forte, pressão e timeout.
Treinar os dois lados separadamente antes de permitir coadaptação.

Portão: superar política aleatória e scripted em seeds held-out; desempenho mínimo
contra pelo menos três níveis congelados de adversário; faltas e ações inválidas
dentro dos limites do cenário.

### Nível 3 — cooperação e pequenas unidades

- passe, recepção e interceptação;
- linha de passe, desmarque e recepção orientada;
- tabela e passe seguido de deslocamento;
- 2×1, 2×1 + goleiro e 3×2;
- contenção, cobertura e proteção do corredor central;
- terceiro homem somente depois da tabela simples estar estável.

Este nível absorve os IDs públicos atuais `PASS`, `TWO_V_ONE` e `THREE_V_TWO`.

Portão: sucesso coletivo, ocupação espacial, perdas evitáveis e generalização contra
defensores com atributos e políticas não vistos. Medir crédito por agente, além do
retorno do time.

### Nível 4 — transições

- contra-ataques 1×1, 2×1, 2×2, 3×2, 3×3 e 4×3;
- início após interceptação, defesa, escanteio ou perda;
- decisão acelerar/reter e passe/finalização;
- reação à perda, contrapressão, recomposição e atraso do ataque;
- evitar impedimento e reorganizar após desaparecer a vantagem.

Dificuldade: sem defensor → lento → equivalente → rápido → bloco parcialmente
organizado → bloco recomposto.

Portão: tempo de transição, progressão, qualidade da chance e recuperação da forma;
não promover uma política que apenas corre ou finaliza sempre.

### Nível 5 — bolas paradas e área

- cruzamentos e ocupação de primeiro poste, segundo poste, centro e rebote;
- escanteios ofensivos, defensivos e transição;
- faltas diretas, cruzadas e curtas;
- pênaltis;
- laterais, tiros de meta e distribuição do goleiro.

Cada reinício começa de um estado regulamentar produzido pela engine. O cobrador não
pode receber privilégios fora da action mask.

Portão: variedade de decisões, execução válida, defesa de segunda bola e prevenção
de contra-ataque. Detectar colapso para uma única jogada ensaiada.

### Nível 6 — setores e funções

- linha defensiva: profundidade, cobertura e basculação;
- unidade de meio: linhas de passe, proteção e circulação;
- trio ofensivo: largura, profundidade, combinações e ataque à área;
- saída de bola e pressão coletiva;
- currículo próprio de goleiro;
- comportamento por zagueiro, lateral/ala, volante, meia, ponta e centroavante.

A política pode ser compartilhada, mas recebe função e contexto na observação. A
função define responsabilidade espacial; atributos definem qualidade de execução.

Portão: métricas por setor e função dentro de faixas, formação reconhecível e
generalização para posições iniciais/formações não usadas na seleção.

### Nível 7 — minijogos

- 3×3, 4×4 e `FIVE_V_FIVE`;
- campo reduzido, zonas, limite de toques e manutenção de posse;
- superioridade numérica, ataque × defesa e ondas consecutivas;
- goleiros congelados → heurísticos → aprendidos.

Portão: checkpoint supera baselines em placar e métricas de processo sem degradar o
conjunto de regressão dos níveis 1–6.

### Nível 8 — jogo coletivo e partida

- fases completas: construção, progressão, ataque posicional e blocos;
- pressão alta, saída contra pressão, bloco baixo e contra-ataque;
- objetivos especiais de placar, tempo e inferioridade numérica;
- `ELEVEN_V_ELEVEN` contra diferentes heurísticas;
- `COLLECTIVE_POLICY` contra checkpoints congelados.

Começar com política compartilhada por jogadores de linha e política separada para
goleiro. Somente depois avaliar políticas por função e controlador hierárquico.

Portão: avaliação em formações, estilos, atributos, placares e tempos variados;
distribuições futebolísticas plausíveis e ausência de exploits conhecidos.

### Nível 9 — self-play e liga

Ordem:

1. learner contra heurística congelada;
2. política atual contra checkpoint anterior;
3. amostragem determinística de adversários históricos;
4. liga com rating e adversários de estilos distintos;
5. políticas compartilhadas, por função e goleiro separado;
6. self-play hierárquico somente após baselines coletivas estáveis.

O `OpponentPool` deve conservar modelos imutáveis. A distribuição inicial sugerida é
40% adversário próximo em rating, 30% checkpoint recente, 20% histórico uniforme e
10% baseline heurística. Ajustar somente com evidência de matchmaking pobre.

Portão: promoção por torneio held-out, robustez contra toda a liga, ausência de
esquecimento e nenhuma estratégia dominante explorando uma falha da engine.

## Progressão de dificuldade

Cada família expõe um vetor normalizado de dificuldade. O curriculum manager altera
uma dimensão por vez quando possível:

- tolerância espacial e temporal;
- distância, ângulo e velocidade;
- número e nível de adversários;
- informação parcial e pressão;
- tamanho do campo e densidade;
- pé fraco, stamina e atributos;
- tempo/placar e consequências da perda.

Usar amostragem por faixa, não uma sequência fixa. Depois de promovida, conservar
20–30% de episódios de níveis anteriores para rehearsal.

## Rewards

Manter rewards pequenos e explicáveis:

- terminal: sucesso, gol, defesa, perda decisiva e resultado;
- processo causal: domínio, passe recebido, progressão, criação/bloqueio de chance;
- custo: ação inválida, saída do campo, falta evitável e timeout;
- coletivo: espaçamento, cobertura ou compactação apenas quando medidos por uma
  definição pública e testada.

Proibições:

- reward baseado em posição futura ou informação invisível ao ator;
- duplicar recompensa para eventos equivalentes;
- premiar diretamente velocidade, posse ou chute sem relação com a tarefa;
- alterar física para facilitar convergência;
- usar xG não validado como objetivo principal.

Cada episódio registra o breakdown. A soma deve reproduzir exatamente o retorno.

## Avaliação e promoção

Para cada checkpoint, executar quatro conjuntos imutáveis:

1. **seleção:** escolhe checkpoint durante o treino;
2. **avaliação:** decide o portão de promoção;
3. **generalização:** varia configurações fora da distribuição;
4. **regressão:** repete competências já promovidas.

Relatório mínimo:

- taxa de sucesso e intervalo de Wilson de 95%;
- retorno médio e intervalo de confiança;
- mediana, percentis e distribuição de resultados;
- comparação pareada contra baselines;
- action-mask violations e timeouts;
- métricas causais específicas do cenário;
- gap treino/avaliação e avaliação/generalização;
- regressões por competência;
- seeds, versões e hashes.

Não promover se algum requisito obrigatório falhar, mesmo com retorno médio maior.

## Artefatos e manifesto

Estrutura recomendada:

```text
training/
  configs/
  scenarios/
  runs/<run-id>/
    run.json
    metrics.jsonl
    checkpoints/
    evaluations/
    replays/
  registry/
    models.json
    league.json
```

`run.json` deve incluir pelo menos:

- run ID, data, commit e estado dirty;
- seed raiz e intervalos de seeds;
- versões do protocolo, cenário, currículo, observation/action space e reward;
- configuração completa e hash;
- algoritmo e hiperparâmetros;
- versão da engine, Node, Python e dependências;
- checkpoint de origem e lineage;
- número de workers e formato do protocolo.

## Ordem de implementação no repositório

### Marco A — catálogo e contratos

- ampliar `MatchScenario` para famílias e dificuldade versionada;
- criar registro de cenários por ID estável;
- acrescentar resultados semânticos comuns;
- validar configurações e capacidades exigidas;
- testes de reset determinístico para cada preset.

### Marco B — níveis 1 e 2

- implementar movimento, domínio, passe e chute sem oposição;
- completar atacante × goleiro, atacante × defensor e goleiro;
- criar baselines scripted por família;
- criar matriz de avaliação held-out.

### Marco C — níveis 3 e 4

- generalizar o multi-agent para unidades pequenas;
- implementar crédito individual/coletivo;
- adicionar transições e progressão de dificuldade;
- integrar rehearsal de competências anteriores.

### Marco D — níveis 5 a 7

- cenários de reinício reutilizando regras reais;
- cenários por setor/função;
- minijogos e goleiro aprendido;
- benchmarks de throughput antes de ampliar workers.

### Marco C operacional — futebol reduzido (implantação atual)

- [x] `FIVE_V_FIVE` determinístico com 5 jogadores ativos por equipe.
- [x] `SEVEN_V_SEVEN` determinístico com 7 jogadores ativos por equipe.
- [x] Presets independentes de pressão, largura, linha, circulação e transição.
- [x] Parâmetros táticos aplicados à `Tactic` real; não executam ações diretamente.
- [x] `reset/step` multiagente compartilhando a mesma física, mask e eventos da partida.
- [x] Liga inicial por divisão, checkpoints coletivos imutáveis, ida/volta e rating Elo.
- [x] Hot path de treino não materializa snapshots de frontend a cada tick físico.
- [x] 5×5 precede 7×7 nos gates; 7×7 precede goleiro aprendido.
- [ ] Treinar e promover checkpoints reais de 5×5 e 7×7.
- [x] Persistir resultados/standings da liga atomicamente no model registry Python.
- [ ] Adicionar adversários de estilos congelados e torneio held-out oficial.
- [ ] Medir throughput em múltiplos workers e definir gate mínimo de performance.
- [ ] Implementar duelos aéreos e ombro a ombro antes de usá-los em rewards coletivos.

### Marco E — nível 8

- partida 11×11 contra biblioteca congelada de estilos;
- objetivos condicionais na observação;
- avaliação de distribuições esportivas e táticas;
- política coletiva e por função.

### Marco F — nível 9

- registry de modelos e lineage;
- liga de checkpoints, rating, torneio e matchmaking;
- detecção de exploit e esquecimento;
- promoção/rebaixamento automatizados e rollback.

## Checklist de aceite por nova família

- [ ] Usa a física e os eventos reais da engine.
- [ ] `reset(seed)` e replay são determinísticos.
- [ ] Configuração, observação, ação e reward têm versão.
- [ ] Mask e execução compartilham a mesma validação.
- [ ] Terminação e truncamento são distintos.
- [ ] Possui baseline aleatória, scripted e heurística quando aplicável.
- [ ] Rewards são reconstruíveis e limitados.
- [ ] Seeds de treino e avaliação são disjuntas.
- [ ] Há testes de invariantes e de vazamento.
- [ ] Há métricas de processo e de resultado.
- [ ] A promoção usa intervalo de confiança.
- [ ] Regressões anteriores fazem parte do portão.
- [ ] Checkpoint e manifesto são imutáveis e verificáveis por hash.

## Situação do primeiro incremento

Concluído:

1. registro versionado de famílias de cenário;
2. ambientes executáveis de movimento, domínio, passe e chute sem oposição;
3. ordem mestre dos fundamentos anterior a `PASS`;
4. protocolo TypeScript–Python e wrapper Gymnasium;
5. término e reward causal reconstruível.

Próximo incremento:

1. aplicar rehearsal de fundamentos em 20–30% dos episódios posteriores;
2. treinar e avaliar `BALL_CONTROL`, `PASSING` e `SHOOTING_EMPTY_GOAL`;
3. somente então iniciar atacante × defensor e os demais duelos.

Ter infraestrutura de cenário não significa que uma política já foi treinada ou
convergiu. O milestone completo exige avaliação held-out e bloqueio de regressões.

## Uso dos treinos individuais

TypeScript:

```ts
const environment = new MovementScenarioEnvironment({
  playerId: "home-10",
  playerPosition: { x: 40, y: 34 },
  targetPosition: { x: 48, y: 34 },
  ballPosition: { x: 1, y: 1 },
  configFactory: seed => createTrainingConfig(seed),
});

const boundary = environment.reset(1001);
const transition = environment.step({ actionId: "MOVE" });
```

Python/Gymnasium:

```python
from football_env import FundamentalSkillEnv

with FundamentalSkillEnv("PASSING", seed=1001) as env:
    observation, info = env.reset(seed=1001)
    mask = env.action_masks()
    observation, reward, terminated, truncated, info = env.step(action)
```

Skills disponíveis: `MOVEMENT`, `BALL_CONTROL`, `PASSING` e
`SHOOTING_EMPTY_GOAL`. A disponibilidade do ambiente significa infraestrutura
executável; não significa que um checkpoint já tenha convergido.

Avaliação e promoção:

```ts
const seeds = createFundamentalSeedPartitions(1001);
const baseline = scriptedFundamentalBaseline("MOVEMENT");
const report = new FundamentalTrainingEvaluator({
  skill: "MOVEMENT",
  baseline,
  seedPartitions: seeds,
  environmentFactory: (seed, difficulty) => createMovementEnvironment(seed, difficulty),
}).evaluate();

const gate = evaluateFundamentalPromotionGate(report);
// gate.state somente será COMPLETE se avaliação, generalização e regressão passarem.
```

O sampler usa dificuldade `0..1`. Avaliação usa a mesma faixa da seleção;
generalização usa dificuldade máxima e regressão retorna a exercícios fáceis para
detectar esquecimento.

Persistência Python:

```python
manager = FundamentalCurriculumManager(client, "training/registry")
result = manager.evaluate_and_promote(
    skill="MOVEMENT",
    root_seed=1001,
    runner=run_checkpoint_episode,
    checkpoint_path="training/runs/run-42/model.zip",
    checkpoint_id="movement-v1",
    lineage=["bootstrap"],
    versions={"protocol": 1, "observation": 1, "actionSpace": 1, "reward": 1},
)
```

Mesmo quando o gate falha, `runs/<run-id>/evaluation.json` e `manifest.json` são
preservados para auditoria. `models.json` e o artefato promovido só são criados para
gate `COMPLETE`.

### Primeira promoção oficial

Em 4 de agosto de 2026, o bootstrap `MOVEMENT` foi treinado por 1.500 passos
(1.536 passos efetivos por arredondamento dos rollouts PPO) nos níveis de dificuldade
`0.15`, `0.35` e `0.6`. O gate oficial avaliou 500 episódios disjuntos: 200 de treino
auditado e 100 em cada conjunto de seleção, avaliação, generalização e regressão.

O checkpoint `movement-ppo-official-v1` obteve 100% de sucesso em todas as partições.
Nos conjuntos de 100 episódios, o limite inferior Wilson de 95% foi `0.9630`. O gate
retornou `COMPLETE` e o registry persistiu o artefato com SHA-256
`1946981589d494a81370fd53f4169806273b11151b7be0bf7a0b9eca7a6e8f9b`.

Execução reproduzível no container:

```bash
docker compose --profile training run --rm trainer python -u python/train_fundamental_ppo.py \
  --skill MOVEMENT --timesteps 1500 --seed 2026 \
  --training-seeds 200 --selection-seeds 100 --evaluation-seeds 100 \
  --generalization-seeds 100 --regression-seeds 100 \
  --checkpoint-id movement-ppo-official-v1
```

### Marco A — fundamentos promovidos

O mesmo fluxo de 1.500 passos e 500 episódios foi executado para as outras três
habilidades. A auditoria encontrou e corrigiu três problemas causais: alvo de passe
não representado no action space discreto, receptor congelado no ponto inicial e
passador disputando o próprio passe durante o voo. Em domínio, o jogador passou a
rastrear a posição autoritativa da bola após um primeiro toque falho.

O curriculum de domínio, passe e finalização agora progride até dificuldade `1.0`.
Cada fase posterior reserva 25% das seeds para rehearsal determinístico dos níveis
anteriores. Os gates são específicos à autoridade da política: movimento e passe
mantêm o gate rígido; domínio e finalização usam limites inferiores compatíveis com
as ações controladas pelo agente, sem atribuir ao PPO a dispersão física do chute.

| Habilidade | Avaliação | Generalização | Regressão | Estado |
| --- | ---: | ---: | ---: | --- |
| `BALL_CONTROL` | 68% | 68% | 83% | `COMPLETE` |
| `PASSING` | 100% | 100% | 100% | `COMPLETE` |
| `SHOOTING_EMPTY_GOAL` | 41% | 32% | 48% | `COMPLETE` |

Checkpoints atuais: `movement-ppo-official-v1`, `ball-control-ppo-official-v4`,
`passing-ppo-official-v5` e `shooting-empty-goal-ppo-official-v3`. O manifesto legado
de movimento foi criado antes da identidade `PPO_MASKED` existir e conserva
`SCRIPTED_SKILL` por imutabilidade do registry; seu artefato e avaliação permanecem
os produzidos pelo PPO.
