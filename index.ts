const Metre = 1;
const Kilo = 1e3;
const Second = 1;
const Newton = 1;
const Kilogram = 1;
const GravitationalConstant = 6.67384e-11 * Newton * Metre * Metre / Kilogram / Kilogram;

class Vec3 {
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

type Instant = number;
type Duration = number;
type Displacement = Vec3;
type Velocity = Vec3;
type Acceleration = Vec3;

type SystemState = {
  positions: Array<Displacement>;
  velocities: Array<Velocity>;
  time: Instant;
}

class DoublePrecision {
  value: number;
  error: number;

  Increment(right: number): DoublePrecision {
    const temp = this.value;
    const y = this.error + right;
    this.value = temp + y;
    this.error = (temp - this.value) + y;
    return this;
  }
}

const McLachlanAtela1992Order5Optimal = {
  order: 5,
  time_reversible: false,
  evaluations: 6,
  composition: "BA",
  a: [
    0.339839625839110000,
    -0.088601336903027329,
    0.5858564768259621188,
    -0.603039356536491888,
    0.3235807965546976394,
    0.4423637942197494587
  ],
  b: [
    0.1193900292875672758,
    0.6989273703824752308,
    -0.1713123582716007754,
    0.4012695022513534480,
    0.0107050818482359840,
    -0.0589796254980311632
  ],
};

class SymplecticRungeKuttaNyströmIntegrator {
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

class MassiveBody {
  name: string;
  gravitational_parameter: number; // [Length]^3 / [Time]^2
  mass: number;

  constructor(name: string, gravitational_parameter: number, mass: number) {
    this.name = name;
    this.gravitational_parameter = gravitational_parameter;
    this.mass = mass;
  }

  static FromGravitationalParameter(gravitational_parameter: number, name = ""): MassiveBody {
    return new MassiveBody(name, gravitational_parameter, gravitational_parameter / GravitationalConstant);
  }

  static FromMass(mass: number, name = ""): MassiveBody {
    return new MassiveBody(name, mass * GravitationalConstant, mass);
  }
}

class Ephemeris {
  bodies: Array<MassiveBody>;

  constructor(bodies: Array<MassiveBody>) {
    this.bodies = bodies;
  }

  ComputeMassiveBodiesGravitationalAccelerations(
    t: Instant,
    positions: Array<Displacement>,
    accelerations: Array<Acceleration>
  ) {
    accelerations.forEach(a => a.Clear());
    for (let b1 = 0; b1 < this.bodies.length; b1++) {
      const body1 = this.bodies[b1];
      ComputeGravitationalAccelerationByMassiveBodyOnMassiveBodies(
        body1, b1,
        this.bodies,
        b1 + 1,
        this.bodies.length,
        positions,
        accelerations,
      )
    }
  }
}


function ComputeGravitationalAccelerationByMassiveBodyOnMassiveBodies(
  body1: MassiveBody,
  b1: number,
  bodies2: Array<MassiveBody>,
  b2_begin: number,
  b2_end: number,
  positions: Array<Displacement>,
  accelerations: Array<Acceleration>
) {
  const position_of_b1 = positions[b1];
  const acceleration_on_b1 = accelerations[b1];

  const µ1 = body1.gravitational_parameter;
  for (let b2 = b2_begin; b2 < b2_end; b2++) {
    const acceleration_on_b2 = accelerations[b2];
    const body2 = bodies2[b2];
    const µ2 = body2.gravitational_parameter;
    const dq = position_of_b1.Sub(positions[b2]);
    const dq2 = dq.Norm2();
    const one_over_dq3 = Math.sqrt(dq2) / (dq2 * dq2);
    const µ1_over_dq3 = µ1 * one_over_dq3;
    acceleration_on_b2._Add(dq.Scale(µ1_over_dq3));

    const µ2_over_dq3 = µ2 * one_over_dq3;
    acceleration_on_b1._Sub(dq.Scale(µ2_over_dq3));
  }
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.width = 800 * devicePixelRatio
canvas.height = 600 * devicePixelRatio
canvas.style.width = '800px'
canvas.style.width = '600px'
const ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio);

const SolarSystem = [
  MassiveBody.FromGravitationalParameter(1.3271244004193938e+11 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2), "Sun"),
  MassiveBody.FromGravitationalParameter(3.9860043543609598e+05 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2), "Earth"),
  MassiveBody.FromGravitationalParameter(4.9028000661637961e+03 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2), "Luna"),
]

const SolarSystemJD2451545 = [
  {
    body: "Sun",
    position: new Vec3(
      -1.067598502264559e+06 * Kilo * Metre, // km
      -3.959890535950128e+05 * Kilo * Metre, // km
      -1.380711260212289e+05 * Kilo * Metre, // km
    ),
    velocity: new Vec3(
      +9.312570119052345e-03 * Kilo * Metre / Second, // km/s
      -1.170150735349599e-02 * Kilo * Metre / Second, // km/s
      -5.251247980405208e-03 * Kilo * Metre / Second, // km/s
    ),
  },
  {
    body: "Earth",
    position: new Vec3(
      -2.756663225908748e+07 * Kilo * Metre, // km
      +1.323614283011928e+08 * Kilo * Metre, // km
      +5.741864727316781e+07 * Kilo * Metre, // km
    ),
    velocity: new Vec3(
      -2.978494749707266e+01 * Kilo * Metre / Second, // km/s
      -5.029753833589443e+00 * Kilo * Metre / Second, // km/s
      -2.180645051457051e+00 * Kilo * Metre / Second, // km/s
    ),
  },
  {
    body: "Luna",
    position: new Vec3(
      -2.785824064408012e+07 * Kilo * Metre, // km
      +1.320947114679507e+08 * Kilo * Metre, // km
      +5.734254478723364e+07 * Kilo * Metre, // km
    ),
    velocity: new Vec3(
      -2.914141611066932e+01 * Kilo * Metre / Second, // km/s
      -5.695841519211172e+00 * Kilo * Metre / Second, // km/s
      -2.481970755642522e+00 * Kilo * Metre / Second, // km/s
    ),
  },
]

function main() {
  const e = new Ephemeris(SolarSystem);
  const initial_state = {
    positions: SolarSystemJD2451545.map(b => b.position),
    velocities: SolarSystemJD2451545.map(b => b.velocity),
    time: 0,
  };
  const append_state = s => {
    ctx.save();
    ctx.translate(ctx.canvas.width/(2 * devicePixelRatio), ctx.canvas.height/(2 * devicePixelRatio));
    const scale = 2e-9;
    for (let i = 0; i < e.bodies.length; i++) {
      const body = e.bodies[i];
      const q = s.positions[i];
      const v = s.velocities[i];
      const r = body.name === "Luna" ? 1.5 : 3;
      ctx.fillStyle = body.name === "Luna" ? "lightblue" : "black";
      ctx.beginPath();
      ctx.arc(q.x * scale, q.y * scale, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  };
  append_state(initial_state);
  const srkn = new SymplecticRungeKuttaNyströmIntegrator(
    McLachlanAtela1992Order5Optimal,
    initial_state,
    e.ComputeMassiveBodiesGravitationalAccelerations.bind(e),
    append_state,
    2e5
  );
  srkn.Solve(4e7);
}
main()
