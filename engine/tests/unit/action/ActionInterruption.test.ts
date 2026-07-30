import {
  ActionExecution,
  ActionExecutionPhase,
} from "../../../src/application/match/action/ActionExecution";
import { TackleAction } from "../../../src/application/match/action/actions/TackleAction";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { PlayerMatchState } from "../../../src/core/movement/PlayerMatchState";
import { Vector2 } from "../../../src/core/geometry/Vector2";

function createPlayer(id: string, attributes: number): PlayerMatchState {
  const player = {
    id,
    attributes: {
      mental: {
        aggression: attributes,
        decisions: attributes,
        composure: attributes,
        concentration: attributes,
        anticipation: attributes,
        workRate: attributes,
      },
      physical: {
        agility: attributes,
        balance: attributes,
        stamina: attributes,
        strength: attributes,
        acceleration: attributes,
        naturalFitness: attributes,
      },
      technical: {
        passing: attributes,
        technique: attributes,
        firstTouch: attributes,
        crossing: attributes,
        finishing: attributes,
        dribbling: attributes,
        tackling: attributes,
        heading: attributes,
        kicking: attributes,
      },
      goalkeeping: {
        aerialReach: attributes,
        handling: attributes,
        rushingOut: attributes,
        throwing: attributes,
      },
    },
  };

  return new PlayerMatchState(
    player as never,
    new Vector2(0, 0),
    new Vector2(0, 0),
    100,
    0,
    false,
    "MIDFIELDER" as never,
    new Vector2(0, 0),
    new Vector2(1, 0),
    0,
    0,
    "STANDING",
    0,
    100,
    100,
  );
}

describe("Action interruption — concurrent action and physical state", () => {
  it("interrupts a player's active pass when a successful tackle occurs", () => {
    const tackler = createPlayer("tackler", 18);
    const ballOwner = createPlayer("ball-owner", 5);
    ballOwner.hasBall = true;

    const passExecution = ActionExecution.start(
      new Decision(DecisionType.PASS, 1),
      ballOwner,
      0,
    );

    expect(passExecution).toBeDefined();
    ballOwner.activeAction = passExecution;

    const match = {
      ball: {
        owner: ballOwner,
        state: "CONTROLLED",
        position: ballOwner.position,
        acquirePossession(player: PlayerMatchState) {
          this.owner = player;
        },
      },
      home: { players: [tackler] },
      away: { players: [ballOwner] },
    };

    const referee = {
      isPlayerSentOff: jest.fn().mockReturnValue(false),
      evaluateTackle: jest.fn().mockReturnValue({
        isFoul: false,
        events: [],
      }),
    };

    const tackleAction = new TackleAction(referee as never);

    const result = tackleAction.execute({
      player: tackler,
      decision: new Decision(DecisionType.TACKLE, 1),
      match: match as never,
      pitch: {} as never,
      random: {
        nextFloat: jest.fn().mockReturnValue(0),
      },
      tick: 1,
      deltaTime: 0.1,
      teamSide: "HOME",
      attackingDirection: 1,
      matchSecond: 0.20,
    });

    expect(result.success).toBe(true);
    expect(match.ball.owner).toBe(tackler);
    expect(tackler.hasBall).toBe(true);
    expect(ballOwner.hasBall).toBe(false);

    expect(ballOwner.activeAction).toBe(passExecution);
    expect(passExecution?.phase).toBe(ActionExecutionPhase.RECOVERING);
    expect(passExecution?.interruptionReason).toBe("TACKLE");
    expect(ballOwner.bodyState).toBe("FALLING");
    expect(passExecution?.isBusy()).toBe(true);
  });

  it("does not interrupt an action when the tackle is unsuccessful", () => {
    const tackler = createPlayer("tackler", 5);
    const ballOwner = createPlayer("ball-owner", 20);
    ballOwner.hasBall = true;

    const passExecution = ActionExecution.start(
      new Decision(DecisionType.PASS, 1),
      ballOwner,
      0,
    );

    ballOwner.activeAction = passExecution;

    const match = {
      ball: {
        owner: ballOwner,
        state: "CONTROLLED",
        position: ballOwner.position,
      },
      home: { players: [tackler] },
      away: { players: [ballOwner] },
    };

    const referee = {
      isPlayerSentOff: jest.fn().mockReturnValue(false),
      evaluateTackle: jest.fn().mockReturnValue({
        isFoul: false,
        events: [],
      }),
    };

    const tackleAction = new TackleAction(referee as never);

    const result = tackleAction.execute({
      player: tackler,
      decision: new Decision(DecisionType.TACKLE, 1),
      match: match as never,
      pitch: {} as never,
      random: {
        nextFloat: jest.fn().mockReturnValue(0.99),
      },
      tick: 1,
      deltaTime: 0.1,
      teamSide: "HOME",
      attackingDirection: 1,
      matchSecond: 0.20,
    });

    expect(result.success).toBe(false);
    expect(match.ball.owner).toBe(ballOwner);
    expect(ballOwner.activeAction).toBe(passExecution);
    expect(passExecution?.interruptionReason).toBeUndefined();
    expect(passExecution?.phase).toBe(ActionExecutionPhase.PREPARING);
  });
});
