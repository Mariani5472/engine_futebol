import { CognitiveContext } from "../../cognitive/CognitiveContext";
import { Visibility } from "../../perception/Visibility";
import { MemoryModel } from "./MemoryModel";
import { PlayerMemory } from "./PlayerMemory";

export class MemorySystem {

  constructor(
    private readonly model = new MemoryModel()
  ) {}

  public update(
    context: CognitiveContext
  ): void {

    this.updateBall(context);

    this.updatePlayerMemories(
      context.awareness.teammates,
      context
    );

    this.updatePlayerMemories(
      context.awareness.opponents,
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

  private updatePlayerMemories(
    memories: Map<string, PlayerMemory>,
    context: CognitiveContext
  ): void {

    const perceivedMap = new Map(
      [
        ...context.perception.teammates,
        ...context.perception.opponents,
      ].map(e => [e.entityId, e])
    );

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

  }
}
