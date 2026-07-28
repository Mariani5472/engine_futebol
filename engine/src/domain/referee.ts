import { RefereeId } from "./common";

export interface RefereeProps {
  readonly id: RefereeId;
  readonly name: string;
  readonly strictness: number; // 0-100
  readonly consistency: number; // 0-100
  readonly advantageTendency: number; // 0-100
}

export class Referee {
  public readonly id: RefereeId;
  public readonly name: string;
  public readonly strictness: number;
  public readonly consistency: number;
  public readonly advantageTendency: number;

  private constructor(props: RefereeProps) {
    this.id = props.id;
    this.name = props.name;
    this.strictness = props.strictness;
    this.consistency = props.consistency;
    this.advantageTendency = props.advantageTendency;
  }

  public static create(props: RefereeProps): Referee {
    if (!props.name.trim()) {
      throw new Error("Referee name cannot be empty.");
    }

    for (const value of [props.strictness, props.consistency, props.advantageTendency]) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error("Referee numeric properties must be between 0 and 100.");
      }
    }

    return new Referee(props);
  }
}