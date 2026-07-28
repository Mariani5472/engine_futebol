import { Vector2 } from "../../../../core/geometry/Vector2";
import type { PlayerRole } from "../../../../domain";
import { DecisionType } from "../../decision/DecisionType";
import type { DecisionContext } from "../../decision/DecisionContext";
import type { RoleBehaviour, RoleBehaviourResolver, RoleTargetContext } from "./RoleBehaviour";

type TargetResolver = (context: RoleTargetContext) => Vector2;
type UtilityResolver = (decision: DecisionType, context: DecisionContext) => number;

class SpatialRoleBehaviour implements RoleBehaviour {
  public constructor(
    private readonly inPossession: TargetResolver = base,
    private readonly outOfPossession: TargetResolver = base,
    private readonly transition: TargetResolver = base,
    private readonly utility: UtilityResolver = () => 0,
  ) {}

  public resolveInPossessionTarget(context: RoleTargetContext): Vector2 { return bounded(context, this.inPossession(context)); }
  public resolveOutOfPossessionTarget(context: RoleTargetContext): Vector2 { return bounded(context, this.outOfPossession(context)); }
  public resolveTransitionTarget(context: RoleTargetContext): Vector2 { return bounded(context, this.transition(context)); }
  public modifyDecisionUtility(decision: DecisionType, context: DecisionContext): number { return this.utility(decision, context); }
}

const base: TargetResolver = context => context.baseTarget;
const centre = (context: RoleTargetContext) => context.match.pitch.width / 2;
const attackingBallX = (context: RoleTargetContext) => context.team.attackingDirection === 1
  ? context.match.ball.position.x
  : context.match.pitch.length - context.match.ball.position.x;
const halfSpaceY = (context: RoleTargetContext) => context.baseTarget.y < centre(context)
  ? centre(context) - 10
  : centre(context) + 10;
const withTarget = (context: RoleTargetContext, x: number, y: number) => new Vector2(x, y);
const bounded = (context: RoleTargetContext, target: Vector2) => new Vector2(
  Math.max(1, Math.min(context.match.pitch.length - 1, target.x)),
  Math.max(2, Math.min(context.match.pitch.width - 2, target.y)),
);

const supportKeeper: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, Math.min(22, attackingBallX(context) - 34)), centre(context));
const sweepingKeeper: TargetResolver = context => withTarget(context, Math.max(10, Math.min(27, attackingBallX(context) - 28)), centre(context));
const ballPlayingCentreBack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) - 22), context.baseTarget.y);
const wideCentreBack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) - 25), centre(context) + (context.baseTarget.y < centre(context) ? -17 : 17));
const fullBackAttack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) + 5), context.baseTarget.y < centre(context) ? 6 : context.match.pitch.width - 6);
const fullBackDefend: TargetResolver = context => withTarget(context, context.baseTarget.x, context.baseTarget.y < centre(context) ? 10 : context.match.pitch.width - 10);
const invertedFullBack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) - 8), centre(context) + (context.baseTarget.y < centre(context) ? -7 : 7));
const boxToBoxAttack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, Math.min(84, attackingBallX(context) + 10)), centre(context) + (context.baseTarget.y - centre(context)) * .45);
const boxToBoxDefend: TargetResolver = context => withTarget(context, Math.min(context.baseTarget.x, Math.max(30, attackingBallX(context) - 12)), context.baseTarget.y);
const insideForwardAttack: TargetResolver = context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) + 13), halfSpaceY(context));
const falseNineAttack: TargetResolver = context => withTarget(context, Math.min(context.baseTarget.x - 10, attackingBallX(context) + 2), centre(context));
const falseNineDefend: TargetResolver = context => withTarget(context, Math.min(context.baseTarget.x, 61), centre(context));

const forwardUtility: UtilityResolver = decision =>
  decision === DecisionType.DRIBBLE ? 4 : decision === DecisionType.PASS ? 2 : 0;
const falseNineUtility: UtilityResolver = decision =>
  decision === DecisionType.PASS || decision === DecisionType.HOLD_BALL ? 5 : decision === DecisionType.SHOT ? -4 : 0;
const ballPlayingUtility: UtilityResolver = decision =>
  decision === DecisionType.PASS ? 4 : decision === DecisionType.CLEAR ? -3 : 0;
const directKeeperUtility: UtilityResolver = decision => decision === DecisionType.GK_DISTRIBUTE ? 5 : 0;

export class RoleBehaviourRegistry implements RoleBehaviourResolver {
  private readonly fallback = new SpatialRoleBehaviour();
  private readonly behaviours: Partial<Record<PlayerRole, RoleBehaviour>> = {
    GOALKEEPER: new SpatialRoleBehaviour(),
    BALL_PLAYING_GOALKEEPER: new SpatialRoleBehaviour(supportKeeper, base, supportKeeper, ballPlayingUtility),
    DIRECT_GOALKEEPER: new SpatialRoleBehaviour(base, base, base, directKeeperUtility),
    SWEEPER_KEEPER: new SpatialRoleBehaviour(sweepingKeeper, sweepingKeeper, sweepingKeeper, ballPlayingUtility),
    CENTRE_BACK: new SpatialRoleBehaviour(),
    BALL_PLAYING_CENTRE_BACK: new SpatialRoleBehaviour(ballPlayingCentreBack, base, ballPlayingCentreBack, ballPlayingUtility),
    WIDE_CENTRE_BACK: new SpatialRoleBehaviour(wideCentreBack, wideCentreBack, wideCentreBack),
    ADVANCED_CENTRE_BACK: new SpatialRoleBehaviour(context => withTarget(context, context.baseTarget.x + 10, context.baseTarget.y), base, ballPlayingCentreBack, ballPlayingUtility),
    OVERLAPPING_CENTRE_BACK: new SpatialRoleBehaviour(context => withTarget(context, Math.max(context.baseTarget.x + 18, attackingBallX(context) - 4), halfSpaceY(context)), wideCentreBack, wideCentreBack),
    // The generic full-back keeps the calibrated formation map; specialised
    // inverted/wing-back duties opt into more aggressive spatial behaviour.
    FULL_BACK: new SpatialRoleBehaviour(),
    INVERTED_FULL_BACK: new SpatialRoleBehaviour(invertedFullBack, fullBackDefend, invertedFullBack, ballPlayingUtility),
    WING_BACK: new SpatialRoleBehaviour(context => withTarget(context, Math.max(context.baseTarget.x, attackingBallX(context) + 9), context.baseTarget.y < centre(context) ? 5 : context.match.pitch.width - 5), fullBackDefend, fullBackAttack),
    BOX_TO_BOX_MIDFIELDER: new SpatialRoleBehaviour(boxToBoxAttack, boxToBoxDefend, context => withTarget(context, attackingBallX(context), context.baseTarget.y)),
    INSIDE_FORWARD: new SpatialRoleBehaviour(insideForwardAttack, context => withTarget(context, context.baseTarget.x - 6, halfSpaceY(context)), insideForwardAttack, forwardUtility),
    FALSE_NINE: new SpatialRoleBehaviour(falseNineAttack, falseNineDefend, falseNineAttack, falseNineUtility),
  };

  public forRole(role: PlayerRole): RoleBehaviour {
    return this.behaviours[role] ?? this.fallback;
  }
}
