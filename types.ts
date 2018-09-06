export type Instant = number;
export type Duration = number;
export type Displacement = Vec3;
export type Velocity = Vec3;
export type Acceleration = Vec3;

export type SystemState = {
  positions: Array<Displacement>;
  velocities: Array<Velocity>;
  time: Instant;
}

export class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  Clear() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  Copy(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  _Add(other: Vec3): Vec3 {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  Add(other: Vec3): Vec3 {
    return this.Copy()._Add(other);
  }

  _Sub(other: Vec3): Vec3 {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }

  Sub(other: Vec3): Vec3 {
    return this.Copy()._Sub(other);
  }

  _Scale(k: number): Vec3 {
    this.x *= k;
    this.y *= k;
    this.z *= k;
    return this;
  }

  Scale(k: number): Vec3 {
    return this.Copy()._Scale(k);
  }

  _Set(other: Vec3) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
  }

  Norm2(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
}
