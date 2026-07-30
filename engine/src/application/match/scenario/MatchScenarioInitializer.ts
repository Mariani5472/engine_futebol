import { Vector2 } from "../../../core/geometry/Vector2";
import { BallState } from "../../../core/movement/BallMatchState";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import type { MatchScenarioConfig } from "./MatchScenario";

export class MatchScenarioInitializer {
  public apply(state: MatchState, scenario: MatchScenarioConfig): void {
    if (scenario.kind === "ATTACKER_VS_GOALKEEPER") this.applyAttackerVsGoalkeeper(state, scenario);
    else if (scenario.kind === "CURRICULUM") this.applyCurriculum(state, scenario);
  }

  private applyCurriculum(
    state: MatchState,
    scenario: Extract<MatchScenarioConfig, { kind: "CURRICULUM" }>,
  ): void {
    const attackers = scenario.attackingPlayerIds.map(id => this.player(state, id));
    const defenders = scenario.defendingPlayerIds.map(id => this.player(state, id));
    const carrier = this.player(state, scenario.primaryBallCarrierId);
    if (!attackers.includes(carrier)) throw new Error("primaryBallCarrierId must belong to attackingPlayerIds");
    if (new Set([...scenario.attackingPlayerIds, ...scenario.defendingPlayerIds]).size
      !== scenario.attackingPlayerIds.length + scenario.defendingPlayerIds.length) {
      throw new Error("Curriculum attacking and defending player IDs must be unique");
    }
    const attackingTeam = this.teamOf(state, carrier);
    if (attackers.some(player => this.teamOf(state, player) !== attackingTeam)) throw new Error("All curriculum attackers must belong to one team");
    const defendingTeam = attackingTeam === state.home ? state.away : state.home;
    if (defenders.some(player => this.teamOf(state, player) !== defendingTeam)) throw new Error("All curriculum defenders must belong to the opposing team");
    const attackingGoalkeeper = scenario.attackingGoalkeeperId ? this.player(state, scenario.attackingGoalkeeperId) : null;
    const defendingGoalkeeper = scenario.defendingGoalkeeperId ? this.player(state, scenario.defendingGoalkeeperId) : null;
    if (attackingGoalkeeper && (!attackingGoalkeeper.currentRole.includes("GOALKEEPER") || this.teamOf(state, attackingGoalkeeper) !== attackingTeam)) {
      throw new Error("attackingGoalkeeperId must identify the attacking team's goalkeeper");
    }
    if (defendingGoalkeeper && (!defendingGoalkeeper.currentRole.includes("GOALKEEPER") || this.teamOf(state, defendingGoalkeeper) !== defendingTeam)) {
      throw new Error("defendingGoalkeeperId must identify the defending team's goalkeeper");
    }
    if (scenario.goalkeeperMode !== "NONE" && !defendingGoalkeeper) throw new Error(`${scenario.goalkeeperMode} requires defendingGoalkeeperId`);

    const selected = new Set([...
      attackers, ...defenders,
      ...(attackingGoalkeeper ? [attackingGoalkeeper] : []),
      ...(defendingGoalkeeper ? [defendingGoalkeeper] : []),
    ]);
    const all = [...state.home.players, ...state.away.players];
    for (const player of all) {
      player.hasBall = false;
      player.scenarioMovementFrozen = false;
      player.scenarioDecisionDisabled = false;
      player.activeAction = undefined;
      player.activePipeline = undefined;
      player.activeCarry = null;
      player.intent = null;
      player.nextDecisionAt = 0;
      player.actionLockUntil = 0;
      player.recoveryUntil = 0;
    }

    const preserveFullShape = scenario.isolateOtherPlayers === false;
    if (!preserveFullShape) {
      const direction = attackingTeam.attackingDirection;
      const goalX = direction === 1 ? state.pitch.length : 0;
      const centreY = state.pitch.width / 2;
      attackers.forEach((player, index) => {
        const isCarrier = player === carrier;
        const row = isCarrier ? 34 : 24 - Math.min(index, 3) * 3;
        const lateral = attackers.length === 1 ? 0 : (index - (attackers.length - 1) / 2) * Math.min(10, 34 / attackers.length);
        this.place(player, new Vector2(goalX - direction * row, centreY + lateral), new Vector2(direction, 0));
      });
      defenders.forEach((player, index) => {
        const lateral = defenders.length === 1 ? 0 : (index - (defenders.length - 1) / 2) * Math.min(9, 30 / defenders.length);
        this.place(player, new Vector2(goalX - direction * (15 + (index % 2) * 4), centreY + lateral), new Vector2(-direction, 0));
      });
      if (defendingGoalkeeper) this.place(defendingGoalkeeper, new Vector2(goalX - direction, centreY), new Vector2(-direction, 0));
      if (attackingGoalkeeper) this.place(attackingGoalkeeper, new Vector2(direction === 1 ? 1 : state.pitch.length - 1, centreY), new Vector2(direction, 0));
      const isolated = all.filter(player => !selected.has(player));
      isolated.forEach((player, index) => {
        const position = new Vector2(5 + Math.floor(index / 2) * 7, index % 2 === 0 ? .5 : state.pitch.width - .5);
        this.place(player, position, new Vector2(direction, 0));
        player.scenarioMovementFrozen = true;
        player.scenarioDecisionDisabled = true;
      });
    }

    if (defendingGoalkeeper && scenario.goalkeeperMode === "FROZEN") {
      defendingGoalkeeper.scenarioMovementFrozen = true;
      defendingGoalkeeper.scenarioDecisionDisabled = true;
    }
    carrier.hasBall = true;
    state.ball.position = carrier.position;
    state.ball.previousPosition = carrier.position;
    state.ball.visualPosition = carrier.position;
    state.ball.velocity = Vector2.zero();
    state.ball.visualVelocity = Vector2.zero();
    state.ball.height = 0;
    state.ball.visualHeight = 0;
    state.ball.owner = carrier;
    state.ball.state = BallState.CONTROLLED;
    state.ball.motion = null;
    state.ball.activeShot = null;
    state.ball.intendedReceiverId = null;
    state.ball.pendingPass = null;
    state.ball.restrictedTouchPlayerId = null;
    state.ball.lastCompletedPass = null;
    state.ball.lastTouchedPlayerId = carrier.player.id;
    state.ball.controlOffset = Vector2.zero();
    state.kickoff = null;
    state.restart = null;
    state.pendingGoalRestart = null;
    state.attackingTeam = attackingTeam;
    state.defendingTeam = defendingTeam;
  }

  private applyAttackerVsGoalkeeper(
    state: MatchState,
    scenario: Extract<MatchScenarioConfig, { kind: "ATTACKER_VS_GOALKEEPER" }>,
  ): void {
    const attacker = this.player(state, scenario.attackerId);
    const goalkeeper = this.player(state, scenario.goalkeeperId);
    const attackingTeam = this.teamOf(state, attacker);
    const defendingTeam = this.teamOf(state, goalkeeper);
    if (attackingTeam === defendingTeam) throw new Error("Attacker and goalkeeper must belong to opposing teams");
    if (!goalkeeper.currentRole.includes("GOALKEEPER")) throw new Error(`${scenario.goalkeeperId} is not a goalkeeper`);

    const direction = attackingTeam.attackingDirection;
    const goalX = direction === 1 ? state.pitch.length : 0;
    const centreY = state.pitch.width / 2;
    const attackerDistance = scenario.attackerDistanceFromGoal ?? 18;
    const goalkeeperDepth = scenario.goalkeeperDepthFromGoalLine ?? 1;
    this.assertRange(attackerDistance, 1, state.pitch.length - 1, "attackerDistanceFromGoal");
    this.assertRange(goalkeeperDepth, 0, 8, "goalkeeperDepthFromGoalLine");

    const attackerPosition = scenario.attackerPosition
      ? new Vector2(scenario.attackerPosition.x, scenario.attackerPosition.y)
      : new Vector2(goalX - direction * attackerDistance, centreY + (scenario.attackerLateralOffset ?? 0));
    const goalkeeperPosition = scenario.goalkeeperPosition
      ? new Vector2(scenario.goalkeeperPosition.x, scenario.goalkeeperPosition.y)
      : new Vector2(goalX - direction * goalkeeperDepth, centreY + (scenario.goalkeeperLateralOffset ?? 0));
    this.assertOnPitch(attackerPosition, state, "attackerPosition");
    this.assertOnPitch(goalkeeperPosition, state, "goalkeeperPosition");

    for (const player of [...state.home.players, ...state.away.players]) {
      player.hasBall = false;
      player.scenarioMovementFrozen = false;
      player.scenarioDecisionDisabled = false;
      player.activeAction = undefined;
      player.activePipeline = undefined;
      player.activeCarry = null;
      player.intent = null;
      player.nextDecisionAt = 0;
      player.actionLockUntil = 0;
      player.recoveryUntil = 0;
    }
    this.place(attacker, attackerPosition, new Vector2(direction, 0));
    this.place(goalkeeper, goalkeeperPosition, new Vector2(-direction, 0));
    goalkeeper.scenarioMovementFrozen = scenario.freezeGoalkeeper ?? true;
    goalkeeper.scenarioDecisionDisabled = true;

    if (scenario.isolateOtherPlayers ?? true) {
      const others = [...state.home.players, ...state.away.players]
        .filter(player => player !== attacker && player !== goalkeeper);
      others.forEach((player, index) => {
        const upper = index % 2 === 0;
        const row = Math.floor(index / 2);
        const position = new Vector2(8 + row * 8.5, upper ? .5 : state.pitch.width - .5);
        this.place(player, position, new Vector2(direction, 0));
        player.scenarioMovementFrozen = true;
        player.scenarioDecisionDisabled = true;
      });
    }

    attacker.hasBall = true;
    state.ball.position = attackerPosition;
    state.ball.previousPosition = attackerPosition;
    state.ball.visualPosition = attackerPosition;
    state.ball.velocity = Vector2.zero();
    state.ball.visualVelocity = Vector2.zero();
    state.ball.height = 0;
    state.ball.visualHeight = 0;
    state.ball.owner = attacker;
    state.ball.state = BallState.CONTROLLED;
    state.ball.motion = null;
    state.ball.activeShot = null;
    state.ball.intendedReceiverId = null;
    state.ball.pendingPass = null;
    state.ball.restrictedTouchPlayerId = null;
    state.ball.lastCompletedPass = null;
    state.ball.lastTouchedPlayerId = attacker.player.id;
    state.ball.controlOffset = Vector2.zero();
    state.kickoff = null;
    state.restart = null;
    state.pendingGoalRestart = null;
    state.attackingTeam = attackingTeam;
    state.defendingTeam = defendingTeam;
  }

  private place(player: PlayerMatchState, position: Vector2, facing: Vector2): void {
    player.position = position;
    player.targetPosition = position;
    player.tacticalAnchorPosition = position;
    player.runCorridorOrigin = position;
    player.velocity = Vector2.zero();
    player.facingDirection = facing;
    player.bodyOrientation = facing.angle();
  }

  private player(state: MatchState, id: string): PlayerMatchState {
    const player = [...state.home.players, ...state.away.players].find(candidate => candidate.player.id === id);
    if (!player) throw new Error(`Unknown scenario player: ${id}`);
    return player;
  }

  private teamOf(state: MatchState, player: PlayerMatchState): TeamMatchState {
    return state.home.players.includes(player) ? state.home : state.away;
  }

  private assertOnPitch(position: Vector2, state: MatchState, name: string): void {
    if (position.x < 0 || position.x > state.pitch.length || position.y < 0 || position.y > state.pitch.width) {
      throw new Error(`${name} must be inside the pitch`);
    }
  }

  private assertRange(value: number, minimum: number, maximum: number, name: string): void {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`${name} must be between ${minimum} and ${maximum}`);
    }
  }
}
