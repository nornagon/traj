import {SystemState, Instant, Displacement, Acceleration, Duration, Velocity, Vec3} from './types';

export class SymplecticRungeKuttaNyströmIntegrator {
  current_state: SystemState;
  compute_acceleration: (t: Instant, positions: Array<Displacement>, accelerations: Array<Acceleration>) => void;
  append_state: (s: SystemState) => void;
  step: Duration;

  method: any;
  a: Array<number>;
  b: Array<number>;
  c: Array<number>;

  constructor(
    method: any,
    initial_state: SystemState,
    compute_acceleration: (t: Instant, positions: Array<Displacement>, accelerations: Array<Acceleration>) => void,
    append_state: (s: SystemState) => void,
    step: Duration,
  ) {
    this.method = method;
    this.current_state = initial_state;
    this.compute_acceleration = compute_acceleration;
    this.append_state = append_state;
    this.step = step;
    this.a = method.a;
    this.b = method.b;
    this.c = [];
    let c_i = 0;
    for (let i = 0; i < method.evaluations; i++) {
      this.c[i] = c_i;
      c_i += this.a[i];
    }
  }

  Solve(t_final: number) {
    const integration_direction = Math.sign(this.step);
    const h: Duration = this.step;
    const abs_h = integration_direction * h;

    const dimension = this.current_state.positions.length;

    const dq: Array<Displacement> = Array(dimension);
    const dv: Array<Velocity> = Array(dimension);
    for (let i = 0; i < dimension; i++) dq[i] = new Vec3(0, 0, 0);
    for (let i = 0; i < dimension; i++) dv[i] = new Vec3(0, 0, 0);

    const q = this.current_state.positions;
    const v = this.current_state.velocities;

    const q_stage: Array<Displacement> = Array(dimension);
    for (let i = 0; i < dimension; i++) q_stage[i] = new Vec3(0, 0, 0);
    const g: Array<Acceleration> = Array(dimension);
    for (let i = 0; i < dimension; i++) g[i] = new Vec3(0, 0, 0);

    while (abs_h <= Math.abs((t_final - this.current_state.time))) {
      for (let i = 0; i < dimension; i++) dq[i].Clear();
      for (let i = 0; i < dimension; i++) dv[i].Clear();

      for (let i = 0; i < this.method.evaluations; i++) {
        for (let k = 0; k < dimension; k++) {
          q_stage[k].Clear();
          q_stage[k]._Add(q[k]);
          q_stage[k]._Add(dq[k]);
        }
        this.compute_acceleration(this.current_state.time + (this.current_state.time + this.c[i] * h), q_stage, g);
        for (let k = 0; k < dimension; k++) {
          dv[k]._Add(g[k].Scale(h * this.b[i]));
          dq[k]._Add((v[k].Add(dv[k])).Scale(h * this.a[i]));
        }
      }
      this.current_state.time += h;
      for (let k = 0; k < dimension; k++) {
        q[k]._Add(dq[k]);
        v[k]._Add(dv[k]);
      }
      this.append_state(this.current_state);
    }
  }
}
