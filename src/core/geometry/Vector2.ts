export class Vector2 {
  constructor(
    public readonly x: number,
    public readonly y: number
  ) {}
  public add(v: Vector2): Vector2 {
    return new Vector2(
      this.x + v.x,
      this.y + v.y
    );
  }
  public subtract(v: Vector2): Vector2 {
    return new Vector2(
      this.x - v.x,
      this.y - v.y
    );
  }
  public multiply(scalar: number): Vector2 {
    return new Vector2(
      this.x * scalar,
      this.y * scalar
    );
  }
  public divide(scalar: number): Vector2 {
    return new Vector2(
      this.x / scalar,
      this.y / scalar
    );
  }
  public cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }
  public magnitude(): number {
    return Math.sqrt(
      this.x * this.x +
      this.y * this.y
    );
  }
  public normalize(): Vector2 {
    const length = this.magnitude();
    if (length === 0) {
      return new Vector2(0, 0);
    }
    return this.divide(length);
  }
  public distanceTo(
    other: Vector2
  ): number {
    const dx =
      this.x - other.x;
    const dy =
      this.y - other.y;
    return Math.sqrt(
      dx * dx +
      dy * dy
    );
  }
  public rotate(
    radians: number
  ): Vector2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }
  public angle(): number {
    return Math.atan2(this.y, this.x);
  }
  public dot(other: Vector2): number {
    return (this.x * other.x + this.y * other.y);
  }
  public angleTo(other: Vector2): number {
    const dot = this.normalize().dot(other.normalize());
    const clampedDot = Math.max(-1, Math.min(1, dot));
    return Math.acos(clampedDot);
  }
  public static zero(): Vector2 {
    return new Vector2(0, 0);
  }
  public static one(): Vector2 {
    return new Vector2(1, 1);
  }
  public static up(): Vector2 {
    return new Vector2(0, -1);
  }
  public static down(): Vector2 {
    return new Vector2(0, 1);
  }
  public static left(): Vector2 {
    return new Vector2(-1, 0);
  }
  public static right(): Vector2 {
    return new Vector2(1, 0);
  }
  public static fromAngle(
    angle: number
  ): Vector2 {
    return new Vector2(
      Math.cos(angle),
      Math.sin(angle)
    );
  }
}