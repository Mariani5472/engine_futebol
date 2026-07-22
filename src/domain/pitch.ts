import { Rectangle } from "../core/geometry/Rectangle";
import { Rect, Vector2, createRect } from "./common";

export type PitchZoneId =
  | "A1" | "A2" | "A3"
  | "B1" | "B2" | "B3"
  | "C1" | "C2" | "C3"
  | "D1" | "D2" | "D3"
  | "E1" | "E2" | "E3";

export enum FieldThird {
  DEFENSIVE = "DEFENSIVE",
  MIDDLE = "MIDDLE",
  ATTACKING = "ATTACKING"
}

export interface ZoneResolver {
  resolve(position: Vector2): PitchZone;
}

export interface PitchZone {
  id: PitchZoneId;
  row: number;
  column: number;
  rectangle: Rectangle;
}

export interface Goal {
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
}

export interface PitchGeometry {
  readonly penaltyAreaLeft: Rect;
  readonly penaltyAreaRight: Rect;
  readonly goalAreaLeft: Rect;
  readonly goalAreaRight: Rect;
  readonly leftGoal: Goal;
  readonly rightGoal: Goal;
}

export interface PitchProps {
  readonly length: number;
  readonly width: number;
  readonly geometry: PitchGeometry;
}

export class Pitch {
  public readonly length: number;
  public readonly width: number;
  public readonly geometry: PitchGeometry;

  private constructor(props: PitchProps) {
    this.length = props.length;
    this.width = props.width;
    this.geometry = props.geometry;
  }

  public static create(props: PitchProps): Pitch {
    if (props.length <= 0 || props.width <= 0) {
      throw new Error("Pitch dimensions must be greater than zero.");
    }

    return new Pitch(props);
  }

  public static createStandard(length = 105, width = 68): Pitch {
    const goalWidth = 7.32;
    const goalHeight = 2.44;

    const penaltyAreaDepth = 16.5;
    const penaltyAreaWidth = 40.32;
    const goalAreaDepth = 5.5;
    const goalAreaWidth = 18.32;

    const centerY = width / 2;

    const geometry: PitchGeometry = {
      penaltyAreaLeft: createRect(0, centerY - penaltyAreaWidth / 2, penaltyAreaDepth, penaltyAreaWidth),
      penaltyAreaRight: createRect(length - penaltyAreaDepth, centerY - penaltyAreaWidth / 2, penaltyAreaDepth, penaltyAreaWidth),
      goalAreaLeft: createRect(0, centerY - goalAreaWidth / 2, goalAreaDepth, goalAreaWidth),
      goalAreaRight: createRect(length - goalAreaDepth, centerY - goalAreaWidth / 2, goalAreaDepth, goalAreaWidth),
      leftGoal: {
        center: { x: 0, y: centerY },
        width: goalWidth,
        height: goalHeight,
      },
      rightGoal: {
        center: { x: length, y: centerY },
        width: goalWidth,
        height: goalHeight,
      },
    };

    return Pitch.create({
      length,
      width,
      geometry,
    });
  }
}