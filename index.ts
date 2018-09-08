import * as THREE from 'three';
import * as OC from './OrbitControls';
const {OrbitControls} = OC as any;
import * as TC from './TrackballControls';
const {TrackballControls} = TC as any;
import {MeshLine, MeshLineMaterial} from './MeshLine';
import {SymplecticRungeKuttaNyströmIntegrator} from './SymplecticRungeKuttaNyströmIntegrator';
import {McLachlanAtela1992Order5Optimal} from './IntegrationMethods';

import {SystemState, Instant, Displacement, Acceleration, Velocity, Duration} from './types';
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
  mean_radius: number;

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

class World {
  celestials: Array<MassiveBody>;
  ephemeris: Ephemeris;
  integrator: SymplecticRungeKuttaNyströmIntegrator;
  state: SystemState;

  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: any;

  celestialNodes: Array<THREE.Object3D>;
  trajectoryNodes: Array<THREE.Object3D>;

  // Transformation from MKS to renderer coords.
  scale: THREE.Matrix4;

  constructor(
    bodies: Array<MassiveBody>,
    initial_state: SystemState,
    method: any
  ) {
    this.celestials = bodies;
    this.ephemeris = new Ephemeris(this.celestials);
    this.state = initial_state;
    this.integrator = new SymplecticRungeKuttaNyströmIntegrator(
      method,
      this.state,
      this.ComputeAcceleration.bind(this),
      this.AppendState.bind(this),
      1e3
    );

    this.camera = new THREE.PerspectiveCamera(75, 800/600, 0.0001, 10000);
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true});
    this.renderer.setSize(800, 600);
    this.renderer.setPixelRatio(devicePixelRatio);

    this.scene = new THREE.Scene();
    this.controls = new (TrackballControls as any)(this.camera, this.renderer.domElement);
    this.scale = new THREE.Matrix4().makeScale(1e-9, 1e-9, 1e-9);

    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);

    this.InitializeCelestialNodes();
    this.InitializeTrajectoryNodes();

    this.integrator.Solve(1e3);
  }

  InitializeCelestialNodes() {
    this.celestialNodes = [];
    const bodyMarkerTexture = new THREE.TextureLoader().load(bodyMarkerURL);
    for (let i = 0; i < this.celestials.length; i++) {
      const body = this.celestials[i]
      const r = body.mean_radius;
      const rs = r * this.scale.elements[0];

      const lod = new THREE.LOD();

      // LOD 0: icosahedron with detail=3
      const geom0 = new THREE.IcosahedronGeometry(rs, 3);
      const material0 = new THREE.MeshBasicMaterial({color: 0xff0000});
      const planet0 = new THREE.Mesh(geom0, material0);
      lod.addLevel(planet0, 0);

      // LOD 1: icosahedron with detail=2
      const geom1 = new THREE.IcosahedronGeometry(rs, 2);
      const material1 = new THREE.MeshBasicMaterial({color: 0xffff00});
      const planet1 = new THREE.Mesh(geom1, material1);
      lod.addLevel(planet1, 250);// * rs);

      // LOD 2: sprite icon
      const material2 = new THREE.SpriteMaterial({
        color: 0xffffff, sizeAttenuation: false, map: bodyMarkerTexture, opacity: 0.5} as any);
      const geom2 = new THREE.Sprite(material2);
      geom2.scale.set(0.05, 0.05, 1);
      lod.addLevel(geom2, 500);// * rs);

      // initial position
      const q = this.state.positions[i];
      lod.position.copy(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(this.scale));

      lod.userData.bodyIdx = i;
      lod.name = body.name;

      this.scene.add(lod);
      this.celestialNodes.push(lod);
    }
  }

  InitializeTrajectoryNodes() {
    this.trajectoryNodes = [];
    for (let i = 0; i < this.celestials.length; i++) {
      const body = this.celestials[i];
      const material = new MeshLineMaterial({
        color: new THREE.Color(body.name === 'Luna' ? 0x00ffff : 0x0000ff),
        lineWidth: 3,
        resolution: new THREE.Vector2(800, 600),
        sizeAttenuation: 0,
        near: 0.1,
        far: 1000,
      });
      const line = new MeshLine();
      const mesh = new THREE.Mesh(line, material);
      this.scene.add(mesh);
      this.trajectoryNodes.push(mesh);
    }
  }

  ComputeAcceleration(t: Instant, positions: Array<Displacement>, accelerations: Array<Acceleration>) {
    this.ephemeris.ComputeMassiveBodiesGravitationalAccelerations(t, positions, accelerations);
  }

  AppendState(s: SystemState) {
    this.ephemeris.AppendMassiveBodiesState(s);
    for (let i = 0; i < this.celestials.length; i++) {
      const q = s.positions[i];
      const trajectory = this.ephemeris.trajectories[i];
      const meshLine = this.trajectoryNodes[i].geometry;
      const lastPoint = meshLine.copyV3(meshLine.nPoints - 1);
      const qs = new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(this.scale);
      if (!lastPoint || lastPoint.distanceTo(qs) > 10) {
        this.trajectoryNodes[i].geometry.push(qs);
      }
    }
  }

  Step(dt: Duration) {
    this.integrator.Solve(this.state.time + dt);
  }

  Render() {
    this.celestialNodes.forEach(c => {
      const q = this.state.positions[c.userData.bodyIdx];
      c.position.copy(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(this.scale));
      c.update(this.camera);
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  Start() {
    const that = this;
    function animate() {
      that.Step(1e4);
      that.Render();
      requestAnimationFrame(animate);
    }
    animate();
    canvas.onclick = e => {
      const {width, height} = e.target.getBoundingClientRect();
      const mouse = new THREE.Vector2(e.offsetX, height - e.offsetY);
      const screenP = new THREE.Vector2();
      const hit = this.celestialNodes.find(c => {
        const p = c.position.clone().project(this.camera);
        screenP.set((p.x + 1) / 2 * width, (p.y + 1) / 2 * height)
        return mouse.distanceTo(screenP) < 5;
      });
      if (hit) {
        hit.add(this.camera);
        this.controls.target.set(0,0,0);
      }
    }
  }
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const SolarSystem = SolarSystemData.map(body => {
  const mb = MassiveBody.FromGravitationalParameter(body.gravitational_parameter, body.name);
  mb.mean_radius = body.mean_radius;
  return mb;
})

function main() {
  const initial_state = {
    positions: SolarSystemJD2451545.map(b => b.position),
    velocities: SolarSystemJD2451545.map(b => b.velocity),
    time: 0,
  };
  const world = new World(
    SolarSystem,
    initial_state,
    McLachlanAtela1992Order5Optimal,
  )
  world.Start();
}
main()
