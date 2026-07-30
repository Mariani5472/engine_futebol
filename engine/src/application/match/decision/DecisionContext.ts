import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { WorldAwareness } from "../awareness/WorldAwareness";
import type { TacticalIntelligenceSnapshot, TeamTacticalContext, PlayerSpatioTemporalState } from "../tactical/intelligence/TacticalIntelligenceTypes";

export class DecisionContext {
  constructor(
    public readonly match: MatchState,
    public readonly player: PlayerMatchState,
    public readonly awareness: PlayerAwareness,
    public readonly currentTick: number,
    public readonly deltaTime: number,
    /** Pre-computed tactical snapshot — evaluators should prefer this over scanning the pitch. */
    public readonly world: WorldAwareness,
    /** Immutable collective/spatio-temporal frame shared by every player in this cognitive cycle. */
    public readonly tacticalIntelligence?: TacticalIntelligenceSnapshot,
  ) {}

  public get teamTacticalContext(): TeamTacticalContext | undefined {
    const team = this.match.home.players.includes(this.player) ? this.match.home : this.match.away;
    return this.tacticalIntelligence?.teams.get(team.team.id);
  }

  public get playerSpatioTemporalState(): PlayerSpatioTemporalState | undefined {
    return this.tacticalIntelligence?.players.get(this.player.player.id);
  }
}
