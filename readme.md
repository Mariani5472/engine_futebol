Markdown
# ⚽ Match Engine — Project Roadmap
Uma engine de simulação tática e comportamental de futebol focada em sistemas distribuídos de inteligência, física de campo e tomada de decisão determinística.
---
## 📊 Progresso Geral
[██████████░░░░░░░░░░░░░░░░░░] 33% Concluído (Fases 1–5 parcialmente implementadas)
- **Módulos Concluídos:** Domínio, Geometria, Movimentação, Percepção/Cognição.
- **Em Desenvolvimento:** Camada de Decisão (Decision Layer).
- **Próximos Passos:** Camada de Ação e Física da Bola.
---
## 🗺️ Roadmap de Desenvolvimento
<details open>
<summary><b>✅ Fase 1: Domínio Básicos & Atributos</b> (Concluído)</summary>
- [x] Player & Team Core Structures
- [x] Tactical Formation & Position Roles
- [x] Player Attributes (Mental, Physical, Goalkeeper, Hidden)
- [x] Languages & Player Relationships
- [x] Team Cohesion & Tactical Familiarity
- [x] Language Compatibility
</details>
<details open>
<summary><b>✅ Fase 2: Geometria & Pitch Layout</b> (Concluído)</summary>
- [x] Vector2, Distance & Angle Math
- [x] Line Intersection & Line of Sight
- [x] Ball Trajectory Fundamentals
- [x] Pitch, Rectangle & PitchZone Boundaries
- [x] PitchGrid System (Grid A1–E3)
- [x] Zone Neighbour Detection & Zones Between
</details>
<details open>
<summary><b>✅ Fase 3: Movimentação & Posse</b> (Concluído)</summary>
- [x] Player & Ball Movement Vectorization
- [x] Velocity & Target Position Systems
- [x] Player Speed & Fatigue Modifier Calculations
- [x] Facing Direction & Reach Calculation
- [x] Possession Candidates & Control Scoring
- [x] Possession Duel Resolution
</details>
<details open>
<summary><b>✅ Fase 4: Percepção & Cognição (AI)</b> (Concluído)</summary>
#### 4.1 Perception
- [x] Distance, Angle & Line of Sight Evaluation
- [x] Position Zone & Visibility Mapping
#### 4.2 Awareness & Cognitive Model
- [x] Short-Term Memory, Certainty & Memory Decay
- [x] Last Seen Tick & Estimated Position/Velocity
- [x] Spatial & Angular Error (Noise Model)
- [x] Prediction Model (Ball/Player Extrapolation & Anticipation)
- [x] Memory Decay Model (Exponential Decay, Vision & Concentration Influence)
- [x] Cognitive System Pipeline Integration
</details>
<details open>
<summary><b>🧠 Fase 5: Decision Layer (Em Progresso)</b></summary>
- [x] **5.1 Decision Context:** `DecisionContext`, Player Awareness & Cognitive Pipeline
- [x] **5.2 Utility Score:** `UtilityContext`, `UtilityScore`, Base/Tactical/Personality Utilities
- [x] **5.3 Action Evaluation:** `PassEvaluator`, `ShotEvaluator` & Candidate Generation
- [x] **5.4 Decision Selection:** Best Candidate & Utility Comparison
- [x] **5.5 Risk Evaluation:** Risk Calculator, Failure Probabilities, Tactical & Match Risk
- [ ] **5.6 Personality Influence:** Modifiers, Decision Bias & Personality-Based Risk
</details>
<details>
<summary><b>⚙️ Fase 6: Action Layer</b> (Pendente)</summary>
- [ ] `ActionFactory`
- [ ] Actions Core: `PassAction`, `ShotAction`, `DribbleAction`, `TackleAction`, `HeaderAction`, `ClearanceAction`
</details>
<details>
<summary><b>⚽ Fase 7: Ball Physics</b> (Pendente)</summary>
- [ ] `BallPhysicsSystem`
- [ ] Physics Properties: Acceleration, Deceleration, Velocity, Direction & Height
- [ ] Flight Dynamics, Bounce Resolution, Surface Friction & Trajectory Resolution
</details>
<details>
<summary><b>🧠 Fase 8: Tactical Engine</b> (Pendente)</summary>
- [ ] Tactical Systems: Width, Depth, Compactness, Defensive Line & Pressing
- [ ] Instructions: Tempo, Counter Attack, Overlap & Underlap
- [ ] Dynamic Team Shapes: Defensive, Attacking & Transition Shapes
</details>
<details>
<summary><b>👥 Fase 9: Team Behaviour</b> (Pendente)</summary>
- [ ] Collective Dynamics: Team Shape, Player Spacing & Role Coordination
- [ ] Defensive Coordination: Line Movement, Pressing, Cover & Marking
- [ ] Attacking Support: Passing Options & Collective Movement
- [ ] Team Cohesion Influence
</details>
<details>
<summary><b>🧑‍⚖️ Fase 10: Referee System</b> (Pendente)</summary>
- [ ] Foul Detection & Severity Assessment
- [ ] Card Systems: Yellow, Second Yellow, Direct Red, Last Defender & Violent Conduct
- [ ] Advantages, Offside, Handball & Simulation
- [ ] Referee Personality Profiles
</details>
<details>
<summary><b>🔄 Fase 11: Match Flow & Rules</b> (Pendente)</summary>
- [ ] Match States: Kickoff, Periods (1st/2nd Half, Extra Time), Stoppage Time
- [ ] Restarts: Throw-In, Goal Kick, Corner, Free Kick, Penalty
- [ ] Substitution Management
</details>
<details>
<summary><b>📡 Fase 12: Event Engine</b> (Pendente)</summary>
- [ ] Core Engine: Queue, Dispatcher, Priority Ordering & Timestamps
- [ ] Event Types: Goal, Shot, Card, Period Boundaries
- [ ] Event Serialization & Frontend Event Stream Pipeline
</details>
<details>
<summary><b>📊 Fase 13: Match Report & Analytics</b> (Pendente)</summary>
- [ ] Stats Tracking: Goals, xG, Shots/Target, Possession, Passes & Tackles
- [ ] Player Performance Ratings & Match Timeline Generation
</details>
<details>
<summary><b>🎮 Fase 14: Simulation Polish & Context</b> (Pendente)</summary>
- [ ] Environmental Effects: Weather, Rain & Pitch Condition
- [ ] Mental & Contextual Drivers: Crowd, Morale, Pressure, Big Match Performance, Leadership
</details>
<details>
<summary><b>🧪 Fase 15: Engine Validation & Replayability</b> (Pendente)</summary>
- [ ] Deterministic Simulation & Seeded Random
- [ ] Replay System: Snapshots, Timelines & Event Replays
- [ ] Testing Frameworks: Scenario, Monte Carlo & Regression Testing
</details>
<details>
<summary><b>🔧 Fase 16: Pre-Release Refinement</b> (Pendente)</summary>
- [ ] **Decision Tuning:** Action Priority Systems, Cooldowns, Weights & State Influences
- [ ] **Attribute Calibration:** Normalization, Interactions, Probabilities & Diminishing Returns
- [ ] **Spatial & Collision Accuracy:** Occupancy, Volume Collisions, Interception Zones
- [ ] **Advanced Tactical Validation:** Overloads, Numerical Superiority/Inferiority, Space Exploitation
- [ ] **Psychological & Emotional Dynamics:** Panic, Momentum, Aggression & Concentration Drops
- [ ] **Production Tooling:** Full State Serialization, Simulation Logs & Regression Suites
</details>
---
## 🛠 Tech Stack & Paradigmas
- **Paradigma:** Event-Driven Architecture, Deterministic Simulation.
- **Estruturas de Dados:** Vector Spatial Trees, Grids de Ocupação Espacial.
- **Modelos Matemáticos:** Utility-based AI, Decaimento Exponencial de Memória, Extrapolação Vetorial.
