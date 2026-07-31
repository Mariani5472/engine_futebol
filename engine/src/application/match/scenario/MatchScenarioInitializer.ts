import { Vector2 } from "../../../core/geometry/Vector2";
import { BallPlacement } from "../../../core/movement/BallPlacement";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import type { MatchScenarioConfig } from "./MatchScenario";

export class MatchScenarioInitializer {
  public apply(state: MatchState, scenario: MatchScenarioConfig): void {
    if (scenario.kind === "ATTACKER_VS_GOALKEEPER") this.applyAttackerVsGoalkeeper(state, scenario);
    else if (scenario.kind === "CURRICULUM") this.applyCurriculum(state, scenario);
    else if (scenario.kind === "FUNDAMENTAL") this.applyFundamental(state, scenario);
  }

  private applyFundamental(
    state: MatchState,
    scenario: Extract<MatchScenarioConfig, { kind: "FUNDAMENTAL" }>,
  ): void {
    const player = this.player(state, scenario.playerId);
    const receiver = scenario.receiverId ? this.player(state, scenario.receiverId) : null;
    const team = this.teamOf(state, player);
    if (receiver && this.teamOf(state, receiver) !== team) throw new Error("Fundamental receiver must be a teammate");
    if (scenario.skill === "PASSING" && !receiver) throw new Error("PASSING requires receiverId");
    if (scenario.skill === "MOVEMENT" && !scenario.targetPosition) throw new Error("MOVEMENT requires targetPosition");

    const playerPosition = new Vector2(scenario.playerPosition.x, scenario.playerPosition.y);
    const target = scenario.targetPosition ? new Vector2(scenario.targetPosition.x, scenario.targetPosition.y) : null;
    const ballPosition = scenario.ballPosition
      ? new Vector2(scenario.ballPosition.x, scenario.ballPosition.y)
      : playerPosition;
    this.assertOnPitch(playerPosition, state, "playerPosition");
    this.assertOnPitch(ballPosition, state, "ballPosition");
    if (target) this.assertOnPitch(target, state, "targetPosition");

    const all = [...state.home.players, ...state.away.players];
    for (const candidate of all) {
      candidate.hasBall = false;
      candidate.scenarioMovementFrozen = false;
      candidate.scenarioDecisionDisabled = false;
      candidate.scenarioTargetPosition = null;
      candidate.activeAction = undefined;
      candidate.activePipeline = undefined;
      candidate.activeCarry = null;
      candidate.intent = null;
      candidate.nextDecisionAt = 0;
      candidate.actionLockUntil = 0;
      candidate.recoveryUntil = 0;
    }
    this.place(player, playerPosition, target?.subtract(playerPosition).normalize() ?? new Vector2(team.attackingDirection, 0));
    if (target) {
      player.targetPosition = target;
      player.tacticalAnchorPosition = target;
      player.scenarioTargetPosition = target;
    }
    if (receiver) {
      const point = scenario.receiverPosition
        ? new Vector2(scenario.receiverPosition.x, scenario.receiverPosition.y)
        : playerPosition.add(new Vector2(team.attackingDirection * 10, 0));
      this.assertOnPitch(point, state, "receiverPosition");
      this.place(receiver, point, new Vector2(team.attackingDirection, 0));
      receiver.scenarioMovementFrozen = true;
      receiver.scenarioDecisionDisabled = true;
    }

    const selected = new Set([player, ...(receiver ? [receiver] : [])]);
    if (scenario.isolateOtherPlayers ?? true) {
      all.filter(candidate => !selected.has(candidate)).forEach((candidate, index) => {
        this.place(candidate, new Vector2(5 + Math.floor(index / 2) * 7, index % 2 === 0 ? .5 : state.pitch.width - .5), new Vector2(team.attackingDirection, 0));
        candidate.scenarioMovementFrozen = true;
        candidate.scenarioDecisionDisabled = true;
      });
    }

    if (scenario.skill === "MOVEMENT" || scenario.skill === "BALL_CONTROL") {
      BallPlacement.freeForScenario(state.ball, ballPosition);
      if (scenario.skill === "BALL_CONTROL") player.scenarioTargetPosition = ballPosition;
    } else {
      BallPlacement.forScenario(state.ball, player, playerPosition);
    }
    state.kickoff = null;
    state.restart = null;
    state.pendingGoalRestart = null;
    state.attackingTeam = team;
    state.defendingTeam = team === state.home ? state.away : state.home;
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
      player.scenarioTargetPosition = null;
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
    BallPlacement.forScenario(state.ball, carrier, carrier.position);
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
      player.scenarioTargetPosition = null;
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

    BallPlacement.forScenario(state.ball, attacker, attackerPosition);
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
