import { Velocity } from "./Velocity";

export class MovementComponent {

  constructor(
    public velocity: Velocity,
    public acceleration = 0,
    public maxSpeed = 0

  ) {}

}