export class Vector3 {
  public constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
  ) {}

  public add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  public subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  public multiply(value: number): Vector3 {
    return new Vector3(this.x * value, this.y * value, this.z * value);
  }

  public magnitude(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  public normalize(): Vector3 {
    const magnitude = this.magnitude();
    return magnitude <= 1e-9 ? Vector3.zero() : this.multiply(1 / magnitude);
  }

  public static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
}
