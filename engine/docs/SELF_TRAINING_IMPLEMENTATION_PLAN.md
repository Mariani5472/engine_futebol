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

### Parcial

- [-] Marco A: catálogo e contrato estão prontos; faltam famílias fundamentais,
  resultados semânticos comuns e validação de capacidades em runtime.
- [-] Nível 2: atacante × goleiro está implementado; os demais duelos ainda não.
- [-] Nível 3: `PASS`, `TWO_V_ONE` e `THREE_V_TWO` existem, mas rewards e gates ainda
  precisam ser especializados por competência.
- [-] Níveis 7–9: infraestrutura de 5×5, 11×11, política coletiva e self-play existe;
  isso não significa que checkpoints convergidos ou a liga completa existam.

### Pendente imediato

- [ ] `MovementScenario` com término e reward de chegada/orientação.
- [ ] `BallControlScenario` com resultados causais de domínio e condução.
- [ ] `PassingScenario` fundamental parametrizável e reward reconstruível.
- [ ] `ShootingScenario` sem goleiro com alvo, timeout e resultado semântico.
- [ ] Baselines scripted e matriz held-out para essas quatro famílias.
- [ ] Inserir fundamentos antes de `PASS` em `CURRICULUM_STAGE_ORDER` somente após
  serem realmente executáveis e avaliáveis.
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

## Primeiro incremento recomendado

Não começar pelo self-play. Implementar nesta ordem:

1. registro versionado de famílias de cenário;
2. `MovementScenario`, `BallControlScenario`, `PassingScenario` e
   `ShootingScenario` sem oposição;
3. baselines scripted e relatórios held-out desses fundamentos;
4. integrar esses estágios antes de `PASS` no `CURRICULUM_STAGE_ORDER`;
5. somente então ampliar duelos e reutilizar o atacante × goleiro existente.

O primeiro milestone está concluído quando uma execução reproduzível consegue
treinar e avaliar fundamentos, gerar manifesto/checkpoint e bloquear promoção por
regressão. Ter infraestrutura de cenário não significa que a política foi treinada.
