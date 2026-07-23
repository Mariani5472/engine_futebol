import {
  CognitiveContext,
} from "../../cognitive/CognitiveContext";

import {
  MemoryModel,
} from "./MemoryModel";

import {
  PlayerMemory,
} from "./PlayerMemory";

import {
  Visibility,
} from "../../perception/Visibility";

export class MemorySystem {

  constructor(private readonly model = new MemoryModel()) {}

  public update(context: CognitiveContext): void {

    this.updateBall(context);

    this.updatePlayers(
      context.awareness.teammates,
      context
    );

    this.updatePlayers(
      context.awareness.opponents,
      context
    );
  }

  private updateBall(context: CognitiveContext): void {

    const perception = context.perception.ball;

    const memory = context.awareness.ball;

    if (perception.visibility === Visibility.VISIBLE) {

      this.model.refreshBall(
        memory,
        perception.position,
        context.tick
      );

      return;
    }

    this.model.decayBall(
      context.player,
      memory,
      context.deltaTime,
      context.tick
    );
  }

  private updatePlayers(
    memories: Map<string, PlayerMemory>,
    context: CognitiveContext
  ): void {

    const perceivedPlayers = this.getPerceivedPlayers(
      memories,
      context
    );

    const toRemove: string[] = [];

    for (const memory of memories.values()) {

      const perceived = perceivedPlayers.get(memory.playerId);

      if (perceived && perceived.visibility === Visibility.VISIBLE) {

        this.model.refreshPlayer(
          memory,
          perceived.position,
          context.tick
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

  private getPerceivedPlayers(
    memories: Map<string, PlayerMemory>,
    context: CognitiveContext
  ) {

    const result = new Map();

    const perceived = [
      ...context.perception.teammates,
      ...context.perception.opponents,
    ];

    for (const entity of perceived) {

      if (memories.has(entity.entityId)) {

        result.set(entity.entityId, entity);
      }
    }

    return result;
  }
}