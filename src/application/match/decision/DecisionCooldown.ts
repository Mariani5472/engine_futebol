import {
  DecisionType,
} from "./DecisionType";

interface CooldownEntry {
  readonly type: DecisionType;
  readonly expiresAtTick: number;
}

export class DecisionCooldown {
  private readonly cooldowns = new Map<DecisionType, number>();

  constructor(private readonly defaultDuration = 1) {}

  public isBlocked(
    type: DecisionType,
    currentTick: number
  ): boolean {

    const expiresAt = this.cooldowns.get(
      type
    );
    if (expiresAt === undefined) {
      return false;
    }
    return currentTick < expiresAt;
  }

  public block(
    type: DecisionType,
    currentTick: number,
    duration = this.defaultDuration
  ): void {

    this.cooldowns.set(
      type,
      currentTick +
      duration
    );
  }

  public clear(type: DecisionType): void {
    this.cooldowns.delete(type);
  }
}