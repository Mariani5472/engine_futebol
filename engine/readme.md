📊 Progresso Atual Estimado
~55-60% concluído (bem mais avançado que os 33% do README antigo).
Concluídos / Bem Avançados:

Domínio, Geometria, Movimentação, Percepção, Cognição/Awareness, Decision Layer (core), Action Layer (parcial), Ball Physics (básica), Tactical (básico), Inicialização, Determinismo.

Principais Gaps Atuais:

Decisões ainda muito conservadoras → poucos gols.
Interação entre sistemas (decisão × tática × física × posse).
Regras completas do jogo e polish.


🗺️ Novo Roadmap Priorizado (Fases Reorganizadas)
Fase 0: Correções Críticas (1-2 semanas) — Resolver 0x0
Objetivo: Fazer o jogo produzir gols e progressão razoável consistentemente.

Ajustes urgentes na Decisão:
Aumentar utilidade de ShotEvaluator em zonas de ataque (attacking third).
Reduzir bias conservador de PassEvaluator (menos bônus para passes laterais).
Melhorar HoldBallEvaluator como verdadeiro fallback (baixa utilidade).
Finalizar PersonalityModifier e integrá-lo melhor.

Melhorar Progressão Ofensiva:
Reforçar TacticalEngine para empurrar jogadores para frente quando em posse.
Adicionar lógica simples de "support runs" e width/depth dinâmica.

Refinar ShotAction + GK:
Ajustar probabilidades de on-target/save.
Garantir que shots de longa distância sejam viáveis para certos perfis.

Limpar Duplicações:
Unificar movimento da bola (MovementSystem + BallPhysicsSystem).
Remover redundâncias em velocity/position.

Debug & Telemetria:
Adicionar logs opcionais de decisões tomadas, utilities, shots gerados vs executados.
Criar um MatchDebugSummary no resultado.


Critério de Sucesso: Média de 2.0–3.5 gols por jogo em 100 simulações com seeds variados.

Fase 1: Action Layer Completa (Alta Prioridade)

 Completar/implementar ações pendentes com outcomes realistas:
DribbleAction (progressão com risco de perda de bola).
TackleAction (melhor integração com Referee).
HeaderAction, ClearanceAction.

 Adicionar cooldowns / recuperação pós-ação.
 Integrar melhor ActionResult com eventos e mudanças de estado.


Fase 2: Ball Physics & Interações Avançadas

 Melhorar BallPhysicsSystem:
Trajetórias mais realistas (curva, swerve básico).
Colisões com jogadores (interceptions).
Bounce, wind (futuro), altura variável.

 Detecção precisa de gol via física (em vez de "fake" no ShotAction).
 Implementar launch() de forma consistente em Pass/Shot.


Fase 3: Tactical & Team Behaviour (Core do Realismo)

 Expandir TacticalEngine:
Instruções (Tempo, Counter-Attack, Pressing, Overlap/Underlap).
Dynamic shapes (defensivo → transição → ataque).
Width, Depth, Compactness, Defensive Line.

 Fortalecer TeamBehaviourSystem:
Pressing coletivo, marking, cover.
Support movement quando um jogador tem a bola.
Overloads numéricos e exploração de espaço.

 Integrar Cohesion/Familiarity de forma mais impactante.


Fase 4: Regras & Referee

 RefereeSystem completo:
Fouls, cartões, advantage, offside (simplificado), handball.
Personalidade do árbitro.

 Match Flow:
Kickoff, throw-ins, corners, goal kicks, penalties.
Stoppage time, substituições.
Estados de jogo (set pieces).



Fase 5: Event Engine & Output

 Sistema robusto de eventos (fila, prioridade, timestamps).
 Match Report completo:
Stats (xG básico, possession, passes, tackles, shots on target).
Ratings de jogadores.
Timeline serializável.



Fase 6: Polish & Contexto Avançado

 Fatores contextuais: Morale, Crowd, Weather, Big Match, Fatigue mental.
 Psychological dynamics (momentum, panic, concentration).
 Environmental effects.


Fase 7: Validação, Testes & Produção

 Testes avançados:
Monte Carlo (distribuição de resultados).
Scenario-based (ex: "striker 1v1", "counter-attack").
Regression tests contra versões anteriores.

 Replay system (snapshots periódicos).
 Performance (otimizações, parallel sims).
 Serialização completa de estado (para save/load).
 Calibração fina de atributos e weights.