import * as THREE from "three";

type HeightSampler = (x: number, z: number) => number;

type Creature = {
  root: THREE.Group;
  body: THREE.Mesh;
  eyes: THREE.Group;
  feet: THREE.Mesh[];
  anchor: THREE.Vector3;
  direction: THREE.Vector3;
  phase: number;
  interval: number;
  hopDistance: number;
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
): { creatureGroup: THREE.Group; update: (elapsed: number) => void } {
  const creatureGroup = new THREE.Group();
  scene.add(creatureGroup);

  const creatures = creatureSpecs.map((spec, index) => {
    const anchor = new THREE.Vector3(spec.x, heightAt(spec.x, spec.z), spec.z);
    const direction = new THREE.Vector3(Math.cos(spec.angle), 0, Math.sin(spec.angle)).normalize();
    const root = makeCreature(index);
    root.scale.multiplyScalar(spec.scale ?? 1);
    root.position.copy(anchor);
    root.rotation.y = -spec.angle + Math.PI * 0.5;
    creatureGroup.add(root);

    return {
      root,
      body: root.userData.body as THREE.Mesh,
      eyes: root.userData.eyes as THREE.Group,
      feet: root.userData.feet as THREE.Mesh[],
      anchor,
      direction,
      phase: spec.phase,
      interval: spec.interval,
      hopDistance: spec.hopDistance,
    } satisfies Creature;
  });

  return {
    creatureGroup,
    update: (elapsed) => {
      creatures.forEach((creature, index) => {
        const cycle = ((elapsed + creature.phase) % creature.interval) / creature.interval;
        const hopActive = cycle < 0.42;
        const hopT = hopActive ? THREE.MathUtils.smoothstep(cycle / 0.42, 0, 1) : 0;
        const directionFlip = Math.floor((elapsed + creature.phase) / creature.interval) % 2 === 0 ? 1 : -1;
        const drift = Math.sin(elapsed * 0.65 + index * 1.7) * 0.14;
        const hopOffset = (hopT - 0.5) * creature.hopDistance * directionFlip;
        const side = new THREE.Vector3(-creature.direction.z, 0, creature.direction.x).multiplyScalar(drift);
        const x = creature.anchor.x + creature.direction.x * hopOffset + side.x;
        const z = creature.anchor.z + creature.direction.z * hopOffset + side.z;
        const hopArc = hopActive ? Math.sin(hopT * Math.PI) * 0.62 : 0;
        const idleBob = Math.sin(elapsed * 3.1 + index) * 0.025;

        creature.root.position.set(x, heightAt(x, z) + hopArc + idleBob + 0.08, z);
        creature.root.rotation.y = Math.atan2(creature.direction.x * directionFlip, creature.direction.z * directionFlip);
        creature.root.rotation.z = hopActive ? Math.sin(hopT * Math.PI) * 0.16 * directionFlip : 0;
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

function makeCreature(seed: number): THREE.Group {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x6cffbc : 0x7de7ff });
  const bellyMaterial = new THREE.MeshBasicMaterial({ color: 0xff7bd4 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x24145f });
  const crestMaterial = new THREE.MeshBasicMaterial({ color: 0xffe45b });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), bodyMaterial);
  body.scale.set(1.18, 0.62, 0.86);
  body.position.y = 0.28;
  root.add(body);

  const belly = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), bellyMaterial);
  belly.position.set(0, 0.25, 0.3);
  belly.rotation.x = -0.22;
  belly.scale.set(1.2, 0.58, 1);
  root.add(belly);

  const eyes = new THREE.Group();
  [-0.16, 0.16].forEach((x) => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 5), bodyMaterial);
    stalk.position.set(x, 0.42, 0.12);
    stalk.rotation.z = x * 0.7;
    eyes.add(stalk);

    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), eyeMaterial);
    eye.position.set(x * 1.12, 0.55, 0.16);
    eye.scale.set(1, 1.35, 0.8);
    eyes.add(eye);
  });
  root.add(eyes);

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), crestMaterial);
  crest.position.set(0, 0.58, -0.08);
  crest.rotation.x = -0.55;
  root.add(crest);

  const feet = [-0.24, 0.24].map((x) => {
    const foot = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16, 0), bellyMaterial);
    foot.position.set(x, 0.08, 0.26);
    foot.rotation.set(-0.42, 0, x > 0 ? -0.2 : 0.2);
    foot.scale.set(1.25, 0.36, 0.8);
    root.add(foot);
    return foot;
  });

  root.userData = { body, eyes, feet };
  root.scale.setScalar(0.78);
  return root;
}
