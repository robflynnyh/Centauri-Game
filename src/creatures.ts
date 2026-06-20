import * as THREE from "three";
import { placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;
type SolidObstacle = {
  x: number;
  z: number;
  radius: number;
};

type Creature = {
  root: THREE.Group;
  body: THREE.Mesh;
  eyes: THREE.Group;
  feet: THREE.Mesh[];
  anchor: THREE.Vector3;
  route: THREE.Vector3[];
  phase: number;
  interval: number;
};

type Beetle = {
  root: THREE.Group;
  wings: THREE.Mesh[];
  anchor: LocalPlanetPoint;
  radius: number;
  altitude: number;
  speed: number;
  phase: number;
  wobble: number;
  localPosition: LocalPlanetPoint;
  nearestObstacleClearance: number;
};

const creatureSpecs = [
  { x: 6.6, z: 11.2, angle: -1.05, phase: 0.2, interval: 2.35, hopDistance: 1.05, scale: 1.12 },
  { x: 2.1, z: 5.9, angle: 0.74, phase: 1.25, interval: 2.8, hopDistance: 0.82 },
  { x: -15.3, z: -4.5, angle: 2.48, phase: 0.92, interval: 3.05, hopDistance: 0.78 },
  { x: 20.5, z: -12.6, angle: -2.2, phase: 1.68, interval: 2.55, hopDistance: 0.92 },
  { x: -5.2, z: 8.7, angle: -0.2, phase: 0.55, interval: 2.15, hopDistance: 0.68 },
];

const beetleSpecs = [
  { x: 4.8, z: 8.4, radius: 2.1, altitude: 2.9, speed: 0.42, phase: 0.1, wobble: 0.78, scale: 0.92 },
  { x: -18, z: 13, radius: 2.8, altitude: 3.4, speed: 0.34, phase: 2.6, wobble: 1.2 },
  { x: 29, z: -15, radius: 2.3, altitude: 2.7, speed: 0.38, phase: 4.1, wobble: 0.64 },
  { x: 263, z: -237, radius: 3.4, altitude: 4.2, speed: 0.26, phase: 1.4, wobble: 1.45, scale: 1.08 },
  { x: 315, z: -266, radius: 2.5, altitude: 3.2, speed: 0.32, phase: 3.8, wobble: 0.96 },
  { x: -174, z: 126, radius: 3.2, altitude: 3.8, speed: 0.3, phase: 5.2, wobble: 1.08 },
  { x: 438, z: 92, radius: 2.9, altitude: 3.6, speed: 0.28, phase: 2.1, wobble: 1.32 },
  { x: -396, z: -312, radius: 3.6, altitude: 4.1, speed: 0.24, phase: 0.7, wobble: 0.86 },
];

export function createAlienWaterCreatures(
  scene: THREE.Scene,
  heightAt: HeightSampler
): { creatureGroup: THREE.Group; update: (elapsed: number) => void } {
  const creatureGroup = new THREE.Group();
  scene.add(creatureGroup);

  const creatures = creatureSpecs.map((spec, index) => {
    const anchor = new THREE.Vector3(spec.x, 0, spec.z);
    const route = makePatrolRoute(spec.angle, spec.hopDistance, index);
    const root = makeCreature(index);
    root.scale.multiplyScalar(spec.scale ?? 1);
    placeObjectOnPlanet(root, spec.x, spec.z, heightAt(spec.x, spec.z) + 0.08, new THREE.Euler(0, -spec.angle + Math.PI * 0.5, 0));
    creatureGroup.add(root);

    return {
      root,
      body: root.userData.body as THREE.Mesh,
      eyes: root.userData.eyes as THREE.Group,
      feet: root.userData.feet as THREE.Mesh[],
      anchor,
      route,
      phase: spec.phase,
      interval: spec.interval,
    } satisfies Creature;
  });

  return {
    creatureGroup,
    update: (elapsed) => {
      creatures.forEach((creature, index) => {
        const rawCycle = (elapsed + creature.phase) / creature.interval;
        const hopIndex = Math.floor(rawCycle);
        const cycle = rawCycle - hopIndex;
        const hopActive = cycle < 0.42;
        const hopT = hopActive ? THREE.MathUtils.smoothstep(cycle / 0.42, 0, 1) : 0;
        const start = creature.route[hopIndex % creature.route.length];
        const end = creature.route[(hopIndex + 1) % creature.route.length];
        const local = new THREE.Vector3().lerpVectors(start, end, hopActive ? hopT : 1);
        const x = creature.anchor.x + local.x;
        const z = creature.anchor.z + local.z;
        const hopArc = hopActive ? Math.sin(hopT * Math.PI) * 0.62 : 0;
        const idleBob = hopActive ? 0 : Math.sin(elapsed * 3.1 + index) * 0.025;
        const facing = new THREE.Vector3().subVectors(end, start);

        placeObjectOnPlanet(
          creature.root,
          x,
          z,
          heightAt(x, z) + hopArc + idleBob + 0.08,
          new THREE.Euler(0, Math.atan2(facing.x, facing.z), hopActive ? Math.sin(hopT * Math.PI) * 0.12 * Math.sign(facing.x || 1) : 0)
        );
        creature.body.scale.set(1 + hopArc * 0.16, 1 - hopArc * 0.08, 1 + hopArc * 0.1);
        creature.eyes.position.y = 0.34 + hopArc * 0.05;
        creature.feet.forEach((foot, footIndex) => {
          foot.position.z = (footIndex === 0 ? -0.28 : 0.28) - hopArc * 0.12;
          foot.rotation.x = hopActive ? -0.42 + hopArc * 0.25 : -0.42;
        });
      });
    },
  };
}

export function createRareFlyingBeetles(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  obstacles: SolidObstacle[] = []
): {
  beetleGroup: THREE.Group;
  update: (elapsed: number, focus: LocalPlanetPoint) => void;
  getState: () => { total: number; visible: number; nearestObstacleClearance: number };
} {
  const beetleGroup = new THREE.Group();
  beetleGroup.name = "rare-flying-beetles";
  scene.add(beetleGroup);

  const beetles = beetleSpecs.map((spec, index) => {
    const root = makeBeetle(index);
    root.scale.multiplyScalar(spec.scale ?? 1);
    beetleGroup.add(root);

    return {
      root,
      wings: root.userData.wings as THREE.Mesh[],
      anchor: { x: spec.x, z: spec.z },
      radius: spec.radius,
      altitude: spec.altitude,
      speed: spec.speed,
      phase: spec.phase,
      wobble: spec.wobble,
      localPosition: { x: spec.x, z: spec.z },
      nearestObstacleClearance: Number.POSITIVE_INFINITY,
    } satisfies Beetle;
  });

  return {
    beetleGroup,
    update: (elapsed, focus) => {
      beetles.forEach((beetle, index) => {
        const distanceToFocus = surfaceDistanceBetweenLocal(focus, beetle.anchor);
        if (distanceToFocus > 240) {
          beetle.root.visible = false;
          return;
        }

        beetle.root.visible = true;
        const t = elapsed * beetle.speed + beetle.phase;
        const nextT = t + 0.08;
        const current = steerBeetleAroundObstacles(beetlePosition(beetle, t), obstacles, t + beetle.wobble);
        const next = steerBeetleAroundObstacles(beetlePosition(beetle, nextT), obstacles, nextT + beetle.wobble);
        const heading = Math.atan2(next.x - current.x, next.z - current.z);
        const wingBeat = Math.sin(elapsed * 24 + index * 0.8);
        const roll = Math.sin(t * 1.7 + beetle.wobble) * 0.22;
        const bob = Math.sin(t * 2.4 + beetle.wobble) * 0.28;
        beetle.localPosition = current;
        beetle.nearestObstacleClearance = current.nearestObstacleClearance;

        placeObjectOnPlanet(
          beetle.root,
          current.x,
          current.z,
          heightAt(current.x, current.z) + beetle.altitude + bob + current.altitudeLift,
          new THREE.Euler(Math.sin(t * 1.3) * 0.08, heading, roll)
        );
        beetle.wings.forEach((wing, wingIndex) => {
          wing.rotation.z = (wingIndex === 0 ? 0.82 : -0.82) + wingBeat * (wingIndex === 0 ? 0.42 : -0.42);
        });
      });
    },
    getState: () => ({
      total: beetles.length,
      visible: beetles.filter((beetle) => beetle.root.visible).length,
      nearestObstacleClearance: beetles.reduce(
        (nearest, beetle) => (beetle.root.visible ? Math.min(nearest, beetle.nearestObstacleClearance) : nearest),
        Number.POSITIVE_INFINITY
      ),
    }),
  };
}

function makePatrolRoute(angle: number, hopDistance: number, seed: number): THREE.Vector3[] {
  const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-forward.z, 0, forward.x);
  const tight = hopDistance * 0.55;
  const wide = hopDistance * (0.92 + (seed % 2) * 0.22);
  return [
    forward.clone().multiplyScalar(-tight).add(side.clone().multiplyScalar(-0.18)),
    forward.clone().multiplyScalar(wide).add(side.clone().multiplyScalar(0.2)),
    forward.clone().multiplyScalar(wide * 0.45).add(side.clone().multiplyScalar(0.82)),
    forward.clone().multiplyScalar(-wide * 0.72).add(side.clone().multiplyScalar(0.52)),
    forward.clone().multiplyScalar(-tight * 0.35).add(side.clone().multiplyScalar(-0.42)),
  ];
}

function makeCreature(seed: number): THREE.Group {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x6cffbc : 0x7de7ff });
  const bellyMaterial = new THREE.MeshBasicMaterial({ color: 0xff7bd4 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x24145f });
  const crestMaterial = new THREE.MeshBasicMaterial({ color: 0xffe45b });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), bodyMaterial);
  body.scale.set(1.18, 0.58, 0.92);
  body.position.y = 0.28;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 5), bodyMaterial);
  head.position.set(0, 0.33, 0.3);
  head.scale.set(1.08, 0.72, 0.78);
  root.add(head);

  const belly = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), bellyMaterial);
  belly.position.set(0, 0.25, 0.49);
  belly.rotation.x = -0.42;
  belly.scale.set(1.2, 0.58, 1);
  root.add(belly);

  const eyes = new THREE.Group();
  [-0.16, 0.16].forEach((x) => {
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), bodyMaterial);
    brow.position.set(x, 0.48, 0.24);
    brow.scale.set(1, 0.72, 0.82);
    eyes.add(brow);

    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), eyeMaterial);
    eye.position.set(x, 0.51, 0.31);
    eye.scale.set(0.82, 1.12, 0.58);
    eyes.add(eye);
  });
  root.add(eyes);

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), crestMaterial);
  crest.position.set(0, 0.52, -0.04);
  crest.rotation.x = -0.55;
  root.add(crest);

  const feet = [-0.24, 0.24].map((x) => {
    const foot = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16, 0), bellyMaterial);
    foot.position.set(x, 0.08, 0.3);
    foot.rotation.set(-0.42, 0, x > 0 ? -0.2 : 0.2);
    foot.scale.set(1.25, 0.36, 0.8);
    root.add(foot);
    return foot;
  });

  root.userData = { body, eyes, feet };
  root.scale.setScalar(0.78);
  return root;
}

function beetlePosition(beetle: Beetle, t: number): LocalPlanetPoint {
  return {
    x: beetle.anchor.x + Math.sin(t) * beetle.radius + Math.sin(t * 2.3 + beetle.wobble) * beetle.radius * 0.28,
    z: beetle.anchor.z + Math.cos(t * 0.86 + beetle.wobble) * beetle.radius * 0.72 + Math.sin(t * 1.7) * beetle.radius * 0.18,
  };
}

function steerBeetleAroundObstacles(
  point: LocalPlanetPoint,
  obstacles: SolidObstacle[],
  fallbackAngle: number
): LocalPlanetPoint & { altitudeLift: number; nearestObstacleClearance: number } {
  let pushX = 0;
  let pushZ = 0;
  let altitudeLift = 0;
  let nearestObstacleClearance = Number.POSITIVE_INFINITY;

  obstacles.forEach((obstacle) => {
    const dx = point.x - obstacle.x;
    const dz = point.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const clearance = distance - obstacle.radius;
    nearestObstacleClearance = Math.min(nearestObstacleClearance, clearance);
    const avoidRadius = obstacle.radius + 2.35;
    if (distance >= avoidRadius) return;

    const fallbackX = Math.cos(fallbackAngle);
    const fallbackZ = Math.sin(fallbackAngle);
    const awayX = distance > 0.001 ? dx / distance : fallbackX;
    const awayZ = distance > 0.001 ? dz / distance : fallbackZ;
    const strength = 1 - THREE.MathUtils.smoothstep(distance, obstacle.radius + 0.45, avoidRadius);
    pushX += awayX * strength * (avoidRadius - distance) * 0.86;
    pushZ += awayZ * strength * (avoidRadius - distance) * 0.86;
    altitudeLift = Math.max(altitudeLift, strength * 0.95);
  });

  const steered = {
    x: point.x + pushX,
    z: point.z + pushZ,
  };

  if (pushX !== 0 || pushZ !== 0) {
    nearestObstacleClearance = obstacles.reduce((nearest, obstacle) => {
      const distance = Math.hypot(steered.x - obstacle.x, steered.z - obstacle.z);
      return Math.min(nearest, distance - obstacle.radius);
    }, Number.POSITIVE_INFINITY);
  }

  return {
    ...steered,
    altitudeLift,
    nearestObstacleClearance,
  };
}

function makeBeetle(seed: number): THREE.Group {
  const root = new THREE.Group();
  const shellMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x142a66 : 0x40216f });
  const bellyMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0xffd15e : 0x64ffd4 });
  const wingMaterial = new THREE.MeshBasicMaterial({
    color: seed % 2 === 0 ? 0x98fff1 : 0xff9fe7,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff9c });

  const abdomen = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), shellMaterial);
  abdomen.scale.set(0.84, 0.56, 1.26);
  abdomen.position.z = -0.06;
  root.add(abdomen);

  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), bellyMaterial);
  head.position.set(0, 0.02, 0.18);
  head.scale.set(0.95, 0.72, 0.82);
  root.add(head);

  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.18, 5), wingMaterial);
    wing.position.set(side * 0.12, 0.03, -0.02);
    wing.rotation.set(Math.PI * 0.5, 0, side * 0.82);
    wing.scale.set(0.7, 1.32, 1);
    root.add(wing);
    return wing;
  });

  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), eyeMaterial);
    eye.position.set(x, 0.07, 0.275);
    root.add(eye);
  });

  for (let i = 0; i < 3; i += 1) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.16), bellyMaterial);
      leg.position.set(side * 0.15, -0.07, -0.12 + i * 0.11);
      leg.rotation.set(0.15, side * 0.38, side * 0.46);
      root.add(leg);
    });
  }

  root.userData = { wings };
  root.scale.setScalar(0.86);
  return root;
}
