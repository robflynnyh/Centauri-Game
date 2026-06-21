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
  noteSource: {
    noteId: "temple-gate";
    position: LocalPlanetPoint;
    radius: number;
  };
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  influenceRadius: number;
  fullInfluenceRadius: number;
  getInfluence: (playerPosition: LocalPlanetPoint, elapsed: number) => number;
  update: (elapsed: number) => void;
};

export type ObservatoryLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "observatory-sightline";
    position: LocalPlanetPoint;
    radius: number;
  };
  telescope: {
    usePosition: LocalPlanetPoint;
    viewPosition: LocalPlanetPoint;
    yaw: number;
    pitch: number;
    viewHeight: number;
    interactionRadius: number;
  };
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  update: (elapsed: number) => void;
};

const templeSeed = "centauri-field-note-001-temple";
const templeClearanceRadius = 24;
const templeCollisionRadius = 5.8;
const templeInfluenceRadius = 46;
const templeFullInfluenceRadius = 13;
const templeNoteRadius = 12.5;
const observatorySeed = "centauri-field-note-observatory-telescope";
const observatoryClearanceRadius = 34;
const observatoryCollisionRadius = 4.8;
const observatoryNoteRadius = 12;
const telescopeInteractionRadius = 7.4;

export function createTempleLandmark(scene: THREE.Scene, heightAt: HeightSampler): TempleLandmark {
  const position = chooseTemplePosition(heightAt);
  const approachPosition = normalizePlanetCoords(position.x - 17, position.z + 19);
  const notePosition = normalizePlanetCoords(position.x - 8.2, position.z + 7.4);
  const group = makeTemple();
  const altitude = heightAt(position.x, position.z);
  const rotation = seededUnit(`${templeSeed}:rotation`) * Math.PI * 2;
  placeObjectOnPlanet(group, position.x, position.z, altitude + 0.04, new THREE.Euler(0, rotation, 0));
  scene.add(group);

  const noteMarker = makeTempleNoteMarker();
  placeObjectOnPlanet(noteMarker, notePosition.x, notePosition.z, heightAt(notePosition.x, notePosition.z) + 0.02, new THREE.Euler(0, rotation + 0.42, 0));
  scene.add(noteMarker);

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "temple-gate",
      position: notePosition,
      radius: templeNoteRadius,
    },
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

export function createObservatoryLandmark(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[] = []
): ObservatoryLandmark {
  const position = chooseObservatoryPosition(heightAt, avoidZones);
  const yaw = seededUnit(`${observatorySeed}:yaw`) * Math.PI * 2;
  const sightline = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const behindSightline = { x: -sightline.x, z: -sightline.z };
  const sideSightline = { x: sightline.z, z: -sightline.x };
  const approachPosition = offsetLocal(position, behindSightline, 17);
  const usePosition = offsetLocal(position, behindSightline, 3.6);
  const viewPosition = offsetLocal(position, behindSightline, 2.2);
  const notePosition = offsetLocal(position, sideSightline, 5.6);
  const altitude = heightAt(position.x, position.z);
  const viewHeight = heightAt(viewPosition.x, viewPosition.z) + 2.35;
  const group = makeObservatory();
  placeObjectOnPlanet(group, position.x, position.z, altitude + 0.04, new THREE.Euler(0, yaw, 0));
  scene.add(group);

  const noteMarker = makeObservatoryNoteMarker();
  placeObjectOnPlanet(
    noteMarker,
    notePosition.x,
    notePosition.z,
    heightAt(notePosition.x, notePosition.z) + 0.03,
    new THREE.Euler(0, yaw + Math.PI * 0.18, 0)
  );
  scene.add(noteMarker);

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "observatory-sightline",
      position: notePosition,
      radius: observatoryNoteRadius,
    },
    telescope: {
      usePosition,
      viewPosition,
      yaw,
      pitch: 0.26,
      viewHeight,
      interactionRadius: telescopeInteractionRadius,
    },
    collision: { kind: "observatory", x: position.x, z: position.z, radius: observatoryCollisionRadius },
    reservedZone: { x: position.x, z: position.z, radius: observatoryClearanceRadius },
    update: (elapsed) => {
      const lensGlow = group.userData.lensGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      const reticle = group.userData.reticle as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!lensGlow || !reticle) return;
      const pulse = Math.sin(elapsed * 1.1 + 0.6) * 0.5 + 0.5;
      lensGlow.material.opacity = 0.2 + pulse * 0.18;
      reticle.material.opacity = 0.34 + pulse * 0.22;
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

function chooseObservatoryPosition(heightAt: HeightSampler, avoidZones: LandmarkZone[]): LocalPlanetPoint {
  const random = createSeededRandom(observatorySeed);
  const fallbackPositions = [
    normalizePlanetCoords(-430, 312),
    normalizePlanetCoords(-388, 246),
    normalizePlanetCoords(-510, 188),
  ];

  for (let i = 0; i < 96; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 210 + random() * 210;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius - 360, Math.sin(angle) * radius + 260);
    if (isInLandmarkZone(candidate, avoidZones)) continue;
    if (!isValidObservatoryTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  return fallbackPositions.find((point) => !isInLandmarkZone(point, avoidZones) && isValidObservatoryTerrain(point, heightAt)) ?? fallbackPositions[0];
}

function isValidObservatoryTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.9) return false;

  const samples = [
    heightAt(point.x + 6, point.z),
    heightAt(point.x - 6, point.z),
    heightAt(point.x, point.z + 6),
    heightAt(point.x, point.z - 6),
    heightAt(point.x + 11, point.z + 3),
    heightAt(point.x - 8, point.z - 8),
  ];
  return samples.every((height) => height > 0.25 && Math.abs(height - centerHeight) < 6.4);
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
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lowerBase = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 8.2, 0.78, 8), shadowStoneMaterial);
  lowerBase.position.y = 0.36;
  lowerBase.rotation.y = Math.PI / 8;
  lowerBase.scale.z = 0.74;
  group.add(lowerBase);

  const middleBase = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 6.6, 0.86, 8), baseMaterial);
  middleBase.position.y = 1.08;
  middleBase.rotation.y = Math.PI / 8;
  middleBase.scale.z = 0.68;
  group.add(middleBase);

  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 5.0, 0.74, 6), stepMaterial);
  upperBase.position.y = 1.78;
  upperBase.rotation.y = Math.PI / 6;
  upperBase.scale.z = 0.64;
  group.add(upperBase);

  addPrism(group, [
    [-3.95, 1.72],
    [-2.38, 1.92],
    [-2.66, 6.25],
    [-3.58, 6.78],
  ], 1.08, baseMaterial, -1.08);
  addPrism(group, [
    [2.32, 1.9],
    [3.88, 1.68],
    [3.54, 5.74],
    [2.72, 6.34],
  ], 1.08, baseMaterial, -1.08);
  addPrism(group, [
    [-2.82, 6.08],
    [0.95, 6.24],
    [2.26, 7.06],
    [-1.88, 7.34],
  ], 1, wornStoneMaterial, -1.08);
  addPrism(group, [
    [1.28, 5.9],
    [2.92, 5.58],
    [2.46, 6.5],
    [1.02, 6.86],
  ], 1.06, shadowStoneMaterial, -1.04);

  addGateSegment(group, 2.62, 0.58, -0.12, 0.06, Math.PI * 1.36, baseMaterial);
  addGateSegment(group, 3.24, 0.24, -0.03, 0.06, Math.PI * 1.18, wornStoneMaterial);

  const gateGlow = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.08, 5, 28, Math.PI * 1.42), glowMaterial.clone());
  gateGlow.position.set(0, 4.34, -1.52);
  gateGlow.rotation.z = -0.18;
  group.add(gateGlow);

  const innerGlow = new THREE.Mesh(new THREE.CircleGeometry(1.16, 10), glowMaterial);
  innerGlow.position.set(0, 4.22, -1.56);
  innerGlow.scale.set(1, 1.32, 1);
  group.add(innerGlow);

  addGlyphPanel(group, -3.15, 3.02, 0.5, 1.55, 0.08, faceMaterial, -0.47);
  addGlyphPanel(group, 3.04, 2.82, 0.5, 1.32, -0.08, faceMaterial, -0.47);
  addGlyphPanel(group, 0.0, 2.48, 1.64, 0.42, 0, faceMaterial, 3.18);

  addRuinedColumn(group, -4.15, -1.95, 2.7, -0.18, stepMaterial, faceMaterial);
  addRuinedColumn(group, 4.25, -1.68, 2.08, 0.24, wornStoneMaterial, faceMaterial);

  addBroadVine(group, -2.88, -0.52, 2.32, 4.9, 0.32, vineMaterial);
  addBroadVine(group, 1.9, -0.5, 2.18, 3.9, -0.28, vineMaterial);

  addSlab(group, -4.8, 2.1, 2.8, 0.44, 0.18, shadowStoneMaterial);
  addSlab(group, 4.85, 1.25, 2.1, -0.36, -0.16, wornStoneMaterial);
  addSlab(group, -0.2, 3.35, 2.4, 0.04, 0.08, baseMaterial);

  group.userData = { innerGlow, gateGlow };

  return group;
}

function makeTempleNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple-field-note-glyph-marker";

  const shardMaterial = new THREE.MeshBasicMaterial({ color: 0x49d7c5 });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x201749 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.05, 0.28, 5), darkMaterial);
  base.position.y = 0.14;
  base.rotation.y = Math.PI / 5;
  group.add(base);

  const shard = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 4), shardMaterial);
  shard.position.y = 1.08;
  shard.rotation.set(0.16, Math.PI / 4, -0.08);
  group.add(shard);

  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), glowMaterial);
  cross.position.set(0.02, 1.1, 0.32);
  cross.rotation.z = 0.72;
  group.add(cross);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 4, 16), glowMaterial.clone());
  halo.position.y = 1.55;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  return group;
}

function makeObservatory(): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-observatory-telescope-landmark";

  const platformMaterial = new THREE.MeshBasicMaterial({ color: 0x202b68 });
  const rimMaterial = new THREE.MeshBasicMaterial({ color: 0x59c1d6 });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x101632 });
  const telescopeMaterial = new THREE.MeshBasicMaterial({ color: 0xe46bb9 });
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x8dffe0 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x82ffea,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6.4, 0.72, 8), platformMaterial);
  base.position.y = 0.36;
  base.rotation.y = Math.PI / 8;
  base.scale.z = 0.78;
  group.add(base);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.14, 4, 8), rimMaterial);
  rim.position.y = 0.86;
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.78;
  group.add(rim);

  const steps = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 1.4), darkMaterial);
  steps.position.set(0, 0.28, 4.55);
  steps.rotation.y = 0.04;
  group.add(steps);

  const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 2.55, 5), darkMaterial);
  pier.position.y = 2.0;
  group.add(pier);

  const cradle = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 1.0), rimMaterial);
  cradle.position.set(0, 3.28, -0.16);
  cradle.rotation.z = 0.05;
  group.add(cradle);

  addObservatoryLeg(group, -1.35, 0.9, 1.4, 0.42, darkMaterial);
  addObservatoryLeg(group, 1.28, 0.8, 1.28, -0.36, darkMaterial);
  addObservatoryLeg(group, 0.0, -1.55, 1.55, 0.02, darkMaterial);

  const tubeLength = 5.4;
  const tubeElevation = 0.28;
  const tubeGeometry = new THREE.CylinderGeometry(0.52, 0.66, tubeLength, 6);
  tubeGeometry.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeometry, telescopeMaterial);
  tube.position.set(0, 3.58, -1.35);
  tube.rotation.x = tubeElevation;
  group.add(tube);

  const apertureY = tube.position.y + Math.sin(tubeElevation) * (tubeLength * 0.5);
  const apertureZ = tube.position.z - Math.cos(tubeElevation) * (tubeLength * 0.5);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.58, 6), lensMaterial);
  lens.position.set(0, apertureY, apertureZ - 0.04);
  lens.rotation.x = Math.PI / 2 + tubeElevation;
  group.add(lens);

  const lensGlow = new THREE.Mesh(new THREE.CircleGeometry(0.98, 8), glowMaterial.clone());
  lensGlow.position.copy(lens.position);
  lensGlow.position.z -= 0.05;
  lensGlow.rotation.copy(lens.rotation);
  group.add(lensGlow);

  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.0, 5), darkMaterial);
  eyepiece.geometry.rotateX(Math.PI / 2);
  eyepiece.position.set(0, tube.position.y - Math.sin(tubeElevation) * 2.95, tube.position.z + Math.cos(tubeElevation) * 2.95);
  eyepiece.rotation.x = tubeElevation;
  group.add(eyepiece);

  const reticle = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 4, 16), glowMaterial.clone());
  reticle.position.set(0, apertureY + 0.03, apertureZ - 0.08);
  reticle.rotation.x = Math.PI / 2 + tubeElevation;
  group.add(reticle);

  const sightFin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.88, 3), rimMaterial);
  sightFin.position.set(0, 4.12, -1.2);
  sightFin.rotation.set(0.36, Math.PI, 0);
  group.add(sightFin);

  const backFlag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.72), rimMaterial);
  backFlag.position.set(-1.2, 2.15, 2.65);
  backFlag.rotation.set(0.05, -0.16, -0.12);
  group.add(backFlag);

  group.userData = { lensGlow, reticle };
  return group;
}

function addObservatoryLeg(group: THREE.Group, x: number, z: number, height: number, lean: number, material: THREE.Material): void {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, height, 0.26), material);
  leg.position.set(x, 0.8 + height * 0.5, z);
  leg.rotation.set(lean * 0.35, 0, lean);
  group.add(leg);
}

function makeObservatoryNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "observatory-field-note-star-marker";

  const plinthMaterial = new THREE.MeshBasicMaterial({ color: 0x101632 });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36a });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x82ffea,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 1.1, 0.28, 5), plinthMaterial);
  base.position.y = 0.14;
  group.add(base);

  const slate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.42, 0.18), faceMaterial);
  slate.position.set(0, 1.05, 0);
  slate.rotation.set(0.08, 0, 0.12);
  group.add(slate);

  const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), glowMaterial);
  vertical.position.set(0, 1.12, 0.14);
  group.add(vertical);

  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.12), glowMaterial.clone());
  horizontal.position.set(0, 1.12, 0.16);
  horizontal.rotation.z = 0.18;
  group.add(horizontal);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 4, 14), glowMaterial.clone());
  halo.position.y = 1.86;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

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

function addPrism(group: THREE.Group, points: Array<[number, number]>, depth: number, material: THREE.Material, z = 0): void {
  const halfDepth = depth * 0.5;
  const positions: number[] = [];
  points.forEach(([x, y]) => positions.push(x, y, z + halfDepth));
  points.forEach(([x, y]) => positions.push(x, y, z - halfDepth));

  const indices: number[] = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    indices.push(0, i, i + 1);
    indices.push(points.length, points.length + i + 1, points.length + i);
  }

  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    indices.push(i, next, points.length + next);
    indices.push(i, points.length + next, points.length + i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, material));
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
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, height, 5), material);
  column.position.set(x, 1.2 + height * 0.5, z);
  column.rotation.set(lean * 0.2, 0.14, lean);
  group.add(column);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.46, 0.92), material);
  cap.position.set(x + Math.sin(lean) * 0.32, 1.44 + height, z);
  cap.rotation.set(lean * 0.14, 0.24, lean * 0.45);
  group.add(cap);

  const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.5), glyphMaterial);
  glyph.position.set(x, 1.65 + height * 0.38, z + 0.54);
  glyph.rotation.y = 0.08;
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

function addGlyphPanel(
  group: THREE.Group,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  material: THREE.Material,
  z: number
): void {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.2), material);
  panel.position.set(x, y, z);
  panel.rotation.y = rotation;
  group.add(panel);
}

function addBroadVine(group: THREE.Group, x: number, z: number, y: number, height: number, lean: number, material: THREE.Material): void {
  const vine = new THREE.Mesh(new THREE.BoxGeometry(0.42, height, 0.24), material);
  vine.position.set(x, y + height * 0.5, z);
  vine.rotation.set(0.1, 0, lean);
  group.add(vine);

  const wrap = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.38, 0.24), material);
  wrap.position.set(x + Math.sign(lean || 1) * 0.42, y + height * 0.62, z + 0.04);
  wrap.rotation.set(0.08, 0, -lean * 0.7);
  group.add(wrap);
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

function offsetLocal(origin: LocalPlanetPoint, direction: LocalPlanetPoint, distance: number): LocalPlanetPoint {
  const length = Math.hypot(direction.x, direction.z) || 1;
  return normalizePlanetCoords(origin.x + (direction.x / length) * distance, origin.z + (direction.z / length) * distance);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
