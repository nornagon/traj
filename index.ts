import * as THREE from 'three';
import * as OC from './OrbitControls';
const {OrbitControls} = OC as any;
import * as TC from './TrackballControls';
const {TrackballControls} = TC as any;
import {MeshLine, MeshLineMaterial} from 'three.meshline';

const Metre = 1;
const Kilo = 1e3;
const Second = 1;
const Newton = 1;
const Degree = Math.PI / 180;
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


const SolarSystemData = [
  {
    name: "Sol",
    gravitational_parameter: 1.3271244004193938e+11 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 696000.0 * Kilo * Metre,
  },
  {
    name: "Earth",
    gravitational_parameter: 3.9860043543609598e+05 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 6371.0084 * Kilo * Metre,
  },
  {
    name: "Luna",
    gravitational_parameter: 4.9028000661637961e+03 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 1737.4 * Kilo * Metre,
  },
  {
    name: "Mercury",
    gravitational_parameter: 2.2031780000000021e+04 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 2439.7 * Kilo * Metre,
  },
  {
    name: "Venus",
    gravitational_parameter: 3.2485859200000006e+05 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 6051.8 * Kilo * Metre,
  },
  {
    name: "Mars",
    gravitational_parameter: 4.282837362069909e+04 * Math.pow(Kilo * Metre, 3) / Math.pow(Second, 2),
    mean_radius: 3389.5 * Kilo * Metre,
  },
]

const SolarSystem = SolarSystemData.map(body =>
  MassiveBody.FromGravitationalParameter(body.gravitational_parameter, body.name))

const SolarSystemJD2451545 = [
  {
    body: "Sol",
    position: new Vec3(
      -1.067598502264559e+06 * Kilo * Metre,
      -3.959890535950128e+05 * Kilo * Metre,
      -1.380711260212289e+05 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +9.312570119052345e-03 * Kilo * Metre / Second,
      -1.170150735349599e-02 * Kilo * Metre / Second,
      -5.251247980405208e-03 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Earth",
    position: new Vec3(
      -2.756663225908748e+07 * Kilo * Metre,
      +1.323614283011928e+08 * Kilo * Metre,
      +5.741864727316781e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      -2.978494749707266e+01 * Kilo * Metre / Second,
      -5.029753833589443e+00 * Kilo * Metre / Second,
      -2.180645051457051e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Luna",
    position: new Vec3(
      -2.785824064408012e+07 * Kilo * Metre,
      +1.320947114679507e+08 * Kilo * Metre,
      +5.734254478723364e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      -2.914141611066932e+01 * Kilo * Metre / Second,
      -5.695841519211172e+00 * Kilo * Metre / Second,
      -2.481970755642522e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Mercury",
    position: new Vec3(
      -2.052932489502387e+07 * Kilo * Metre,
      -6.032395676436062e+07 * Kilo * Metre,
      -3.013084385588142e+07 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +3.700430445042139e+01 * Kilo * Metre / Second,
      -8.541376874560308e+00 * Kilo * Metre / Second,
      -8.398372276762027e+00 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Venus",
    position: new Vec3(
      -1.085240925511762e+08 * Kilo * Metre,
      -7.318517883756028e+06 * Kilo * Metre,
      +3.548115911200081e+06 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +1.391218618039207e+00 * Kilo * Metre / Second,
      -3.202951994557884e+01 * Kilo * Metre / Second,
      -1.449708670519373e+01 * Kilo * Metre / Second,
    ),
  },
  {
    body: "Mars",
    position: new Vec3(
      +2.069805421180782e+08 * Kilo * Metre,
      -1.863697276138850e+05 * Kilo * Metre,
      -5.667233334924674e+06 * Kilo * Metre,
    ),
    velocity: new Vec3(
      +1.171984953383225e+00 * Kilo * Metre / Second,
      +2.390670820059185e+01 * Kilo * Metre / Second,
      +1.093392065180724e+01 * Kilo * Metre / Second,
    ),
  },
]

function main() {
  const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 10000);

  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setSize(800, 600);

  const scene = new THREE.Scene();

  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);

  let controls: any;
  const controlType = 'trackball';
  if (controlType === 'trackball') {
    controls = new (TrackballControls as any)(camera, renderer.domElement);
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.5;
  } else if (controlType === 'orbit') {
    controls = new (OrbitControls as any)(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.update();
  }


  const e = new Ephemeris(SolarSystem);
  const initial_state = {
    positions: SolarSystemJD2451545.map(b => b.position),
    velocities: SolarSystemJD2451545.map(b => b.velocity),
    time: 0,
  };

  const m = new THREE.Matrix4();
  m.makeScale(1e-9, 1e-9, 1e-9);

  const trajGeoms: Array<THREE.Geometry> = [];
  for (let i = 0; i < SolarSystem.length; i++) {
    const geom = new THREE.Geometry();
    const q = initial_state.positions[i];
    geom.vertices.push(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m));
    trajGeoms.push(geom);
  }

  const append_state = (s: SystemState) => {
    for (let i = 0; i < s.positions.length; i++) {
      const q = s.positions[i];
      trajGeoms[i].vertices.push(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m));
    }
  };
  append_state(initial_state);
  const srkn = new SymplecticRungeKuttaNyströmIntegrator(
    McLachlanAtela1992Order5Optimal,
    initial_state,
    e.ComputeMassiveBodiesGravitationalAccelerations.bind(e),
    append_state,
    2e5
  );
  srkn.Solve(3e7);

  // https://mattdesl.svbtle.com/drawing-lines-is-hard
  for (let i = 0; i < SolarSystem.length; i++) {
    const material = new MeshLineMaterial({
      color: new THREE.Color(e.bodies[i].name === 'Luna' ? 0x00ffff : 0x0000ff),
      lineWidth: 3,
      resolution: new THREE.Vector2(800, 600),
      sizeAttenuation: 0,
    });
    const line = new MeshLine();
    line.setGeometry(trajGeoms[i]);
    scene.add(new THREE.Mesh(line.geometry, material));
  }

  const lods: Array<THREE.LOD> = [];
  for (let i = 0; i < SolarSystem.length; i++) {
    const r = SolarSystemData[i].mean_radius;

    const lod = new THREE.LOD();
    const geom0 = new THREE.IcosahedronGeometry(r * m.elements[0], 3);
    const material0 = new THREE.MeshBasicMaterial({color: 0xff0000});
    const planet0 = new THREE.Mesh(geom0, material0);
    lod.addLevel(planet0, 0);
    const geom1 = new THREE.IcosahedronGeometry(r * m.elements[0], 2);
    const material1 = new THREE.MeshBasicMaterial({color: 0xffff00});
    const planet1 = new THREE.Mesh(geom1, material1);
    lod.addLevel(planet1, 75);
    const material2 = new THREE.SpriteMaterial({color: 0xffffff, sizeAttenuation: false} as any);
    const geom2 = new THREE.Sprite(material2);
    geom2.scale.set(0.05, 0.05, 1);
    lod.addLevel(geom2, 125);
    const q = initial_state.positions[i];
    lod.position.copy(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m));
    scene.add(lod);
    lods.push(lod);
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
    lods.forEach(lod => lod.update(camera));
  }
  animate();
}
main()
