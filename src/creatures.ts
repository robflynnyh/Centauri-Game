import * as THREE from "three";
import { placeObjectOnPlanet } from "./planet";

type HeightSampler = (x: number, z: number) => number;

type Creature = {
  root: THREE.Group;
  body: THREE.Mesh;
  eyes: THREE.Group;
  feet: THREE.Mesh[];
  anchor: THREE.Vector3;
  route: THREE.Vector3[];
  currentLocal: THREE.Vector3;
  hopStartLocal: THREE.Vector3;
  hopTargetLocal: THREE.Vector3;
  lastScaredHopIndex: number;
  scareBlend: number;
  phase: number;
  interval: number;
};

const scareSettings = {
  radius: 8.5,
  normalHopHeight: 0.62,
  normalHopSpeedMultiplier: 1,
  scaredHopHeight: 1.24,
  scaredHopSpeedMultiplier: 2,
  scaredHopDistance: 1.38,
  maxFleeDistanceFromWater: 3.4,
};

const creatureSpecs = [
  { x: 6.6, z: 11.2, angle: -1.05, phase: 0.2, interval: 2.35, hopDistance: 1.05, scale: 1.12 },
  { x: 2.1, z: 5.9, angle: 0.74, phase: 1.25, interval: 2.8, hopDistance: 0.82 },
  { x: -15.3, z: -4.5, angle: 2.48, phase: 0.92, interval: 3.05, hopDistance: 0.78 },
  { x: 20.5, z: -12.6, angle: -2.2, phase: 1.68, interval: 2.55, hopDistance: 0.92 },
  { x: -5.2, z: 8.7, angle: -0.2, phase: 0.55, interval: 2.15, hopDistance: 0.68 },
];

export function createAlienWaterCreatures(
  scene: THREE.Scene,
  heightAt: HeightSampler
): { creatureGroup: THREE.Group; update: (elapsed: number, delta: number, playerLocalPosition: THREE.Vector3) => void } {
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
      currentLocal: route[0].clone(),
      hopStartLocal: route[0].clone(),
      hopTargetLocal: route[0].clone(),
      lastScaredHopIndex: -1,
      scareBlend: 0,
      phase: spec.phase,
      interval: spec.interval,
    } satisfies Creature;
  });

  return {
    creatureGroup,
    update: (elapsed, delta, playerLocalPosition) => {
      creatures.forEach((creature, index) => {
        const idle = sampleHop(creature.route, elapsed, creature.phase, creature.interval / scareSettings.normalHopSpeedMultiplier);
        const roughX = creature.anchor.x + creature.currentLocal.x;
        const roughZ = creature.anchor.z + creature.currentLocal.z;
        const distanceToPlayer = Math.hypot(roughX - playerLocalPosition.x, roughZ - playerLocalPosition.z);
        const scareTarget = 1 - THREE.MathUtils.smoothstep(distanceToPlayer, scareSettings.radius * 0.72, scareSettings.radius);
        const scareRate = scareTarget > creature.scareBlend ? 4.4 : 1.15;
        creature.scareBlend = THREE.MathUtils.lerp(creature.scareBlend, scareTarget, 1 - Math.exp(-delta * scareRate));

        if (creature.scareBlend > 0.04) {
          const scaredInterval = creature.interval / scareSettings.scaredHopSpeedMultiplier;
          const rawScaredCycle = (elapsed + creature.phase) / scaredInterval;
          const scaredHopIndex = Math.floor(rawScaredCycle);
          const scaredCycle = rawScaredCycle - scaredHopIndex;

          if (scaredHopIndex !== creature.lastScaredHopIndex) {
            creature.lastScaredHopIndex = scaredHopIndex;
            creature.hopStartLocal.copy(creature.currentLocal);
            const fromPlayer = new THREE.Vector3(roughX - playerLocalPosition.x, 0, roughZ - playerLocalPosition.z);
            if (fromPlayer.lengthSq() < 0.001) fromPlayer.set(Math.sin(index + elapsed), 0, Math.cos(index + elapsed));
            fromPlayer.normalize();
            creature.hopTargetLocal.copy(creature.currentLocal).add(fromPlayer.multiplyScalar(scareSettings.scaredHopDistance));
            clampToWaterLeash(creature.hopTargetLocal);
          }

          const scaredHopActive = scaredCycle < 0.42;
          const scaredHopT = scaredHopActive ? THREE.MathUtils.smoothstep(scaredCycle / 0.42, 0, 1) : 1;
          const scaredLocal = new THREE.Vector3().lerpVectors(creature.hopStartLocal, creature.hopTargetLocal, scaredHopT);
          creature.currentLocal.lerp(scaredLocal, creature.scareBlend);
        } else {
          creature.currentLocal.lerp(idle.local, 1 - Math.exp(-delta * 1.65));
          creature.lastScaredHopIndex = -1;
        }

        const local = creature.currentLocal;
        const x = creature.anchor.x + local.x;
        const z = creature.anchor.z + local.z;
        const scaredCycle = ((elapsed + creature.phase) / (creature.interval / scareSettings.scaredHopSpeedMultiplier)) % 1;
        const scaredHopActive = scaredCycle < 0.42 && creature.scareBlend > 0.04;
        const scaredHopT = scaredHopActive ? THREE.MathUtils.smoothstep(scaredCycle / 0.42, 0, 1) : 0;
        const scaredArc = scaredHopActive ? Math.sin(scaredHopT * Math.PI) * scareSettings.scaredHopHeight : 0;
        const hopArc = THREE.MathUtils.lerp(idle.hopArc, scaredArc, creature.scareBlend);
        const idleBob = hopArc > 0.01 ? 0 : Math.sin(elapsed * 3.1 + index) * 0.025;
        const facing = creature.scareBlend > 0.08 ? new THREE.Vector3(x - playerLocalPosition.x, 0, z - playerLocalPosition.z) : idle.facing;
        if (facing.lengthSq() < 0.001) facing.set(0, 0, 1);

        placeObjectOnPlanet(
          creature.root,
          x,
          z,
          heightAt(x, z) + hopArc + idleBob + 0.08,
          new THREE.Euler(0, Math.atan2(facing.x, facing.z), hopArc > 0.01 ? Math.sin((scaredHopT || idle.hopT) * Math.PI) * 0.12 * Math.sign(facing.x || 1) : 0)
        );
        creature.body.scale.set(1 + hopArc * 0.16, 1 - hopArc * 0.08, 1 + hopArc * 0.1);
        creature.eyes.position.y = 0.34 + hopArc * 0.05 + creature.scareBlend * 0.06;
        creature.feet.forEach((foot, footIndex) => {
          foot.position.z = (footIndex === 0 ? -0.28 : 0.28) - hopArc * 0.12;
          foot.rotation.x = hopArc > 0.01 ? -0.42 + hopArc * 0.25 : -0.42;
        });
      });
    },
  };
}

function sampleHop(
  route: THREE.Vector3[],
  elapsed: number,
  phase: number,
  interval: number
): { local: THREE.Vector3; facing: THREE.Vector3; hopArc: number; hopT: number } {
  const rawCycle = (elapsed + phase) / interval;
  const hopIndex = Math.floor(rawCycle);
  const cycle = rawCycle - hopIndex;
  const hopActive = cycle < 0.42;
  const hopT = hopActive ? THREE.MathUtils.smoothstep(cycle / 0.42, 0, 1) : 0;
  const start = route[hopIndex % route.length];
  const end = route[(hopIndex + 1) % route.length];
  const local = new THREE.Vector3().lerpVectors(start, end, hopActive ? hopT : 1);
  const hopArc = hopActive ? Math.sin(hopT * Math.PI) * scareSettings.normalHopHeight : 0;
  const facing = new THREE.Vector3().subVectors(end, start);
  return { local, facing, hopArc, hopT };
}

function clampToWaterLeash(local: THREE.Vector3): void {
  const distanceFromWater = Math.hypot(local.x, local.z);
  if (distanceFromWater <= scareSettings.maxFleeDistanceFromWater) return;
  local.multiplyScalar(scareSettings.maxFleeDistanceFromWater / distanceFromWater);
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
