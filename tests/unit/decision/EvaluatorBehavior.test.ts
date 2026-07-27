import { ActionExecution } from "../../../src/application/match/action/ActionExecution";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { BlockEvaluator } from "../../../src/application/match/decision/evaluators/BlockEvaluator";
import { ControlEvaluator } from "../../../src/application/match/decision/evaluators/ControlEvaluator";
import { DribbleEvaluator } from "../../../src/application/match/decision/evaluators/DribbleEvaluator";
import { InterceptEvaluator } from "../../../src/application/match/decision/evaluators/InterceptEvaluator";
import { PressEvaluator } from "../../../src/application/match/decision/evaluators/PressEvaluator";
import { TackleEvaluator } from "../../../src/application/match/decision/evaluators/TackleEvaluator";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState, buildPlayer } from "../../helpers/builders";

function contextFor(
  player: DecisionContext["player"],
  currentTick = 0,
): DecisionContext {
  return new DecisionContext(
    match,
    player,
    {} as DecisionContext["awareness"],
    currentTick,
    1,
  );
}

function preparedAction(
  player: DecisionContext["player"],
  type: DecisionType,
): void {
  const execution = ActionExecution.start(
    new Decision(type, 100),
    player,
    0,
  );

  expect(execution).toBeDefined();
  player.activeAction = execution;
}

function decisionScore(
  decisions: Decision[],
  type: DecisionType,
): number {
  return decisions.find((decision) => decision.type === type)?.utility ?? 0;
}

let match = buildMinimalMatchState();

beforeEach(() => {
  match = buildMinimalMatchState();

  const attacker = match.home.players[0];
  const defender = match.away.players[0];

  attacker.position = new Vector2(80, 34);
  attacker.targetPosition = attacker.position;
  attacker.velocity = Vector2.zero();
  attacker.facingDirection = new Vector2(1, 0);
  attacker.hasBall = true;
  attacker.activeAction = undefined;

  defender.position = new Vector2(82, 34);
  defender.targetPosition = defender.position;
  defender.velocity = Vector2.zero();
  defender.facingDirection = new Vector2(-1, 0);
  defender.hasBall = false;
  defender.activeAction = undefined;

  match.ball.owner = attacker;
  match.ball.position = attacker.position;
  match.ball.state = BallState.CONTROLLED;
});

describe("Evaluator behavior relationships", () => {
  it("increases pressing utility when the ball carrier is preparing a technical action", () => {
    const attacker = match.home.players[0];
    const defender = match.away.players[0];
    const evaluator = new PressEvaluator();

    const withoutPreparation = evaluator.evaluate(contextFor(defender));
    const baseline = decisionScore(withoutPreparation, DecisionType.PRESS);

    preparedAction(attacker, DecisionType.PASS);

    const duringPreparation = evaluator.evaluate(contextFor(defender));
    const prepared = decisionScore(duringPreparation, DecisionType.PRESS);

    expect(prepared).toBeGreaterThan(baseline);
  });

  it("increases interception utility when a pass is in its preparation window", () => {
    const attacker = match.home.players[0];
    const defender = match.away.players[0];
    const evaluator = new InterceptEvaluator();

    const withoutPreparation = evaluator.evaluate(contextFor(defender));
    const baseline = decisionScore(withoutPreparation, DecisionType.INTERCEPT);

    preparedAction(attacker, DecisionType.PASS);

    const duringPreparation = evaluator.evaluate(contextFor(defender));
    const prepared = decisionScore(duringPreparation, DecisionType.INTERCEPT);

    expect(prepared).toBeGreaterThan(baseline);
  });

  it("increases block utility when a shot or cross is being prepared", () => {
    const attacker = match.home.players[0];
    const defender = match.away.players[0];
    const evaluator = new BlockEvaluator();

    const withoutPreparation = evaluator.evaluate(contextFor(defender));
    const baseline = decisionScore(withoutPreparation, DecisionType.BLOCK);

    preparedAction(attacker, DecisionType.SHOT);

    const duringPreparation = evaluator.evaluate(contextFor(defender));
    const prepared = decisionScore(duringPreparation, DecisionType.BLOCK);

    expect(prepared).toBeGreaterThan(baseline);
  });

  it("makes hold-ball more attractive than dribbling under intense pressure", () => {
    const attacker = match.home.players[0];
    const defender = match.away.players[0];
    const evaluator = new DribbleEvaluator();

    defender.position = new Vector2(81, 34);

    const decisions = evaluator.evaluate(contextFor(attacker));
    const dribble = decisionScore(decisions, DecisionType.DRIBBLE);
    const holdBall = decisionScore(decisions, DecisionType.HOLD_BALL);

    expect(holdBall).toBeGreaterThan(dribble);
  });

  it("makes a high first-touch player more likely to control the ball", () => {
    const defender = match.away.players[0];
    const evaluator = new ControlEvaluator();

    const highFirstTouch = buildPlayer({
      attributes: undefined,
    });

    const lowFirstTouch = buildPlayer();

    highFirstTouch.attributes.technical.firstTouch = 20;
    lowFirstTouch.attributes.technical.firstTouch = 1;

    const highState = match.home.players[0];
    const lowState = match.home.players[0];

    highState.player.attributes.technical.firstTouch = 20;
    lowState.player.attributes.technical.firstTouch = 1;

    match.ball.owner = undefined;
    match.ball.state = BallState.IN_FLIGHT;
    match.ball.position = new Vector2(80.5, 34);
    match.ball.velocity = new Vector2(1, 0);

    defender.position = new Vector2(90, 34);

    const highScore = decisionScore(
      evaluator.evaluate(contextFor(highState)),
      DecisionType.CONTROL,
    );

    const lowScore = decisionScore(
      evaluator.evaluate(contextFor(lowState)),
      DecisionType.CONTROL,
    );

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("gives a prepared target a higher tackle opportunity than the same target standing idle", () => {
    const attacker = match.home.players[0];
    const defender = match.away.players[0];
    const evaluator = new TackleEvaluator();

    const idleScore = decisionScore(
      evaluator.evaluate(contextFor(defender)),
      DecisionType.TACKLE,
    );

    preparedAction(attacker, DecisionType.PASS);

    const preparedScore = decisionScore(
      evaluator.evaluate(contextFor(defender)),
      DecisionType.TACKLE,
    );

    expect(preparedScore).toBeGreaterThan(idleScore);
  });
});
