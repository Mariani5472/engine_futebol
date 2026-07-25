import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { ActionContext } from "./ActionContext";
import { ActionResult } from "./ActionResult";
import { ClearanceAction } from "./actions/ClearanceAction";
import { DribbleAction } from "./actions/DribbleAction";
import { HeaderAction } from "./actions/HeaderAction";
import { HoldBallAction } from "./actions/HoldBallAction";
import { PassAction } from "./actions/PassAction";
import { ShotAction } from "./actions/ShotAction";
import { TackleAction } from "./actions/TackleAction";
import { RefereeSystem } from "../referee/RefereeSystem";

/**
 * Routes a Decision to its corresponding action implementation
 * and executes it within the given context.
 */
export class ActionFactory {
  private readonly pass = new PassAction();
  private readonly shot = new ShotAction();
  private readonly dribble = new DribbleAction();
  private readonly header = new HeaderAction();
  private readonly clearance = new ClearanceAction();
  private readonly holdBall = new HoldBallAction();
  private readonly tackle: TackleAction;

  constructor(referee: RefereeSystem) {
    this.tackle = new TackleAction(referee);
  }

  public execute(
    decision: Decision,
    context: ActionContext
  ): ActionResult {
    switch (decision.type) {
      case DecisionType.PASS:
      case DecisionType.CROSS:
      case DecisionType.GK_DISTRIBUTE:
        return this.pass.execute(context);

      case DecisionType.SHOT:
        return this.shot.execute(context);

      case DecisionType.DRIBBLE:
      case DecisionType.SKILL_MOVE:
      case DecisionType.FAKE:
        return this.dribble.execute(context);

      case DecisionType.HEADER:
        return this.header.execute(context);

      case DecisionType.TACKLE:
      case DecisionType.INTERCEPT:
      case DecisionType.BLOCK:
      case DecisionType.TACTICAL_FOUL:
        return this.tackle.execute(context);

      case DecisionType.CLEAR:
      case DecisionType.GK_CLAIM:
        return this.clearance.execute(context);

      case DecisionType.HOLD_BALL:
      case DecisionType.CONTROL:
      case DecisionType.RECEIVE:
      case DecisionType.SET_PIECE:
        return this.holdBall.execute(context);

      // Off-ball / positional decisions and other non-discrete actions:
      // they update positioning elsewhere and do not resolve as a direct action here.
      case DecisionType.PRESS:
      case DecisionType.MARK:
      case DecisionType.COVER:
      case DecisionType.MOVE:
      case DecisionType.POSITION:
      case DecisionType.NONE:
        return {
          actorId: context.player.player.id,
          type: decision.type,
          success: true,
          events: []
        };

      default:
        return {
          actorId: context.player.player.id,
          type: DecisionType.NONE,
          success: false,
          events: []
        };
    }
  }
}
