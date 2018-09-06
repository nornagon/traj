import * as THREE from 'three';
import * as OC from './OrbitControls';
const {OrbitControls} = OC as any;
import * as TC from './TrackballControls';
const {TrackballControls} = TC as any;
import {MeshLine, MeshLineMaterial} from 'three.meshline';
import {SymplecticRungeKuttaNyströmIntegrator} from './SymplecticRungeKuttaNyströmIntegrator';
import {McLachlanAtela1992Order5Optimal} from './IntegrationMethods';

import {SystemState, Instant, Displacement, Acceleration} from './types';
import {GravitationalConstant} from './quantities';
import {SolarSystemData, SolarSystemJD2451545} from './SolarSystem';

import bodyMarkerURL from './assets/Body marker.png';

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

class Trajectory {
  points: Array<[Instant, Displacement, Velocity]>;

  constructor() {
    this.points = [];
  }

  Append(time: Instant, position: Displacement, velocity: Velocity) {
    this.points.push([time, position, velocity]);
  }

  ForgetBefore(time: Instant) {
    const firstAfterT = this.points.findIndex(p => p[0] >= time);
    if (firstAfterT > 0) {
      this.points = this.points.slice(firstAfterT);
    }
  }
}

class Ephemeris {
  bodies: Array<MassiveBody>;
  trajectories: Array<Trajectory>;

  constructor(bodies: Array<MassiveBody>) {
    this.bodies = bodies;
    this.trajectories = bodies.map(_ => new Trajectory());
  }

  AppendMassiveBodiesState(s: SystemState) {
    for (let i = 0; i < s.positions.length; i++) {
      const q = s.positions[i];
      const v = s.velocities[i];
      this.trajectories[i].Append(s.time, q.Copy(), v.Copy());
    }
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

const SolarSystem = SolarSystemData.map(body =>
  MassiveBody.FromGravitationalParameter(body.gravitational_parameter, body.name))

function main() {
  const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.001, 10000);

  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setSize(800, 600);
  renderer.setPixelRatio(devicePixelRatio)

  const scene = new THREE.Scene();

  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);

  let controls: any;
  const controlType = 'trackball';
  if (controlType === 'trackball') {
    controls = new (TrackballControls as any)(camera, renderer.domElement);
    //controls.staticMoving = true;
    //controls.dynamicDampingFactor = 0.5;
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
  const lines: Array<MeshLine> = [];

  const append_state = (s: SystemState) => {
    e.AppendMassiveBodiesState(s);
    for (let i = 0; i < s.positions.length; i++) {
      const q = s.positions[i];
      const three_q = new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m);
      trajGeoms[i].vertices.push(three_q);
      if (lines.length) {
        lines[i].advance(three_q);
      }
    }
  };
  append_state(initial_state);
  const srkn = new SymplecticRungeKuttaNyströmIntegrator(
    McLachlanAtela1992Order5Optimal,
    initial_state,
    e.ComputeMassiveBodiesGravitationalAccelerations.bind(e),
    append_state,
    1e3
  );
  srkn.Solve(1e7);

  // https://mattdesl.svbtle.com/drawing-lines-is-hard
  for (let i = 0; i < SolarSystem.length; i++) {
    const material = new MeshLineMaterial({
      color: new THREE.Color(e.bodies[i].name === 'Luna' ? 0x00ffff : 0x0000ff),
      lineWidth: 3,
      resolution: new THREE.Vector2(800, 600),
      sizeAttenuation: 0,
      near: 0.001,
      far: 10000,
    });
    const line = new MeshLine();
    lines.push(line);
    line.setGeometry(trajGeoms[i]);
    scene.add(new THREE.Mesh(line.geometry, material));
  }

  const bodyMarkerTexture = new THREE.TextureLoader().load(bodyMarkerURL);
  const lods: Array<THREE.LOD> = [];
  for (let i = 0; i < SolarSystem.length; i++) {
    const r = SolarSystemData[i].mean_radius;
    const rs = r * m.elements[0];

    const lod = new THREE.LOD();
    const geom0 = new THREE.IcosahedronGeometry(rs, 3);
    const material0 = new THREE.MeshBasicMaterial({color: 0xff0000});
    const planet0 = new THREE.Mesh(geom0, material0);
    lod.addLevel(planet0, 0);
    const geom1 = new THREE.IcosahedronGeometry(rs, 2);
    const material1 = new THREE.MeshBasicMaterial({color: 0xffff00});
    const planet1 = new THREE.Mesh(geom1, material1);
    lod.addLevel(planet1, 250 * rs);
    const material2 = new THREE.SpriteMaterial({
      color: 0xffffff, sizeAttenuation: false, map: bodyMarkerTexture, opacity: 0.5} as any);
    const geom2 = new THREE.Sprite(material2);
    geom2.scale.set(0.05, 0.05, 1);
    lod.addLevel(geom2, 500 * rs);
    const q = initial_state.positions[i];
    lod.position.copy(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m));
    scene.add(lod);
    lods.push(lod);
    lod.userData.bodyIdx = i;
    lod.name = SolarSystemData[i].name;
  }

  let cameraTarget = 0;

  function animate() {
    requestAnimationFrame(animate);
    //controls.target.copy(lods[cameraTarget].position);
    controls.update();
    lods.forEach(lod => {
      const q = srkn.current_state.positions[lod.userData.bodyIdx];
      lod.position.copy(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(m));
      lod.update(camera);
    });

    srkn.Solve(srkn.current_state.time + 1e4);
    renderer.render(scene, camera);
  }

  canvas.onclick = e => {
    const {width, height} = e.target.getBoundingClientRect();
    const mouse = new THREE.Vector2(e.offsetX, height - e.offsetY);
    const screenP = new THREE.Vector2();
    const hit = lods.find(lod => {
      const p = lod.position.clone().project(camera);
      screenP.set((p.x + 1) / 2 * width, (p.y + 1) / 2 * height)
      return mouse.distanceTo(screenP) < 5;
    });
    if (hit) {
      cameraTarget = hit.userData.bodyIdx;
      hit.add(camera);
      controls.target.set(0,0,0);
    }
  }
  animate();
}
main()
