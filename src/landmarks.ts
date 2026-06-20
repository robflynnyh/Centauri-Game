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
const templeClearanceRadius = 24;
const templeCollisionRadius = 5.8;
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
      const gateGlow = group.userData.gateGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!inner || !gateGlow) return;
      const pulse = Math.sin(elapsed * 1.7) * 0.5 + 0.5;
      inner.material.opacity = 0.2 + pulse * 0.16;
      gateGlow.material.opacity = 0.16 + pulse * 0.18;
      gateGlow.scale.setScalar(0.96 + pulse * 0.05);
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

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x2d2369 });
  const shadowStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x201749 });
  const stepMaterial = new THREE.MeshBasicMaterial({ color: 0x6a4bd6 });
  const wornStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x8a65df });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x49d7c5 });
  const vineMaterial = new THREE.MeshBasicMaterial({ color: 0x69ff87 });
  const bloomMaterial = new THREE.MeshBasicMaterial({ color: 0xff75c9 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lowerBase = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.4, 0.72, 10), shadowStoneMaterial);
  lowerBase.position.y = 0.36;
  lowerBase.rotation.y = Math.PI / 10;
  lowerBase.scale.z = 0.82;
  group.add(lowerBase);

  const middleBase = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.1, 0.7, 10), baseMaterial);
  middleBase.position.y = 0.98;
  middleBase.rotation.y = Math.PI / 10;
  middleBase.scale.z = 0.78;
  group.add(middleBase);

  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.64, 8), stepMaterial);
  upperBase.position.y = 1.56;
  upperBase.rotation.y = Math.PI / 8;
  upperBase.scale.z = 0.74;
  group.add(upperBase);

  addGateSegment(group, 2.62, 0.42, -0.2, 0.16, 2.18, baseMaterial);
  addGateSegment(group, 2.62, 0.42, 2.96, 0.16, 1.62, baseMaterial);
  addGateSegment(group, 3.32, 0.18, 0.0, 0.18, 1.95, wornStoneMaterial);
  addGateSegment(group, 3.32, 0.18, 3.28, 0.18, 1.35, wornStoneMaterial);

  const gateGlow = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.05, 5, 34, Math.PI * 1.72), glowMaterial.clone());
  gateGlow.position.set(0, 4.52, -1.02);
  gateGlow.rotation.z = -0.42;
  group.add(gateGlow);

  const innerGlow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 14), glowMaterial);
  innerGlow.position.set(0, 4.48, -1.08);
  innerGlow.scale.set(1, 1.34, 1);
  group.add(innerGlow);

  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.18;
    const radius = i % 3 === 0 ? 3.95 : 3.35;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68 + (i % 2) * 0.22, 0.18), i % 2 === 0 ? faceMaterial : bloomMaterial);
    panel.position.set(Math.cos(angle) * radius, 1.95 + (i % 3) * 0.24, Math.sin(angle) * radius * 0.72);
    panel.rotation.y = -angle + Math.PI * 0.5;
    panel.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.08;
    group.add(panel);
  }

  addRuinedColumn(group, -3.95, -2.35, 3.25, -0.18, stepMaterial, faceMaterial);
  addRuinedColumn(group, 4.32, -1.85, 2.28, 0.26, stepMaterial, faceMaterial);
  addRuinedColumn(group, -4.82, 1.62, 1.7, -0.42, wornStoneMaterial, faceMaterial);
  addRuinedColumn(group, 3.7, 2.08, 1.28, 0.52, wornStoneMaterial, faceMaterial);

  addSlab(group, -2.4, 3.15, 2.4, 0.34, 0.38, shadowStoneMaterial);
  addSlab(group, 2.95, 2.9, 1.8, -0.56, -0.22, stepMaterial);
  addSlab(group, -5.4, -0.2, 1.6, 0.9, 0.5, wornStoneMaterial);
  addSlab(group, 5.2, 0.88, 1.35, -0.68, -0.48, baseMaterial);

  addVine(group, -2.45, -1.28, 3.8, 0.22, vineMaterial);
  addVine(group, 2.12, -1.18, 3.2, -0.34, vineMaterial);
  addVine(group, -4.1, 0.72, 1.4, 0.82, vineMaterial);

  for (let i = 0; i < 6; i += 1) {
    const bloom = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + (i % 2) * 0.04, 0), bloomMaterial);
    const angle = i * 1.13 + 0.4;
    bloom.position.set(Math.cos(angle) * 4.8, 0.95 + (i % 3) * 0.16, Math.sin(angle) * 3.2);
    group.add(bloom);
  }

  group.userData = { innerGlow, gateGlow };

  return group;
}

function addGateSegment(
  group: THREE.Group,
  radius: number,
  tubeRadius: number,
  rotation: number,
  lean: number,
  arc: number,
  material: THREE.Material
): void {
  const segment = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 6, 18, arc), material);
  segment.position.set(0, 4.52, -1.0);
  segment.rotation.set(lean, 0, rotation);
  group.add(segment);
}

function addRuinedColumn(
  group: THREE.Group,
  x: number,
  z: number,
  height: number,
  lean: number,
  material: THREE.Material,
  glyphMaterial: THREE.Material
): void {
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.52, height, 5), material);
  column.position.set(x, 1.55 + height * 0.5, z);
  column.rotation.set(lean * 0.28, 0.2, lean);
  group.add(column);

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.42, 0.8), material);
  top.position.set(x + Math.sin(lean) * 0.38, 1.84 + height, z);
  top.rotation.set(lean * 0.18, 0.36, lean * 0.5);
  group.add(top);

  const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.42), glyphMaterial);
  glyph.position.set(x, 1.9 + height * 0.38, z + 0.5);
  glyph.rotation.y = 0.1;
  group.add(glyph);
}

function addSlab(
  group: THREE.Group,
  x: number,
  z: number,
  size: number,
  rotation: number,
  tilt: number,
  material: THREE.Material
): void {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 0.42, size * 0.58), material);
  slab.position.set(x, 0.55, z);
  slab.rotation.set(tilt, rotation, tilt * 0.35);
  group.add(slab);
}

function addVine(group: THREE.Group, x: number, z: number, height: number, twist: number, material: THREE.Material): void {
  const segments = 5;
  for (let i = 0; i < segments; i += 1) {
    const t = i / (segments - 1);
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.12), material);
    vine.position.set(x + Math.sin(t * Math.PI * 2 + twist) * 0.22, 1.2 + t * height, z + Math.cos(t * Math.PI * 2 + twist) * 0.16);
    vine.rotation.set(0.24 + t * 0.4, twist + t * 1.7, 0.32);
    group.add(vine);
  }
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
