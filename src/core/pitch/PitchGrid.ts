import { Vector2 } from "../geometry/Vector2";
import { Rectangle } from "../geometry/Rectangle";
import { PitchZone } from "./PitchZone";
import { Pitch, PitchZoneId } from "../../domain";
const ROW_NAMES = ["A", "B", "C", "D", "E"] as const;
export class PitchGrid {
  private readonly zones: Map<PitchZoneId, PitchZone>;
  private readonly rows: number;
  private readonly columns: number;
  private readonly zoneWidth: number;
  private readonly zoneHeight: number;
  private constructor(
    pitch: Pitch,
    rows: number,
    columns: number
  ) {
    this.rows = rows;
    this.columns = columns;
    this.zoneWidth = pitch.length / columns;
    this.zoneHeight = pitch.width / rows;
    this.zones = this.buildZones();
  }
  public static create(
    pitch: Pitch,
    rows = 5,
    columns = 3
  ): PitchGrid {
    return new PitchGrid(
      pitch,
      rows,
      columns
    );
  }
  private buildZones(): Map<PitchZoneId, PitchZone> {
    const zones = new Map<PitchZoneId, PitchZone>();
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const id =
          `${ROW_NAMES[row]}${column + 1}` as PitchZoneId;
        zones.set(
          id,
          new PitchZone(
            id,
            row,
            column,
            new Rectangle(
              column * this.zoneWidth,
              row * this.zoneHeight,
              this.zoneWidth,
              this.zoneHeight
            )
          )
        );
      }
    }
    return zones;
  }
  public getZone(
    id: PitchZoneId
  ): PitchZone {
    const zone = this.zones.get(id);
    if (!zone) {
      throw new Error(`Zone ${id} does not exist.`);
    }
    return zone;
  }
  public getZones(): readonly PitchZone[] {
    return [...this.zones.values()];
  }
  public getZoneAt(
    position: Vector2
  ): PitchZone {
    let column = Math.floor(
      position.x / this.zoneWidth
    );
    let row = Math.floor(
      position.y / this.zoneHeight
    );
    column = Math.max(
      0,
      Math.min(
        this.columns - 1,
        column
      )
    );
    row = Math.max(
      0,
      Math.min(
        this.rows - 1,
        row
      )
    );
    const id =
      `${ROW_NAMES[row]}${column + 1}` as PitchZoneId;
    return this.getZone(id);
  }
  public getAdjacentZones(
    zoneId: PitchZoneId
  ): PitchZone[] {
    const zone =
      this.getZone(zoneId);
    const neighbours: PitchZone[] = [];
    for (
      let r = zone.row - 1;
      r <= zone.row + 1;
      r++
    ) {
      for (
        let c = zone.column - 1;
        c <= zone.column + 1;
        c++
      ) {
        if (
          r < 0 ||
          c < 0 ||
          r >= this.rows ||
          c >= this.columns
        ) {
          continue;
        }
        if (
          r === zone.row &&
          c === zone.column
        ) {
          continue;
        }
        const id =
          `${ROW_NAMES[r]}${c + 1}` as PitchZoneId;
        neighbours.push(
          this.getZone(id)
        );
      }
    }
    return neighbours;
  }
  public getRow(
    row: number
  ): readonly PitchZone[] {
    return this.getZones()
      .filter(zone => zone.row === row);
  }
  public getColumn(
    column: number
  ): readonly PitchZone[] {
    return this.getZones()
      .filter(zone => zone.column === column);
  }
  public isNeighbour(
    first: PitchZoneId,
    second: PitchZoneId
  ): boolean {
    return this
      .getAdjacentZones(first)
      .some(zone => zone.id === second);
  }
  public getZonesBetween(
    start: PitchZoneId,
    end: PitchZoneId
  ): PitchZone[] {
    const startZone = this.getZone(start);
    const endZone = this.getZone(end);
    const zones: PitchZone[] = [];
    let x0 = startZone.column;
    let y0 = startZone.row;
    const x1 = endZone.column;
    const y1 = endZone.row;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      const id =
        `${ROW_NAMES[y0]}${x0 + 1}` as PitchZoneId;
      zones.push(this.getZone(id));
      if (x0 === x1 && y0 === y1) {
        break;
      }
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return zones;
  }
  public getDistance(
    first: PitchZoneId,
    second: PitchZoneId
  ): number {
    const a = this.getZone(first);
    const b = this.getZone(second);
    return Math.max(
      Math.abs(a.row - b.row),
      Math.abs(a.column - b.column)
    );
  }
}