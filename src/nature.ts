import * as THREE from "three";
import type { CollisionObstacle } from "./collision";
import { isInLandmarkZone, type LandmarkZone } from "./landmarks";
import { normalizePlanetCoords, placeObjectOnPlanet, pointOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";
import { isInMassiveMountainFootprint } from "./terrain";
import { oceanStateAt } from "./water";

type HeightSampler = (x: number, z: number) => number;
type AddCollisionObstacle = (obstacle: CollisionObstacle) => void;
type SetDynamicCollisionObstacles = (obstacles: CollisionObstacle[]) => void;

export type NatureState = {
  centerX: number;
  centerZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  chunkSize: number;
  chunkCount: number;
  complexDetailRadius: number;
  complexFadeRadius: number;
  nearestBiomePatchDistance: number;
  fullDetailBiomePatches: number;
  generatedBiomePatches: number;
  generatedObjects: number;
  generatedObstacles: number;
  generatedReactiveFlora: number;
  generatedSeaweedPatches: number;
  generatedSeaweedBlades: number;
  nearestSeaweedDistance: number;
  nearestSeaweedFreezeAmount: number;
  seaweedSamples: SeaweedSample[];
  generatedJunglePatches: number;
  fullDetailJunglePatches: number;
  nearestJunglePatchDistance: number;
  jungleLargeTrees: number;
  jungleVines: number;
  jungleSamples: JungleTreeSample[];
};

export type NaturePerfState = {
  rebuilds: number;
  lastRebuildMs: number;
  maxRebuildMs: number;
  totalRebuildMs: number;
  lastChunkX: number;
  lastChunkZ: number;
};

type ReactiveStalk = {
  x: number;
  z: number;
  cap: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  capAltitude: number;
  capRotation: THREE.Euler;
  reaction: number;
};

type SeaweedBlade = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseLean: number;
  phase: number;
  waveAmount: number;
  restColour: THREE.Color;
};

type ReactiveSeaweedPatch = {
  x: number;
  z: number;
  blades: SeaweedBlade[];
  reaction: number;
  flatness: number;
};

type SeaweedSample = {
  x: number;
  z: number;
  bladeCount: number;
  nearestBiomeEdgeDistance: number;
  flatness: number;
  staticBend: number;
};

type BiomePatch = {
  x: number;
  z: number;
  radius: number;
};

type JunglePatch = BiomePatch & {
  cellX: number;
  cellZ: number;
};

type JungleTreeSample = {
  x: number;
  z: number;
  radius: number;
  treeCount: number;
  vineCount: number;
  nearestTreeSpacing: number;
};

export type JungleBiomeState = {
  isInside: boolean;
  activeAmount: number;
  floorAmount: number;
  distanceToCenter: number;
  distanceToEdge: number;
  patch: { x: number; z: number; radius: number };
  debugSpawn: { x: number; z: number; yaw: number };
  groundColour: string;
};

const capRestColour = new THREE.Color(0xff5c9e);
const capNearColour = new THREE.Color(0xfff06a);
const glowNearColour = new THREE.Color(0xffffb8);
const floraReactionRadius = 12;
const floraReactionFullRadius = 5.5;
const seaweedReactionRadius = 16;
const seaweedReactionFullRadius = 7;
const seaweedCellSize = 48;
const seaweedBiomeClearance = 38;
const seaweedMaxFlatness = 0.72;
const generatedNatureChunkSize = 96;
const generatedNatureChunkRadius = 3;
const generatedBiomeCellSize = generatedNatureChunkSize * 2;
const generatedComplexDetailRadius = 180;
const generatedComplexFadeRadius = 292;
const starterBiomeCellX = 0;
const starterBiomeCellZ = 0;
const starterBiomeCenter = { x: 8, z: 18 };
const jungleBiomeCellSize = generatedBiomeCellSize * 2;
const jungleDebugCellX = -2;
const jungleDebugCellZ = 0;
const jungleDebugPatch: JunglePatch = { cellX: jungleDebugCellX, cellZ: jungleDebugCellZ, x: -620, z: 180, radius: 74 };
const junglePatchFadeDistance = 24;
const jungleFloorColour = new THREE.Color(0x3dde5e);
const jungleFloorDeepColour = new THREE.Color(0x126d46);
const jungleFloorGlowColour = new THREE.Color(0x92ff72);
const jungleTerrainColourScratch = new THREE.Color();
const baseTreesPerChunk = 3;
const baseReactiveFloraPerChunk = 9;
const baseSproutsPerChunk = 6;
const baseRocksPerChunk = 3;
const basePoolChance = 0.22;
const baseStreamChance = 0.12;

export function getJungleDebugSpawn(): { x: number; z: number; yaw: number } {
  const patch = getJungleDebugPatch();
  const x = patch.x - patch.radius * 0.48;
  const z = patch.z + patch.radius * 0.26;
  return {
    x,
    z,
    yaw: Math.atan2(x - patch.x, z - patch.z),
  };
}

export function getJungleDebugPatch(): { x: number; z: number; radius: number } {
  return { x: jungleDebugPatch.x, z: jungleDebugPatch.z, radius: jungleDebugPatch.radius };
}

export function jungleBiomeStateAt(x: number, z: number): JungleBiomeState {
  const normalized = normalizePlanetCoords(x, z);
  const nearest = nearestJunglePatch(normalized.x, normalized.z);
  const distanceToCenter = nearest
    ? surfaceDistanceBetweenLocal(normalized, nearest.patch)
    : Number.POSITIVE_INFINITY;
  const distanceToEdge = nearest ? distanceToCenter - nearest.patch.radius : Number.POSITIVE_INFINITY;
  const floorAmount = nearest
    ? 1 - THREE.MathUtils.smoothstep(distanceToCenter, nearest.patch.radius, nearest.patch.radius + junglePatchFadeDistance)
    : 0;
  const activeAmount = nearest
    ? 1 - THREE.MathUtils.smoothstep(distanceToCenter, nearest.patch.radius + 18, nearest.patch.radius + junglePatchFadeDistance + 32)
    : 0;

  return {
    isInside: floorAmount > 0.5,
    activeAmount,
    floorAmount,
    distanceToCenter,
    distanceToEdge,
    patch: nearest ? { x: nearest.patch.x, z: nearest.patch.z, radius: nearest.patch.radius } : getJungleDebugPatch(),
    debugSpawn: getJungleDebugSpawn(),
    groundColour: `#${jungleFloorColour.getHexString()}`,
  };
}

export function jungleTerrainColourAt(x: number, z: number): THREE.Color | null {
  const normalized = normalizePlanetCoords(x, z);
  if (oceanStateAt(normalized.x, normalized.z).isInOcean) return null;
  const nearest = nearestJunglePatch(normalized.x, normalized.z);
  if (!nearest) return null;
  const floorAmount = 1 - THREE.MathUtils.smoothstep(nearest.distance, nearest.patch.radius, nearest.patch.radius + junglePatchFadeDistance);
  if (floorAmount <= 0) return null;

  const blockX = Math.floor(normalized.x / 7.5);
  const blockZ = Math.floor(normalized.z / 7.5);
  const fleck = Math.sin(blockX * 1.91 + blockZ * 0.73) * 0.5 + Math.cos(blockZ * 1.37 - blockX * 0.28) * 0.5;
  const glowAmount = THREE.MathUtils.clamp(0.28 + fleck * 0.16 + floorAmount * 0.34, 0, 1);
  jungleTerrainColourScratch.copy(jungleFloorDeepColour).lerp(jungleFloorColour, glowAmount);
  if (floorAmount > 0.72 && fleck > 0.35) {
    jungleTerrainColourScratch.lerp(jungleFloorGlowColour, (fleck - 0.35) * 0.18);
  }
  return jungleTerrainColourScratch;
}

export function getJungleDragonflyAnchors(): LocalPlanetPoint[] {
  return getStableJunglePatches()
    .flatMap((patch, patchIndex) => {
      const random = createChunkRandom(patch.cellX * 31 + 17, patch.cellZ * 29 - 41);
      const anchorCount = patchIndex === 0 ? 4 : 2;
      return Array.from({ length: anchorCount }, (_, index) => {
        const angle = random() * Math.PI * 2 + index * 1.7;
        const distance = patch.radius * (0.12 + random() * 0.42);
        return {
          x: patch.x + Math.cos(angle) * distance,
          z: patch.z + Math.sin(angle) * distance,
        };
      });
    })
    .slice(0, 24);
}

export function getJungleFrogSpawns(): {
  x: number;
  z: number;
  angle: number;
  phase: number;
  interval: number;
  hopDistance: number;
  scale?: number;
}[] {
  const patch = getJungleDebugPatch();
  return [
    { x: patch.x - 14.5, z: patch.z + 6.4, angle: -0.25, phase: 0.35, interval: 2.45, hopDistance: 0.98, scale: 1.04 },
    { x: patch.x + 7.6, z: patch.z - 12.2, angle: 2.34, phase: 1.12, interval: 2.75, hopDistance: 0.84 },
    { x: patch.x + 18.2, z: patch.z + 11.6, angle: -2.8, phase: 2.05, interval: 2.6, hopDistance: 0.9 },
  ];
}

export function populateNature(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  addCollisionObstacle: AddCollisionObstacle,
  setDynamicCollisionObstacles: SetDynamicCollisionObstacles = () => undefined,
  landmarkZones: LandmarkZone[] = []
): {
  floraGroup: THREE.Group;
  natureGroup: THREE.Group;
  updateFloraReactivity: (playerPosition: LocalPlanetPoint, delta: number, elapsed: number) => void;
  updateNatureChunks: (centerX: number, centerZ: number) => void;
  getNatureState: () => NatureState;
  getNaturePerfState: () => NaturePerfState;
} {
  const floraGroup = new THREE.Group();
  scene.add(floraGroup);

  const natureGroup = new THREE.Group();
  scene.add(natureGroup);

  const generatedNatureGroup = new THREE.Group();
  generatedNatureGroup.name = "generated-spherical-nature";
  scene.add(generatedNatureGroup);

  const stalkMaterial = new THREE.MeshBasicMaterial({ color: 0x55c7ba });
  const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x3f2b92 });
  const canopyMaterial = new THREE.MeshBasicMaterial({ color: 0x8dff86 });
  const canopyAccentMaterial = new THREE.MeshBasicMaterial({ color: 0xffb84f });
  const jungleTrunkMaterial = new THREE.MeshBasicMaterial({ color: 0x26347f });
  const jungleCanopyMaterial = new THREE.MeshBasicMaterial({ color: 0x38e970 });
  const jungleCanopyAccentMaterial = new THREE.MeshBasicMaterial({ color: 0xb8ff5f });
  const jungleVineMaterial = new THREE.MeshBasicMaterial({ color: 0x35c8a1 });
  const reedMaterial = new THREE.MeshBasicMaterial({ color: 0xc5ff4f });
  const bloomMaterial = new THREE.MeshBasicMaterial({ color: 0xff58df });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x8cffff,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });
  const stoneMaterial = new THREE.MeshBasicMaterial({ color: 0x6b55d8 });
  const reactiveStalks: ReactiveStalk[] = [];
  const reactiveSeaweedPatches: ReactiveSeaweedPatch[] = [];
  let generatedCenterChunkX = Number.NaN;
  let generatedCenterChunkZ = Number.NaN;
  let generatedObjectCount = 0;
  let generatedObstacleCount = 0;
  let generatedReactiveFloraCount = 0;
  let generatedSeaweedPatchCount = 0;
  let generatedSeaweedBladeCount = 0;
  let generatedBiomePatchCount = 0;
  let fullDetailBiomePatchCount = 0;
  let nearestBiomePatchDistance = Number.POSITIVE_INFINITY;
  let generatedJunglePatchCount = 0;
  let fullDetailJunglePatchCount = 0;
  let nearestJunglePatchDistance = Number.POSITIVE_INFINITY;
  let jungleLargeTreeCount = 0;
  let jungleVineCount = 0;
  let jungleSamples: JungleTreeSample[] = [];
  let nearestSeaweedDistance = Number.POSITIVE_INFINITY;
  let nearestSeaweedFreezeAmount = 0;
  let seaweedSamples: SeaweedSample[] = [];
  const perfState: NaturePerfState = {
    rebuilds: 0,
    lastRebuildMs: 0,
    maxRebuildMs: 0,
    totalRebuildMs: 0,
    lastChunkX: 0,
    lastChunkZ: 0,
  };

  const addReactiveFloraAt = (x: number, z: number, seed: number, angle: number, targetGroup = generatedNatureGroup): void => {
    const y = heightAt(x, z);

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 2.6 + (seed % 5) * 0.35, 5), stalkMaterial);
    placeObjectOnPlanet(stalk, x, z, y + 1.2, new THREE.Euler(0, 0, Math.sin(seed) * 0.18));
    targetGroup.add(stalk);

    const capGeometry = new THREE.OctahedronGeometry(0.5 + (seed % 4) * 0.12, 0);
    const capMaterial = new THREE.MeshBasicMaterial({ color: capRestColour });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    const capAltitude = y + 2.8 + (seed % 3) * 0.18;
    const capRotation = new THREE.Euler(seed * 0.12, seed * 0.2, seed * 0.07);
    placeObjectOnPlanet(cap, x, z, capAltitude, capRotation);
    targetGroup.add(cap);

    const glow = new THREE.Mesh(
      capGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: glowNearColour,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    placeObjectOnPlanet(glow, x, z, capAltitude, capRotation);
    glow.scale.setScalar(1.22);
    targetGroup.add(glow);
    reactiveStalks.push({ x, z, cap, glow, capAltitude, capRotation, reaction: 0 });
  };

  const addAlienTree = (
    x: number,
    z: number,
    scale: number,
    lean: number,
    targetGroup = natureGroup,
    dynamicObstacles?: CollisionObstacle[]
  ): void => {
    const y = heightAt(x, z);
    const tree = new THREE.Group();
    placeObjectOnPlanet(tree, x, z, y, new THREE.Euler(0, x * 0.11 + z * 0.07, 0));
    tree.scale.setScalar(scale);

    const trunkLeanX = Math.sin(lean) * 0.08;
    const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 3.7, 6), trunkMaterial);
    lowerTrunk.position.set(trunkLeanX, 1.78, 0);
    lowerTrunk.rotation.z = lean * 0.07;
    tree.add(lowerTrunk);

    const upperTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.35, 5), trunkMaterial);
    upperTrunk.position.set(trunkLeanX * 1.6, 3.92, 0);
    upperTrunk.rotation.z = lean * 0.05;
    tree.add(upperTrunk);

    const lowerCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 0), canopyAccentMaterial);
    lowerCrown.position.set(trunkLeanX * 1.5, 3.88, 0);
    lowerCrown.scale.set(1.28, 0.48, 1.22);
    lowerCrown.rotation.set(0.12, lean, 0.04);
    tree.add(lowerCrown);

    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), canopyMaterial);
    crown.position.set(trunkLeanX * 1.8, 4.38, 0);
    crown.scale.set(1.5, 0.76, 1.48);
    crown.rotation.set(0.16, lean, -0.04);
    tree.add(crown);

    const collar = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), canopyAccentMaterial);
    collar.position.set(trunkLeanX * 1.5, 4.05, 0);
    collar.scale.set(0.9, 0.5, 0.9);
    collar.rotation.set(0.12, lean, -0.06);
    tree.add(collar);

    for (let i = 0; i < 5; i += 1) {
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + i * 0.012, 0), bloomMaterial);
      const angle = i * 1.34 + lean;
      bead.position.set(trunkLeanX + Math.cos(angle) * 0.68, 3.66 - i * 0.2, Math.sin(angle) * 0.68);
      tree.add(bead);
    }

    targetGroup.add(tree);
    const obstacle = { kind: "tree" as const, x, z, radius: 1.15 * scale };
    if (dynamicObstacles) dynamicObstacles.push(obstacle);
    else addCollisionObstacle(obstacle);
  };

  const addJungleTree = (
    x: number,
    z: number,
    scale: number,
    lean: number,
    random: () => number,
    dynamicObstacles: CollisionObstacle[]
  ): number => {
    const y = heightAt(x, z);
    const tree = new THREE.Group();
    placeObjectOnPlanet(tree, x, z, y, new THREE.Euler(0, x * 0.08 + z * 0.05 + lean * 0.2, 0));
    tree.scale.setScalar(scale);

    const trunkLeanX = Math.sin(lean) * 0.18;
    const baseTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.08, 5.4, 7), jungleTrunkMaterial);
    baseTrunk.position.set(trunkLeanX * 0.4, 2.62, 0);
    baseTrunk.rotation.z = lean * 0.055;
    tree.add(baseTrunk);

    const highTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.68, 3.15, 6), jungleTrunkMaterial);
    highTrunk.position.set(trunkLeanX, 6.72, 0);
    highTrunk.rotation.z = lean * 0.045;
    tree.add(highTrunk);

    const branchMaterial = jungleTrunkMaterial;
    for (let i = 0; i < 4; i += 1) {
      const branchAngle = lean + i * Math.PI * 0.5 + random() * 0.35;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.6 + random() * 1.1, 5), branchMaterial);
      branch.position.set(trunkLeanX + Math.cos(branchAngle) * 0.95, 5.9 + random() * 0.9, Math.sin(branchAngle) * 0.95);
      branch.rotation.set(0.42 + random() * 0.18, branchAngle, Math.PI * 0.5 + lean * 0.03);
      tree.add(branch);
    }

    const crownSpecs = [
      { x: trunkLeanX * 1.2, y: 7.8, z: 0, sx: 3.65, sy: 0.72, sz: 3.15, material: jungleCanopyMaterial },
      { x: trunkLeanX * 1.8 - 1.2, y: 7.25, z: 0.75, sx: 2.75, sy: 0.55, sz: 2.2, material: jungleCanopyAccentMaterial },
      { x: trunkLeanX * 1.6 + 1.35, y: 7.05, z: -0.88, sx: 2.9, sy: 0.58, sz: 2.35, material: jungleCanopyMaterial },
      { x: trunkLeanX * 1.5 + 0.2, y: 8.42, z: 0.15, sx: 2.45, sy: 0.48, sz: 2.55, material: jungleCanopyAccentMaterial },
    ];
    crownSpecs.forEach((spec, index) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12 + index * 0.04, 0), spec.material);
      crown.position.set(spec.x, spec.y, spec.z);
      crown.scale.set(spec.sx, spec.sy, spec.sz);
      crown.rotation.set(0.08 + index * 0.06, lean + index * 0.62, -0.08 + index * 0.04);
      tree.add(crown);
    });

    const vineCount = 5 + Math.floor(random() * 4);
    for (let i = 0; i < vineCount; i += 1) {
      const angle = lean + i * 1.37 + random() * 0.34;
      const distance = 1.15 + random() * 1.45;
      const length = 1.8 + random() * 2.2;
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.042, length, 4), jungleVineMaterial);
      vine.position.set(trunkLeanX + Math.cos(angle) * distance, 6.25 - length * 0.35 + random() * 0.6, Math.sin(angle) * distance);
      vine.rotation.set(0.05 + Math.sin(angle) * 0.12, angle, Math.cos(angle) * 0.08);
      tree.add(vine);
    }

    for (let i = 0; i < 6; i += 1) {
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + random() * 0.05, 0), bloomMaterial);
      const angle = lean + i * 1.04;
      bead.position.set(trunkLeanX + Math.cos(angle) * (1.65 + random() * 0.9), 5.3 + random() * 1.6, Math.sin(angle) * (1.65 + random() * 0.9));
      bead.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      tree.add(bead);
    }

    generatedNatureGroup.add(tree);
    dynamicObstacles.push({ kind: "tree", x, z, radius: 2.35 * scale });
    return vineCount;
  };

  const addSproutAt = (x: number, z: number, seed: number, angle: number, targetGroup = natureGroup): void => {
    const y = heightAt(x, z);
    const sprout = new THREE.Group();
    placeObjectOnPlanet(sprout, x, z, y + 0.08, new THREE.Euler(0, angle, 0));

    const bladeCount = 3 + (seed % 4);
    for (let i = 0; i < bladeCount; i += 1) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8 + (seed % 5) * 0.09, 4), reedMaterial);
      const bladeAngle = (i / bladeCount) * Math.PI * 2;
      blade.position.set(Math.cos(bladeAngle) * 0.18, 0.36, Math.sin(bladeAngle) * 0.18);
      blade.rotation.set(0.22 + i * 0.06, 0, bladeAngle);
      sprout.add(blade);
    }

    if (seed % 3 === 0) {
      const bloom = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + (seed % 4) * 0.035, 0), bloomMaterial);
      bloom.position.y = 0.88;
      bloom.rotation.set(seed * 0.18, seed * 0.33, seed * 0.12);
      sprout.add(bloom);
    }

    targetGroup.add(sprout);
  };

  const addGeneratedRock = (x: number, z: number, size: number, rotation: THREE.Euler, dynamicObstacles: CollisionObstacle[]): void => {
    const y = heightAt(x, z);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stoneMaterial);
    placeObjectOnPlanet(stone, x, z, y + 0.7, rotation);
    generatedNatureGroup.add(stone);
    dynamicObstacles.push({ kind: "rock", x, z, radius: size * 0.72 });
  };

  const addSeaweedPatchAt = (x: number, z: number, seed: number, angle: number, flatness: number, nearestBiomeEdgeDistance: number): void => {
    const random = createChunkRandom(seed, Math.floor(seed * 0.37));
    const y = heightAt(x, z);
    const patch = new THREE.Group();
    placeObjectOnPlanet(patch, x, z, y + 0.04, new THREE.Euler(0, angle, 0));

    const bladeCount = 6 + Math.floor(random() * 9);
    const blades: SeaweedBlade[] = [];
    let strongestStaticBend = 0;
    for (let i = 0; i < bladeCount; i += 1) {
      const height = 1.05 + random() * 1.35;
      const width = 0.12 + random() * 0.1;
      const staticBend = 0.08 + random() * 0.16;
      const geometry = makeSeaweedBladeGeometry(width, height, staticBend, random() * Math.PI * 2);
      strongestStaticBend = Math.max(strongestStaticBend, staticBend);
      const restColour = new THREE.Color(0x54d65c);
      restColour.offsetHSL(0.035 + random() * 0.035, 0.02, -0.08 + random() * 0.12);
      const material = new THREE.MeshBasicMaterial({
        color: restColour,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.84 + random() * 0.12,
      });
      const blade = new THREE.Mesh(geometry, material);
      const bladeAngle = random() * Math.PI * 2;
      const distance = Math.pow(random(), 0.55) * (0.4 + random() * 0.55);
      const baseLean = (random() - 0.5) * 0.42;
      blade.position.set(Math.cos(bladeAngle) * distance, 0, Math.sin(bladeAngle) * distance);
      blade.rotation.set(0, bladeAngle + (i % 2) * Math.PI * 0.5, baseLean);
      blade.scale.y = 0.86 + random() * 0.22;
      patch.add(blade);
      blades.push({
        mesh: blade,
        baseLean,
        phase: random() * Math.PI * 2,
        waveAmount: 0.08 + random() * 0.08,
        restColour,
      });
    }

    generatedNatureGroup.add(patch);
    reactiveSeaweedPatches.push({ x, z, blades, reaction: 0, flatness });
    generatedSeaweedPatchCount += 1;
    generatedSeaweedBladeCount += bladeCount;
    seaweedSamples.push({ x, z, bladeCount, nearestBiomeEdgeDistance, flatness, staticBend: strongestStaticBend });
  };

  const rebuildGeneratedNature = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / generatedNatureChunkSize);
    const nextChunkZ = Math.floor(normalized.z / generatedNatureChunkSize);
    if (nextChunkX === generatedCenterChunkX && nextChunkZ === generatedCenterChunkZ) return;

    const rebuildStart = performance.now();
    disposeGeneratedNature(generatedNatureGroup);
    generatedNatureGroup.clear();
    generatedCenterChunkX = nextChunkX;
    generatedCenterChunkZ = nextChunkZ;
    generatedObjectCount = 0;
    generatedReactiveFloraCount = 0;
    generatedSeaweedPatchCount = 0;
    generatedSeaweedBladeCount = 0;
    generatedBiomePatchCount = 0;
    fullDetailBiomePatchCount = 0;
    nearestBiomePatchDistance = Number.POSITIVE_INFINITY;
    generatedJunglePatchCount = 0;
    fullDetailJunglePatchCount = 0;
    nearestJunglePatchDistance = Number.POSITIVE_INFINITY;
    jungleLargeTreeCount = 0;
    jungleVineCount = 0;
    nearestSeaweedDistance = Number.POSITIVE_INFINITY;
    nearestSeaweedFreezeAmount = 0;
    seaweedSamples = [];
    jungleSamples = [];
    reactiveStalks.length = 0;
    reactiveSeaweedPatches.length = 0;
    const dynamicObstacles: CollisionObstacle[] = [];
    const visibleBiomePatches: BiomePatch[] = [];

    const minX = (generatedCenterChunkX - generatedNatureChunkRadius) * generatedNatureChunkSize;
    const maxX = (generatedCenterChunkX + generatedNatureChunkRadius + 1) * generatedNatureChunkSize;
    const minZ = (generatedCenterChunkZ - generatedNatureChunkRadius) * generatedNatureChunkSize;
    const maxZ = (generatedCenterChunkZ + generatedNatureChunkRadius + 1) * generatedNatureChunkSize;
    const minBiomeCellX = Math.floor(minX / generatedBiomeCellSize) - 1;
    const maxBiomeCellX = Math.floor(maxX / generatedBiomeCellSize) + 1;
    const minBiomeCellZ = Math.floor(minZ / generatedBiomeCellSize) - 1;
    const maxBiomeCellZ = Math.floor(maxZ / generatedBiomeCellSize) + 1;

    for (let biomeCellZ = minBiomeCellZ; biomeCellZ <= maxBiomeCellZ; biomeCellZ += 1) {
      for (let biomeCellX = minBiomeCellX; biomeCellX <= maxBiomeCellX; biomeCellX += 1) {
        const random = createChunkRandom(biomeCellX * 7 + 3, biomeCellZ * 7 - 5);
        const starterBiome = biomeCellX === starterBiomeCellX && biomeCellZ === starterBiomeCellZ;
        const density = starterBiome ? 1.34 : chunkNatureDensity(biomeCellX, biomeCellZ);
        if (!starterBiome && density < 0.88 && random() < 0.45) continue;

        const clusterX = starterBiome
          ? starterBiomeCenter.x
          : biomeCellX * generatedBiomeCellSize + (0.3 + random() * 0.4) * generatedBiomeCellSize;
        const clusterZ = starterBiome
          ? starterBiomeCenter.z
          : biomeCellZ * generatedBiomeCellSize + (0.3 + random() * 0.4) * generatedBiomeCellSize;
        const clusterRadius = starterBiome ? 46 : 28 + random() * 18;
        if (isInMassiveMountainFootprint(clusterX, clusterZ, clusterRadius + 18)) continue;
        if (!starterBiome && jungleBiomeStateAt(clusterX, clusterZ).floorAmount > 0.18) continue;

        const distanceToFocus = surfaceDistanceBetweenLocal({ x: normalized.x, z: normalized.z }, { x: clusterX, z: clusterZ });
        const detailAmount = 1 - THREE.MathUtils.smoothstep(distanceToFocus, generatedComplexDetailRadius, generatedComplexFadeRadius);
        if (detailAmount <= 0.02) continue;

        generatedBiomePatchCount += 1;
        if (detailAmount >= 0.98) fullDetailBiomePatchCount += 1;
        nearestBiomePatchDistance = Math.min(nearestBiomePatchDistance, distanceToFocus);
        visibleBiomePatches.push({ x: clusterX, z: clusterZ, radius: clusterRadius });
        const transitionAmount = THREE.MathUtils.clamp((detailAmount - 0.16) / 0.84, 0, 1);
        const fullness = starterBiome ? 1.48 : density * (0.85 + random() * 0.38);
        const nearObjectScale = 0.56 + detailAmount * 0.44;
        const complexObjectScale = Math.pow(transitionAmount, 0.78);
        const waterDetailEnabled = detailAmount > 0.5;

        for (let i = 0; i < Math.round((baseTreesPerChunk * 2 + fullness * 5) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.68, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addAlienTree(point.x, point.z, 0.72 + random() * 0.58, random() * Math.PI * 2 - Math.PI, generatedNatureGroup, dynamicObstacles);
          generatedObjectCount += 1;
        }

        for (let i = 0; i < Math.round((baseReactiveFloraPerChunk * 3 + fullness * 24) * complexObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addReactiveFloraAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
          generatedObjectCount += 1;
          generatedReactiveFloraCount += 1;
        }

        for (let i = 0; i < Math.round((baseSproutsPerChunk * 2 + fullness * 13) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.9, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addSproutAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
          generatedObjectCount += 1;
        }

        for (let i = 0; i < Math.round((baseRocksPerChunk * 2 + fullness * 8) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 1.08, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addGeneratedRock(
            point.x,
            point.z,
            0.78 + random() * 1.2,
            new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
            dynamicObstacles
          );
          generatedObjectCount += 1;
        }

        const poolCount = waterDetailEnabled ? 1 + (random() < basePoolChance + fullness * 0.34 ? 1 : 0) + (random() < fullness * 0.18 ? 1 : 0) : 0;
        for (let i = 0; i < poolCount; i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.42, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addPool(generatedNatureGroup, heightAt, waterMaterial, stoneMaterial, point.x, point.z, 2.5 + random() * 2.4, random() * Math.PI);
          generatedObjectCount += 1;
        }

        const streamCount = waterDetailEnabled ? 1 + (random() < baseStreamChance + fullness * 0.25 ? 1 : 0) : 0;
        for (let i = 0; i < streamCount; i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.35, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addGeneratedStream(
            generatedNatureGroup,
            heightAt,
            waterMaterial,
            point.x,
            point.z,
            14 + random() * 20,
            random() * Math.PI * 2,
            random() * Math.PI * 2
          );
          generatedObjectCount += 1;
        }
      }
    }

    const minJungleCellX = Math.floor(minX / jungleBiomeCellSize) - 1;
    const maxJungleCellX = Math.floor(maxX / jungleBiomeCellSize) + 1;
    const minJungleCellZ = Math.floor(minZ / jungleBiomeCellSize) - 1;
    const maxJungleCellZ = Math.floor(maxZ / jungleBiomeCellSize) + 1;
    for (let cellZ = minJungleCellZ; cellZ <= maxJungleCellZ; cellZ += 1) {
      for (let cellX = minJungleCellX; cellX <= maxJungleCellX; cellX += 1) {
        if (!shouldPlaceJungleBiomeCell(cellX, cellZ)) continue;
        const patch = junglePatchForCell(cellX, cellZ);
        if (!isUsableJunglePatch(patch)) continue;

        const distanceToFocus = surfaceDistanceBetweenLocal({ x: normalized.x, z: normalized.z }, patch);
        const detailAmount = 1 - THREE.MathUtils.smoothstep(distanceToFocus, generatedComplexDetailRadius, generatedComplexFadeRadius);
        if (detailAmount <= 0.02) continue;

        generatedJunglePatchCount += 1;
        if (detailAmount >= 0.98) fullDetailJunglePatchCount += 1;
        nearestJunglePatchDistance = Math.min(nearestJunglePatchDistance, distanceToFocus);
        nearestBiomePatchDistance = Math.min(nearestBiomePatchDistance, distanceToFocus);
        visibleBiomePatches.push({ x: patch.x, z: patch.z, radius: patch.radius + 12 });

        const random = createChunkRandom(cellX * 47 + 881, cellZ * 43 - 337);
        const transitionAmount = THREE.MathUtils.clamp((detailAmount - 0.14) / 0.86, 0, 1);
        const nearObjectScale = 0.58 + detailAmount * 0.42;
        const complexObjectScale = Math.pow(transitionAmount, 0.72);
        const desiredTrees = Math.round((5 + random() * 3) * nearObjectScale);
        const treePoints: LocalPlanetPoint[] = [];
        let patchVines = 0;
        let nearestTreeSpacing = Number.POSITIVE_INFINITY;

        const centralTree = { x: patch.x, z: patch.z };
        if (!isGeneratedNatureExcluded(centralTree, landmarkZones)) {
          const vines = addJungleTree(centralTree.x, centralTree.z, 1.34 + random() * 0.12, random() * Math.PI * 2 - Math.PI, random, dynamicObstacles);
          treePoints.push(centralTree);
          patchVines += vines;
          jungleLargeTreeCount += 1;
          jungleVineCount += vines;
          generatedObjectCount += 1;
        }

        for (let attempt = 0; attempt < desiredTrees * 9 && treePoints.length < desiredTrees; attempt += 1) {
          const point = pointNear(patch.x, patch.z, patch.radius * 0.72, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          const spacing = treePoints.reduce(
            (nearest, treePoint) => Math.min(nearest, surfaceDistanceBetweenLocal(point, treePoint)),
            Number.POSITIVE_INFINITY
          );
          if (spacing < 12.5) continue;
          treePoints.push(point);
          nearestTreeSpacing = Math.min(nearestTreeSpacing, spacing);
          const vines = addJungleTree(point.x, point.z, 1.12 + random() * 0.36, random() * Math.PI * 2 - Math.PI, random, dynamicObstacles);
          patchVines += vines;
          jungleLargeTreeCount += 1;
          jungleVineCount += vines;
          generatedObjectCount += 1;
        }

        const undergrowthCount = Math.round((8 + random() * 6) * complexObjectScale);
        for (let i = 0; i < undergrowthCount; i += 1) {
          const point = pointNear(patch.x, patch.z, patch.radius * 0.82, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          if (random() < 0.58) {
            addReactiveFloraAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
            generatedReactiveFloraCount += 1;
          } else {
            addSproutAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
          }
          generatedObjectCount += 1;
        }

        const poolCount = detailAmount > 0.5 ? 1 + (random() < 0.32 ? 1 : 0) : 0;
        for (let i = 0; i < poolCount; i += 1) {
          const point = pointNear(patch.x, patch.z, patch.radius * 0.36, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addPool(generatedNatureGroup, heightAt, waterMaterial, stoneMaterial, point.x, point.z, 2.8 + random() * 2.6, random() * Math.PI);
          generatedObjectCount += 1;
        }

        jungleSamples.push({
          x: patch.x,
          z: patch.z,
          radius: patch.radius,
          treeCount: treePoints.length,
          vineCount: patchVines,
          nearestTreeSpacing: Number.isFinite(nearestTreeSpacing) ? nearestTreeSpacing : patch.radius,
        });
      }
    }

    const minSeaweedCellX = Math.floor(minX / seaweedCellSize);
    const maxSeaweedCellX = Math.floor(maxX / seaweedCellSize);
    const minSeaweedCellZ = Math.floor(minZ / seaweedCellSize);
    const maxSeaweedCellZ = Math.floor(maxZ / seaweedCellSize);
    for (let cellZ = minSeaweedCellZ; cellZ <= maxSeaweedCellZ; cellZ += 1) {
      for (let cellX = minSeaweedCellX; cellX <= maxSeaweedCellX; cellX += 1) {
        const random = createChunkRandom(cellX - 431, cellZ + 719);
        if (random() > 0.48) continue;
        const x = cellX * seaweedCellSize + (0.18 + random() * 0.64) * seaweedCellSize;
        const z = cellZ * seaweedCellSize + (0.18 + random() * 0.64) * seaweedCellSize;
        const distanceToFocus = surfaceDistanceBetweenLocal({ x: normalized.x, z: normalized.z }, { x, z });
        if (distanceToFocus > generatedComplexFadeRadius * 0.95) continue;
        if (isGeneratedNatureExcluded({ x, z }, landmarkZones)) continue;

        const nearestBiomeEdgeDistance = nearestBiomeEdgeDistanceAt(x, z, visibleBiomePatches);
        if (nearestBiomeEdgeDistance < seaweedBiomeClearance) continue;

        const flatness = terrainFlatnessAt(heightAt, x, z);
        if (flatness > seaweedMaxFlatness) continue;

        const patchSeed = Math.floor(random() * 100_000);
        addSeaweedPatchAt(x, z, patchSeed, random() * Math.PI * 2, flatness, nearestBiomeEdgeDistance);
        generatedObjectCount += 1;
      }
    }

    generatedObstacleCount = dynamicObstacles.length;
    setDynamicCollisionObstacles(dynamicObstacles);
    const rebuildMs = performance.now() - rebuildStart;
    perfState.rebuilds += 1;
    perfState.lastRebuildMs = rebuildMs;
    perfState.maxRebuildMs = Math.max(perfState.maxRebuildMs, rebuildMs);
    perfState.totalRebuildMs += rebuildMs;
    perfState.lastChunkX = generatedCenterChunkX;
    perfState.lastChunkZ = generatedCenterChunkZ;
  };

  rebuildGeneratedNature(0, 0);

  return {
    floraGroup,
    natureGroup,
    updateFloraReactivity: createFloraReactivityUpdater(reactiveStalks, reactiveSeaweedPatches, (distance, freezeAmount) => {
      nearestSeaweedDistance = distance;
      nearestSeaweedFreezeAmount = freezeAmount;
    }),
    updateNatureChunks: rebuildGeneratedNature,
    getNaturePerfState: () => ({ ...perfState }),
    getNatureState: () =>
      getGeneratedNatureState(
        generatedCenterChunkX,
        generatedCenterChunkZ,
        generatedObjectCount,
        generatedObstacleCount,
        generatedReactiveFloraCount,
        generatedSeaweedPatchCount,
        generatedSeaweedBladeCount,
        nearestSeaweedDistance,
        nearestSeaweedFreezeAmount,
        seaweedSamples,
        generatedBiomePatchCount,
        fullDetailBiomePatchCount,
        nearestBiomePatchDistance,
        generatedJunglePatchCount,
        fullDetailJunglePatchCount,
        nearestJunglePatchDistance,
        jungleLargeTreeCount,
        jungleVineCount,
        jungleSamples
      ),
  };
}

function createFloraReactivityUpdater(
  reactiveStalks: ReactiveStalk[],
  reactiveSeaweedPatches: ReactiveSeaweedPatch[],
  setSeaweedFocusState: (distance: number, freezeAmount: number) => void
): (playerPosition: LocalPlanetPoint, delta: number, elapsed: number) => void {
  return (playerPosition, delta, elapsed) => {
    const fade = 1 - Math.exp(-delta * 9);
    let nearestSeaweedDistance = Number.POSITIVE_INFINITY;
    let nearestSeaweedFreezeAmount = 0;

    reactiveStalks.forEach((stalk, index) => {
      const distance = surfaceDistanceBetweenLocal(playerPosition, stalk);
      const target = 1 - THREE.MathUtils.smoothstep(distance, floraReactionFullRadius, floraReactionRadius);
      stalk.reaction = THREE.MathUtils.lerp(stalk.reaction, target, fade);

      const pulse = 0.82 + Math.sin(elapsed * 4.2 + index * 0.73) * 0.18;
      const glowStrength = stalk.reaction * pulse;
      const bob = Math.sin(elapsed * 1.6 + index) * 0.045;
      stalk.capRotation.y += delta * 0.18;
      placeObjectOnPlanet(stalk.cap, stalk.x, stalk.z, stalk.capAltitude + bob, stalk.capRotation);
      placeObjectOnPlanet(stalk.glow, stalk.x, stalk.z, stalk.capAltitude + bob, stalk.capRotation);
      stalk.cap.material.color.lerpColors(capRestColour, capNearColour, stalk.reaction);
      stalk.cap.scale.setScalar(1 + stalk.reaction * 0.2);
      stalk.glow.material.opacity = glowStrength * 0.48;
      stalk.glow.scale.setScalar(1.18 + glowStrength * 0.42);
    });

    reactiveSeaweedPatches.forEach((patch, patchIndex) => {
      const distance = surfaceDistanceBetweenLocal(playerPosition, patch);
      const freezeTarget = 1 - THREE.MathUtils.smoothstep(distance, seaweedReactionFullRadius, seaweedReactionRadius);
      patch.reaction = THREE.MathUtils.lerp(patch.reaction, freezeTarget, fade);
      if (distance < nearestSeaweedDistance) {
        nearestSeaweedDistance = distance;
        nearestSeaweedFreezeAmount = patch.reaction;
      }

      const waveStrength = 1 - patch.reaction;
      patch.blades.forEach((blade, bladeIndex) => {
        const shimmer = Math.sin(elapsed * 1.7 + blade.phase + patchIndex * 0.41 + bladeIndex * 0.23);
        blade.mesh.rotation.z = blade.baseLean + shimmer * blade.waveAmount * waveStrength;
        blade.mesh.scale.x = 1 + shimmer * 0.04 * waveStrength;
        blade.mesh.material.opacity = 0.74 + waveStrength * (0.1 + Math.max(0, shimmer) * 0.08);
        blade.mesh.material.color.copy(blade.restColour).offsetHSL(0, 0, shimmer * 0.018 * waveStrength);
      });
    });

    setSeaweedFocusState(nearestSeaweedDistance, nearestSeaweedFreezeAmount);
  };
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 73856093) ^ Math.imul(chunkZ, 19349663) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}

function chunkNatureDensity(chunkX: number, chunkZ: number): number {
  const broadWave = (Math.sin(chunkX * 0.91 + chunkZ * 0.37) + Math.cos(chunkZ * 0.73 - chunkX * 0.28) + 2) * 0.25;
  const pocket = createChunkRandom(chunkX + 101, chunkZ - 211)();
  return THREE.MathUtils.clamp(0.72 + broadWave * 0.42 + pocket * 0.28, 0.62, 1.34);
}

function shouldPlaceJungleBiomeCell(cellX: number, cellZ: number): boolean {
  if (cellX === jungleDebugCellX && cellZ === jungleDebugCellZ) return true;
  if (Math.abs(cellX) <= 1 && Math.abs(cellZ) <= 1) return false;
  const broadWave = (Math.sin(cellX * 0.63 - cellZ * 0.41) + Math.cos(cellZ * 0.76 + cellX * 0.27) + 2) * 0.25;
  const pocket = createChunkRandom(cellX - 907, cellZ + 577)();
  return broadWave * 0.42 + pocket * 0.58 > 0.78;
}

function junglePatchForCell(cellX: number, cellZ: number): JunglePatch {
  if (cellX === jungleDebugCellX && cellZ === jungleDebugCellZ) return { ...jungleDebugPatch };
  const random = createChunkRandom(cellX * 17 - 313, cellZ * 19 + 229);
  return {
    cellX,
    cellZ,
    x: cellX * jungleBiomeCellSize + (0.28 + random() * 0.44) * jungleBiomeCellSize,
    z: cellZ * jungleBiomeCellSize + (0.28 + random() * 0.44) * jungleBiomeCellSize,
    radius: 58 + random() * 24,
  };
}

function isUsableJunglePatch(patch: JunglePatch): boolean {
  return !isInMassiveMountainFootprint(patch.x, patch.z, patch.radius + 18) && !oceanStateAt(patch.x, patch.z).isInOcean;
}

function nearestJunglePatch(x: number, z: number): { patch: JunglePatch; distance: number } | null {
  const centerCellX = Math.floor(x / jungleBiomeCellSize);
  const centerCellZ = Math.floor(z / jungleBiomeCellSize);
  let nearest: { patch: JunglePatch; distance: number } | null = null;
  for (let cellZ = centerCellZ - 1; cellZ <= centerCellZ + 1; cellZ += 1) {
    for (let cellX = centerCellX - 1; cellX <= centerCellX + 1; cellX += 1) {
      if (!shouldPlaceJungleBiomeCell(cellX, cellZ)) continue;
      const patch = junglePatchForCell(cellX, cellZ);
      if (!isUsableJunglePatch(patch)) continue;
      const distance = surfaceDistanceBetweenLocal({ x, z }, patch);
      if (!nearest || distance - patch.radius < nearest.distance - nearest.patch.radius) {
        nearest = { patch, distance };
      }
    }
  }
  return nearest;
}

function getStableJunglePatches(): JunglePatch[] {
  const patches: JunglePatch[] = [];
  for (let cellZ = -5; cellZ <= 5; cellZ += 1) {
    for (let cellX = -5; cellX <= 5; cellX += 1) {
      if (!shouldPlaceJungleBiomeCell(cellX, cellZ)) continue;
      const patch = junglePatchForCell(cellX, cellZ);
      if (isUsableJunglePatch(patch)) patches.push(patch);
    }
  }
  return patches.sort((a, b) => (a.cellX === jungleDebugCellX && a.cellZ === jungleDebugCellZ ? -1 : b.cellX === jungleDebugCellX && b.cellZ === jungleDebugCellZ ? 1 : 0));
}

function pointNear(x: number, z: number, radius: number, random: () => number): LocalPlanetPoint {
  const angle = random() * Math.PI * 2;
  const distance = Math.pow(random(), 0.62) * radius;
  return {
    x: x + Math.cos(angle) * distance,
    z: z + Math.sin(angle) * distance,
  };
}

function isGeneratedNatureExcluded(point: LocalPlanetPoint, landmarkZones: LandmarkZone[]): boolean {
  return isInLandmarkZone(point, landmarkZones) || isInMassiveMountainFootprint(point.x, point.z, 8) || isOceanPoint(point.x, point.z);
}

function isOceanPoint(x: number, z: number): boolean {
  return oceanStateAt(x, z).isInOcean;
}

function nearestBiomeEdgeDistanceAt(x: number, z: number, patches: BiomePatch[]): number {
  if (patches.length === 0) return Number.POSITIVE_INFINITY;
  return patches.reduce((nearest, patch) => {
    const distance = surfaceDistanceBetweenLocal({ x, z }, patch) - patch.radius;
    return Math.min(nearest, distance);
  }, Number.POSITIVE_INFINITY);
}

function makeSeaweedBladeGeometry(width: number, height: number, bend: number, phase: number): THREE.BufferGeometry {
  const segments = 5;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const rootFade = THREE.MathUtils.smoothstep(t, 0.06, 0.34);
    const tipSweep = Math.sin(t * Math.PI * 1.55 + phase) * bend * rootFade;
    const tipLean = Math.sin(phase * 1.7) * bend * 0.42 * t * t;
    const centerX = tipSweep + tipLean;
    const taper = 1 - t * 0.42;
    const halfWidth = width * taper * 0.5;
    const y = height * t;
    positions.push(centerX - halfWidth, y, 0, centerX + halfWidth, y, 0);
  }

  for (let i = 0; i < segments; i += 1) {
    const lowerLeft = i * 2;
    const lowerRight = lowerLeft + 1;
    const upperLeft = lowerLeft + 2;
    const upperRight = lowerLeft + 3;
    indices.push(lowerLeft, upperLeft, lowerRight, lowerRight, upperLeft, upperRight);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function terrainFlatnessAt(heightAt: HeightSampler, x: number, z: number): number {
  const center = heightAt(x, z);
  const sampleDistance = 3.5;
  const samples = [
    heightAt(x + sampleDistance, z),
    heightAt(x - sampleDistance, z),
    heightAt(x, z + sampleDistance),
    heightAt(x, z - sampleDistance),
    heightAt(x + sampleDistance * 0.7, z + sampleDistance * 0.7),
    heightAt(x - sampleDistance * 0.7, z - sampleDistance * 0.7),
  ];

  return samples.reduce((largest, height) => Math.max(largest, Math.abs(height - center)), 0);
}

function disposeGeneratedNature(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

function getGeneratedNatureState(
  centerChunkX: number,
  centerChunkZ: number,
  generatedObjects: number,
  generatedObstacles: number,
  generatedReactiveFlora: number,
  generatedSeaweedPatches: number,
  generatedSeaweedBlades: number,
  nearestSeaweedDistance: number,
  nearestSeaweedFreezeAmount: number,
  seaweedSamples: SeaweedSample[],
  generatedBiomePatches: number,
  fullDetailBiomePatches: number,
  nearestBiomePatchDistance: number,
  generatedJunglePatches: number,
  fullDetailJunglePatches: number,
  nearestJunglePatchDistance: number,
  jungleLargeTrees: number,
  jungleVines: number,
  jungleSamples: JungleTreeSample[]
): NatureState {
  const minChunkX = centerChunkX - generatedNatureChunkRadius;
  const maxChunkX = centerChunkX + generatedNatureChunkRadius + 1;
  const minChunkZ = centerChunkZ - generatedNatureChunkRadius;
  const maxChunkZ = centerChunkZ + generatedNatureChunkRadius + 1;
  return {
    centerX: (minChunkX + maxChunkX) * 0.5 * generatedNatureChunkSize,
    centerZ: (minChunkZ + maxChunkZ) * 0.5 * generatedNatureChunkSize,
    minX: minChunkX * generatedNatureChunkSize,
    maxX: maxChunkX * generatedNatureChunkSize,
    minZ: minChunkZ * generatedNatureChunkSize,
    maxZ: maxChunkZ * generatedNatureChunkSize,
    chunkSize: generatedNatureChunkSize,
    chunkCount: Math.pow(generatedNatureChunkRadius * 2 + 1, 2),
    complexDetailRadius: generatedComplexDetailRadius,
    complexFadeRadius: generatedComplexFadeRadius,
    nearestBiomePatchDistance,
    fullDetailBiomePatches,
    generatedBiomePatches,
    generatedObjects,
    generatedObstacles,
    generatedReactiveFlora,
    generatedSeaweedPatches,
    generatedSeaweedBlades,
    nearestSeaweedDistance,
    nearestSeaweedFreezeAmount,
    seaweedSamples: seaweedSamples.slice(0, 12),
    generatedJunglePatches,
    fullDetailJunglePatches,
    nearestJunglePatchDistance,
    jungleLargeTrees,
    jungleVines,
    jungleSamples: jungleSamples.slice(0, 12),
  };
}

function makePoolGeometry(
  heightAt: HeightSampler,
  x: number,
  z: number,
  radius: number,
  rotation: number,
  scaleX: number,
  scaleZ: number
): THREE.BufferGeometry {
  const segments = 22;
  const center = pointOnPlanet(x, z, heightAt(x, z) + 0.045);
  const positions: number[] = [center.x, center.y, center.z];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * scaleX;
    const localZ = Math.sin(angle) * radius * scaleZ;
    const worldX = x + Math.cos(rotation) * localX - Math.sin(rotation) * localZ;
    const worldZ = z + Math.sin(rotation) * localX + Math.cos(rotation) * localZ;
    const point = pointOnPlanet(worldX, worldZ, heightAt(worldX, worldZ) + 0.045);
    positions.push(point.x, point.y, point.z);
  }

  for (let i = 1; i <= segments; i += 1) {
    indices.push(0, i, i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addPool(
  natureGroup: THREE.Group,
  heightAt: HeightSampler,
  waterMaterial: THREE.MeshBasicMaterial,
  stoneMaterial: THREE.MeshBasicMaterial,
  x: number,
  z: number,
  radius: number,
  colourShift: number
): void {
  const pool = new THREE.Group();

  const water = new THREE.Mesh(makePoolGeometry(heightAt, x, z, radius, colourShift, 1.45, 0.78), waterMaterial.clone());
  const waterMat = water.material as THREE.MeshBasicMaterial;
  waterMat.color.offsetHSL(colourShift * 0.018, -0.05, -0.02);
  pool.add(water);

  const innerGlow = new THREE.Mesh(
    makePoolGeometry(heightAt, x, z, radius * 0.56, colourShift, 1.3, 0.68),
    new THREE.MeshBasicMaterial({ color: 0xe2ffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  pool.add(innerGlow);

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * 1.28;
    const localZ = Math.sin(angle) * radius * 0.72;
    const worldX = x + Math.cos(colourShift) * localX - Math.sin(colourShift) * localZ;
    const worldZ = z + Math.sin(colourShift) * localX + Math.cos(colourShift) * localZ;
    const rim = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 4) * 0.06, 0), stoneMaterial);
    placeObjectOnPlanet(rim, worldX, worldZ, heightAt(worldX, worldZ) + 0.16, new THREE.Euler(i * 0.2, i * 0.3, i * 0.17));
    pool.add(rim);
  }

  natureGroup.add(pool);
}

function addGeneratedStream(
  natureGroup: THREE.Group,
  heightAt: HeightSampler,
  waterMaterial: THREE.MeshBasicMaterial,
  x: number,
  z: number,
  length: number,
  rotation: number,
  bend: number
): void {
  const points = Array.from({ length: 5 }, (_, index) => {
    const t = index / 4;
    const along = (t - 0.5) * length;
    const side = Math.sin(t * Math.PI * 2 + bend) * length * 0.12;
    return new THREE.Vector3(x + Math.cos(rotation) * along - Math.sin(rotation) * side, 0, z + Math.sin(rotation) * along + Math.cos(rotation) * side);
  });
  const stream = new THREE.Mesh(makeStreamGeometry(heightAt, points), waterMaterial);
  stream.renderOrder = 1;
  natureGroup.add(stream);
}

function makeStreamGeometry(heightAt: HeightSampler, points: THREE.Vector3[]): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const samples = 36;
  const halfWidth = 0.28;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const leftX = point.x + side.x;
    const leftZ = point.z + side.z;
    const rightX = point.x - side.x;
    const rightZ = point.z - side.z;
    const left = pointOnPlanet(leftX, leftZ, heightAt(leftX, leftZ) + 0.055);
    const right = pointOnPlanet(rightX, rightZ, heightAt(rightX, rightZ) + 0.055);
    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);
  }

  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
