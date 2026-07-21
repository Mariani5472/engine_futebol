import { CognitiveContext } from "../../cognitive/CognitiveContext";
import { MemoryModel } from "./MemoryModel";
import { PlayerMemory } from "./PlayerMemory";

export class MemorySystem {

  constructor(
    private readonly model = new MemoryModel()
  ) {}

  public update(
    context: CognitiveContext
  ): void {

    this.model.updateBall(
      context.player,
      context.awareness.ball,
      context.deltaTime
    );

    this.updatePlayers(
      context.awareness.teammates,
      context
    );

    this.updatePlayers(
      context.awareness.opponents,
      context
    );

  }

  private updatePlayers(
    memories: Map<string, PlayerMemory>,
    context: CognitiveContext
  ): void {

    const toRemove: string[] = [];

    for (const memory of memories.values()) {

      this.model.updatePlayer(
        context.player,
        memory,
        context.deltaTime
      );

      if (memory.shouldForget()) {

        toRemove.push(
          memory.playerId
        );

      }

    }

    for (const playerId of toRemove) {

      memories.delete(playerId);

    }

  }
}