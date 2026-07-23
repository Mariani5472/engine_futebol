import { Random } from "./Random";
export class SeededRandom implements Random {
  constructor(private seed: number) {}
  public next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(
      t ^ (t >>> 15),
      t | 1
    );
    t ^= t + Math.imul(
      t ^ (t >>> 7),
      t | 61
    );
    return (
      (t ^ (t >>> 14)) >>> 0
    ) / 4294967296;
  }
  public nextFloat(
    min: number,
    max: number
  ): number {
    return min +
      (max - min) *
      this.next();
  }
  public nextInt(
    min: number,
    max: number
  ): number {
    return Math.floor(
      this.nextFloat(
        min,
        max + 1
      )
    );
  }
}