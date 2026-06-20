import * as THREE from "three";
import type { CollisionObstacle } from "./collision";
import { normalizePlanetCoords, placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

export type LandmarkZone = LocalPlanetPoint & {
  radius: number;
};

export type TempleLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  influenceRadius: number;
  fullInfluenceRadius: number;
  getInfluence: (playerPosition: LocalPlanetPoint, elapsed: number) => number;
  update: (elapsed: number) => void;
};

const templeSeed = "centauri-field-note-001-temple";
const templeClearanceRadius = 18;
const templeCollisionRadius = 3.2;
const templeInfluenceRadius = 46;
const templeFullInfluenceRadius = 13;

export function createTempleLandmark(scene: THREE.Scene, heightAt: HeightSampler): TempleLandmark {
  const position = chooseTemplePosition(heightAt);
  const approachPosition = normalizePlanetCoords(position.x - 17, position.z + 19);
  const group = makeTemple();
  const altitude = heightAt(position.x, position.z);
  const rotation = seededUnit(`${templeSeed}:rotation`) * Math.PI * 2;
  placeObjectOnPlanet(group, position.x, position.z, altitude + 0.04, new THREE.Euler(0, rotation, 0));
  scene.add(group);

  return {
    group,
    position,
    approachPosition,
    collision: { kind: "temple", x: position.x, z: position.z, radius: templeCollisionRadius },
    reservedZone: { x: position.x, z: position.z, radius: templeClearanceRadius },
    influenceRadius: templeInfluenceRadius,
    fullInfluenceRadius: templeFullInfluenceRadius,
    getInfluence: (playerPosition, elapsed) => templeInfluenceAt(playerPosition, position, elapsed),
    update: (elapsed) => {
      const inner = group.userData.innerGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      const cap = group.userData.cap as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!inner || !cap) return;
      inner.material.opacity = 0.34 + Math.sin(elapsed * 1.7) * 0.08;
      cap.rotation.y = elapsed * 0.18;
      cap.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.035);
    },
  };
}

export function isInLandmarkZone(point: LocalPlanetPoint, zones: LandmarkZone[]): boolean {
  return zones.some((zone) => surfaceDistanceBetweenLocal(point, zone) < zone.radius);
}

function chooseTemplePosition(heightAt: HeightSampler): LocalPlanetPoint {
  const random = createSeededRandom(templeSeed);
  let fallback = normalizePlanetCoords(260, -240);

  for (let i = 0; i < 64; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 175 + random() * 125;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius + 260, Math.sin(angle) * radius - 240);
    if (!isValidTempleTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  if (!isValidTempleTerrain(fallback, heightAt)) {
    fallback = normalizePlanetCoords(306, -268);
  }
  return fallback;
}

function isValidTempleTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.8) return false;

  const samples = [
    heightAt(point.x + 5, point.z),
    heightAt(point.x - 5, point.z),
    heightAt(point.x, point.z + 5),
    heightAt(point.x, point.z - 5),
  ];
  return samples.every((height) => height > 0.25 && Math.abs(height - centerHeight) < 5.2);
}

function templeInfluenceAt(playerPosition: LocalPlanetPoint, templePosition: LocalPlanetPoint, elapsed: number): number {
  const distance = surfaceDistanceBetweenLocal(playerPosition, templePosition);
  const proximity = 1 - THREE.MathUtils.smoothstep(distance, templeFullInfluenceRadius, templeInfluenceRadius);
  if (proximity <= 0) return 0;

  const slowPhase = Math.sin(elapsed * 0.72) * 0.5 + 0.5;
  const flicker = Math.sin(elapsed * 2.4 + Math.sin(elapsed * 0.41) * 2.2) * 0.5 + 0.5;
  const intermittent = THREE.MathUtils.smoothstep(slowPhase * 0.7 + flicker * 0.3, 0.42, 0.92);
  return proximity * THREE.MathUtils.lerp(0.18, 0.84, intermittent);
}

function makeTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-strange-temple-landmark";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x34206d });
  const stepMaterial = new THREE.MeshBasicMaterial({ color: 0x6a4bd6 });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x49d7c5 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const capMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36e });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 5.5, 1.0, 6), baseMaterial);
  plinth.position.y = 0.5;
  plinth.rotation.y = Math.PI / 6;
  group.add(plinth);

  const step = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 4.2, 0.72, 6), stepMaterial);
  step.position.y = 1.28;
  step.rotation.y = Math.PI / 6;
  group.add(step);

  const core = new THREE.Mesh(new THREE.ConeGeometry(2.35, 7.2, 5), baseMaterial);
  core.position.y = 5.2;
  core.scale.set(1, 1, 0.78);
  core.rotation.y = Math.PI / 5;
  group.add(core);

  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 4.4, 5), stepMaterial);
    pillar.position.set(Math.cos(angle) * 3.25, 3.25, Math.sin(angle) * 3.25);
    pillar.rotation.z = Math.sin(angle) * 0.16;
    pillar.rotation.x = -Math.cos(angle) * 0.16;
    group.add(pillar);

    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.52), faceMaterial);
    rune.position.set(Math.cos(angle) * 2.05, 3.55 + (i % 2) * 0.42, Math.sin(angle) * 2.05);
    rune.lookAt(0, rune.position.y, 0);
    group.add(rune);
  }

  const innerGlow = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), glowMaterial);
  innerGlow.position.y = 3.2;
  innerGlow.scale.set(1, 1.45, 1);
  group.add(innerGlow);

  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 0), capMaterial);
  cap.position.y = 8.95;
  cap.scale.set(1.1, 0.56, 1.1);
  group.add(cap);
  group.userData = { innerGlow, cap };

  return group;
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}

function seededUnit(seed: string): number {
  return createSeededRandom(seed)();
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
