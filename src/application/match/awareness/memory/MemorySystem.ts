import { CognitiveContext } from "../../cognitive/CognitiveContext";
import { PerceivedEntity } from "../../perception/PerceivedEntity";
import { Visibility } from "../../perception/Visibility";
import { MemoryModel } from "./MemoryModel";
import { PlayerMemory } from "./PlayerMemory";

export class MemorySystem {

  constructor(
    private readonly model = new MemoryModel()
  ) {}

  public update(context: CognitiveContext): void {
    this.updateBall(context);

    // Update teammate memories from teammate perceptions.
    this.updatePlayerMemories(
      context.awareness.teammates,
      context.perception.teammates,
      context
    );

    // Update opponent memories from opponent perceptions.
    this.updatePlayerMemories(
      context.awareness.opponents,
      context.perception.opponents,
      context
    );
  }

  private updateBall(context: CognitiveContext): void {
    const ballPerception = context.perception.ball;
    const ballMemory = context.awareness.ball;

    const isVisible =
      ballPerception.visibility === Visibility.VISIBLE ||
      ballPerception.visibility === Visibility.PARTIALLY_VISIBLE;

    if (isVisible) {
      this.model.refreshBall(
        ballMemory,
        ballPerception.position,
        context.tick,
        context.deltaTime
      );
    } else {
      this.model.decayBall(
        context.player,
        ballMemory,
        context.deltaTime,
        context.tick
      );
    }
  }

  /**
   * Updates (and populates for the first time) player memories from a list
   * of perceived entities.
   *
   * Previously this method only iterated EXISTING memories, so it never
   * populated the map on the first tick — fixed here.
   */
  private updatePlayerMemories(
    memories: Map<string, PlayerMemory>,
    perceivedEntities: readonly PerceivedEntity[],
    context: CognitiveContext
  ): void {

    // Build a quick-lookup set of currently perceived entity IDs.
    const perceivedMap = new Map(perceivedEntities.map(e => [e.entityId, e]));

    // ── 1. Update or decay EXISTING memory entries ──────────────────────────
    const toRemove: string[] = [];

    for (const memory of memories.values()) {
      const perceivedEntity = perceivedMap.get(memory.playerId);

      if (perceivedEntity) {
        this.model.refreshPlayer(
          memory,
          perceivedEntity.position,
          context.tick,
          context.deltaTime
        );
      } else {
        this.model.decayPlayer(
          context.player,
          memory,
          context.deltaTime,
          context.tick
        );
      }

      if (memory.shouldForget()) {
        toRemove.push(memory.playerId);
      }
    }

    for (const playerId of toRemove) {
      memories.delete(playerId);
    }

    // ── 2. ADD new entries for entities seen for the first time ─────────────
    for (const [entityId, perceived] of perceivedMap) {
      if (memories.has(entityId)) continue;                  // already tracked
      if (entityId === context.player.player.id) continue;  // skip self

      // Only add if the entity is actually visible.
      if (
        perceived.visibility === Visibility.VISIBLE ||
        perceived.visibility === Visibility.PARTIALLY_VISIBLE
      ) {
        const newMemory = PlayerMemory.create(
          entityId,
          perceived.position,
          context.tick
        );
        memories.set(entityId, newMemory);
      }
    }
  }
}
