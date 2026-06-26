import * as THREE from "three";
import { normalizePlanetCoords, placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

export type DiamondBiomeId = "primary" | "cyan" | "rose";

type DiamondBiomeConfig = {
  id: DiamondBiomeId;
  debugName: "diamond" | "diamond2" | "diamond3";
  center: LocalPlanetPoint;
  radius: number;
  innerRadius: number;
  gravityMultiplier: number;
  terrainBase: THREE.Color;
  hueStart: number;
  hueRange: number;
  terrainMix: number;
  facetPhase: number;
};

export type DiamondBiomeState = {
  biomeId: DiamondBiomeId | null;
  debugName: DiamondBiomeConfig["debugName"] | null;
  center: LocalPlanetPoint;
  radius: number;
  innerRadius: number;
  edgeFadeDistance: number;
  centerDistance: number;
  signedDistance: number;
  isInside: boolean;
  activeAmount: number;
  gravityMultiplier: number;
};

export type DiamondBiomeDebugState = DiamondBiomeState & {
  debugSpawn: { x: number; z: number; yaw: number };
  outsideSample: { x: number; z: number };
  biomeCount: number;
  biomes: {
    biomeId: DiamondBiomeId;
    debugName: DiamondBiomeConfig["debugName"];
    center: LocalPlanetPoint;
    radius: number;
    gravityMultiplier: number;
    debugSpawn: { x: number; z: number; yaw: number };
  }[];
  renderedFragmentCount: number;
  renderedChunkCount: number;
};

export type DiamondCrystalSystem = {
  group: THREE.Group;
  update: (centerX: number, centerZ: number, elapsed: number) => void;
  getRenderState: () => { renderedFragmentCount: number; renderedChunkCount: number };
};

type CrystalFragment = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  baseOpacity: number;
  hueStart: number;
  hueRange: number;
  hueOffset: number;
};

type CrystalChunk = {
  group: THREE.Group;
  fragments: CrystalFragment[];
};

const diamondBiomeRadius = 150;
const diamondBiomeInnerRadius = 118;
const crystalChunkSize = 48;
const crystalChunkRadius = 4;
const crystalChunkHalfDiagonal = Math.SQRT2 * crystalChunkSize * 0.5;
const crystalCullPadding = diamondBiomeRadius - diamondBiomeInnerRadius + crystalChunkHalfDiagonal + 8;
const terrainRidgeScratch = new THREE.Color();

export const DIAMOND_BIOMES: DiamondBiomeConfig[] = [
  {
    id: "primary",
    debugName: "diamond",
    center: normalizePlanetCoords(-430, 620),
    radius: diamondBiomeRadius,
    innerRadius: diamondBiomeInnerRadius,
    gravityMultiplier: 0.5,
    terrainBase: new THREE.Color(0xc9f7ff),
    hueStart: 0.52,
    hueRange: 0.32,
    terrainMix: 0.38,
    facetPhase: 0,
  },
  {
    id: "cyan",
    debugName: "diamond2",
    center: normalizePlanetCoords(1180, -790),
    radius: diamondBiomeRadius,
    innerRadius: diamondBiomeInnerRadius,
    gravityMultiplier: 0.25,
    terrainBase: new THREE.Color(0xb8ffd9),
    hueStart: 0.38,
    hueRange: 0.22,
    terrainMix: 0.42,
    facetPhase: 1.9,
  },
  {
    id: "rose",
    debugName: "diamond3",
    center: normalizePlanetCoords(-1450, -1020),
    radius: diamondBiomeRadius,
    innerRadius: diamondBiomeInnerRadius,
    gravityMultiplier: 0.125,
    terrainBase: new THREE.Color(0xffc3db),
    hueStart: 0.88,
    hueRange: 0.18,
    terrainMix: 0.46,
    facetPhase: 3.7,
  },
];

export function diamondBiomeStateAt(x: number, z: number): DiamondBiomeState {
  const normalized = normalizePlanetCoords(x, z);
  let nearest = sampleBiome(DIAMOND_BIOMES[0], normalized);

  for (let i = 1; i < DIAMOND_BIOMES.length; i += 1) {
    const sample = sampleBiome(DIAMOND_BIOMES[i], normalized);
    const sampleRank = sample.isInside ? -sample.activeAmount : sample.centerDistance / sample.radius;
    const nearestRank = nearest.isInside ? -nearest.activeAmount : nearest.centerDistance / nearest.radius;
    if (sampleRank < nearestRank) nearest = sample;
  }

  return nearest;
}

export function diamondGravityMultiplierAt(x: number, z: number): number {
  return diamondBiomeStateAt(x, z).gravityMultiplier;
}

export function diamondTerrainOffsetAt(x: number, z: number): number {
  const state = diamondBiomeStateAt(x, z);
  const biome = biomeConfigForState(state);
  if (!biome || state.activeAmount <= 0) return 0;

  const normalized = normalizePlanetCoords(x, z);
  const dx = normalized.x - biome.center.x;
  const dz = normalized.z - biome.center.z;
  const facetWave =
    Math.sin(dx * 0.14 + dz * 0.04 + biome.facetPhase) * 0.32 +
    Math.cos(dz * 0.12 - dx * 0.05 + biome.facetPhase * 0.7) * 0.26 +
    Math.sin((dx - dz) * 0.075 - biome.facetPhase * 0.4) * 0.18;
  const bowl = Math.pow(state.activeAmount, 0.75) * 0.42;
  return state.activeAmount * (facetWave + bowl);
}

export function diamondTerrainColourAt(x: number, z: number, baseColour: THREE.Color): THREE.Color {
  const state = diamondBiomeStateAt(x, z);
  const biome = biomeConfigForState(state);
  if (!biome || state.activeAmount <= 0) return baseColour;

  const normalized = normalizePlanetCoords(x, z);
  const stripe = Math.sin((normalized.x - normalized.z) * 0.1 + biome.facetPhase) * 0.5 + 0.5;
  const prism = terrainRidgeScratch.setHSL(biome.hueStart + stripe * biome.hueRange, 0.72, 0.62);
  const mineral = biome.terrainBase.clone().lerp(prism, biome.terrainMix + stripe * 0.28);
  return baseColour.clone().lerp(mineral, 0.44 + state.activeAmount * 0.42);
}

export function getDiamondDebugSpawn(debugName: DiamondBiomeConfig["debugName"] = "diamond"): { x: number; z: number; yaw: number } {
  const biome = biomeConfigForDebugName(debugName);
  const x = biome.center.x - 70;
  const z = biome.center.z + 8;
  return {
    x,
    z,
    yaw: Math.atan2(biome.center.x - x, biome.center.z - z),
  };
}

export function getDiamondBiomeDebugState(
  renderState = { renderedFragmentCount: 0, renderedChunkCount: 0 },
  sample: LocalPlanetPoint = getDiamondDebugSpawn()
): DiamondBiomeDebugState {
  const state = diamondBiomeStateAt(sample.x, sample.z);
  const debugName = state.debugName ?? "diamond";
  const spawn = getDiamondDebugSpawn(debugName);
  const outsideSource = biomeConfigForDebugName(debugName);
  return {
    ...state,
    debugSpawn: spawn,
    outsideSample: { x: outsideSource.center.x + outsideSource.radius + 80, z: outsideSource.center.z },
    biomeCount: DIAMOND_BIOMES.length,
    biomes: DIAMOND_BIOMES.map((biome) => ({
      biomeId: biome.id,
      debugName: biome.debugName,
      center: { ...biome.center },
      radius: biome.radius,
      gravityMultiplier: biome.gravityMultiplier,
      debugSpawn: getDiamondDebugSpawn(biome.debugName),
    })),
    renderedFragmentCount: renderState.renderedFragmentCount,
    renderedChunkCount: renderState.renderedChunkCount,
  };
}

export function createDiamondCrystalSystem(heightAt: HeightSampler): DiamondCrystalSystem {
  const group = new THREE.Group();
  group.name = "diamond-biome-crystal-fragments";
  const chunks = new Map<string, CrystalChunk>();
  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;
  let renderedFragmentCount = 0;
  let renderedChunkCount = 0;

  const update = (centerX: number, centerZ: number, elapsed: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / crystalChunkSize);
    const nextChunkZ = Math.floor(normalized.z / crystalChunkSize);
    if (nextChunkX !== centerChunkX || nextChunkZ !== centerChunkZ) {
      centerChunkX = nextChunkX;
      centerChunkZ = nextChunkZ;
      syncCrystalChunks(group, chunks, centerChunkX, centerChunkZ, heightAt);
      renderedChunkCount = group.children.length;
      renderedFragmentCount = countFragments(chunks);
    }

    animateCrystalFragments(chunks, elapsed);
  };

  update(DIAMOND_BIOMES[0].center.x, DIAMOND_BIOMES[0].center.z, 0);

  return {
    group,
    update,
    getRenderState: () => ({ renderedFragmentCount, renderedChunkCount }),
  };
}

function sampleBiome(biome: DiamondBiomeConfig, point: LocalPlanetPoint): DiamondBiomeState {
  const centerDistance = surfaceDistanceBetweenLocal(point, biome.center);
  const signedDistance = centerDistance - biome.radius;
  const activeAmount = 1 - THREE.MathUtils.smoothstep(centerDistance, biome.innerRadius, biome.radius);
  const isInside = signedDistance <= 0;
  return {
    biomeId: activeAmount > 0 || isInside ? biome.id : null,
    debugName: activeAmount > 0 || isInside ? biome.debugName : null,
    center: { ...biome.center },
    radius: biome.radius,
    innerRadius: biome.innerRadius,
    edgeFadeDistance: biome.radius - biome.innerRadius,
    centerDistance,
    signedDistance,
    isInside,
    activeAmount,
    gravityMultiplier: isInside ? biome.gravityMultiplier : 1,
  };
}

function biomeConfigForState(state: DiamondBiomeState): DiamondBiomeConfig | null {
  return state.biomeId ? DIAMOND_BIOMES.find((biome) => biome.id === state.biomeId) ?? null : null;
}

function biomeConfigForDebugName(debugName: DiamondBiomeConfig["debugName"]): DiamondBiomeConfig {
  return DIAMOND_BIOMES.find((biome) => biome.debugName === debugName) ?? DIAMOND_BIOMES[0];
}

function syncCrystalChunks(
  group: THREE.Group,
  chunks: Map<string, CrystalChunk>,
  centerChunkX: number,
  centerChunkZ: number,
  heightAt: HeightSampler
): void {
  const desiredKeys = new Set<string>();
  const orderedChunks: THREE.Group[] = [];

  for (let zChunk = centerChunkZ - crystalChunkRadius; zChunk <= centerChunkZ + crystalChunkRadius; zChunk += 1) {
    for (let xChunk = centerChunkX - crystalChunkRadius; xChunk <= centerChunkX + crystalChunkRadius; xChunk += 1) {
      const chunkCenter = normalizePlanetCoords((xChunk + 0.5) * crystalChunkSize, (zChunk + 0.5) * crystalChunkSize);
      const nearDiamondBiome = DIAMOND_BIOMES.some(
        (biome) => surfaceDistanceBetweenLocal(chunkCenter, biome.center) <= biome.radius + crystalCullPadding
      );
      if (!nearDiamondBiome) continue;

      const key = crystalChunkKey(xChunk, zChunk);
      desiredKeys.add(key);
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = makeCrystalChunk(xChunk, zChunk, heightAt);
        chunks.set(key, chunk);
      }
      if (chunk.group.children.length > 0) orderedChunks.push(chunk.group);
    }
  }

  chunks.forEach((chunk, key) => {
    if (desiredKeys.has(key)) return;
    group.remove(chunk.group);
    disposeCrystalChunk(chunk);
    chunks.delete(key);
  });

  group.clear();
  orderedChunks.forEach((chunk) => group.add(chunk));
}

function makeCrystalChunk(xChunk: number, zChunk: number, heightAt: HeightSampler): CrystalChunk {
  const chunkGroup = new THREE.Group();
  chunkGroup.name = `diamond-crystal-chunk-${xChunk}-${zChunk}`;
  const fragments: CrystalFragment[] = [];
  const random = createChunkRandom(xChunk + 1301, zChunk - 947);
  const xMin = xChunk * crystalChunkSize;
  const zMin = zChunk * crystalChunkSize;
  const candidateCount = 18 + Math.floor(random() * 10);

  for (let i = 0; i < candidateCount; i += 1) {
    const x = xMin + (0.08 + random() * 0.84) * crystalChunkSize;
    const z = zMin + (0.08 + random() * 0.84) * crystalChunkSize;
    const state = diamondBiomeStateAt(x, z);
    const biome = biomeConfigForState(state);
    if (!biome || state.activeAmount <= 0.03 || random() > 0.22 + state.activeAmount * 0.78) continue;

    const fragment = makeCrystalFragment(x, z, heightAt(x, z), random, state.activeAmount, biome);
    fragments.push(fragment);
    chunkGroup.add(fragment.mesh, fragment.glow);
  }

  return { group: chunkGroup, fragments };
}

function makeCrystalFragment(
  x: number,
  z: number,
  terrainHeight: number,
  random: () => number,
  biomeAmount: number,
  biome: DiamondBiomeConfig
): CrystalFragment {
  const size = 0.24 + random() * 0.62 + biomeAmount * 0.18;
  const tallness = 0.55 + random() * 0.9;
  const hueOffset = random();
  const colour = new THREE.Color().setHSL(biome.hueStart + hueOffset * biome.hueRange, 0.82, 0.62 + random() * 0.16);
  const material = new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.58 + biomeAmount * 0.22,
    depthWrite: false,
  });
  const geometry =
    random() > 0.34
      ? new THREE.OctahedronGeometry(size, 0)
      : new THREE.TetrahedronGeometry(size * 1.12, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(0.62 + random() * 0.7, tallness, 0.58 + random() * 0.62);
  placeObjectOnPlanet(
    mesh,
    x,
    z,
    terrainHeight + size * (0.18 + tallness * 0.25),
    new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI)
  );

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setHSL(biome.hueStart + hueOffset * biome.hueRange + 0.06, 0.95, 0.72),
    transparent: true,
    opacity: 0.18 + biomeAmount * 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(geometry.clone(), glowMaterial);
  glow.scale.copy(mesh.scale).multiplyScalar(1.26);
  glow.quaternion.copy(mesh.quaternion);
  glow.position.copy(mesh.position);

  return {
    mesh,
    glow,
    phase: random() * Math.PI * 2,
    baseOpacity: material.opacity,
    hueStart: biome.hueStart,
    hueRange: biome.hueRange,
    hueOffset,
  };
}

function animateCrystalFragments(chunks: Map<string, CrystalChunk>, elapsed: number): void {
  chunks.forEach((chunk) => {
    chunk.fragments.forEach((fragment, index) => {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.35 + fragment.phase + index * 0.09);
      fragment.mesh.material.opacity = fragment.baseOpacity * (0.78 + pulse * 0.28);
      fragment.mesh.material.color.setHSL(
        fragment.hueStart + fragment.hueOffset * fragment.hueRange + Math.sin(elapsed * 0.24 + fragment.phase) * 0.025,
        0.82,
        0.62 + pulse * 0.16
      );
      fragment.glow.material.opacity = 0.08 + pulse * 0.18;
      fragment.glow.scale.copy(fragment.mesh.scale).multiplyScalar(1.12 + pulse * 0.22);
    });
  });
}

function countFragments(chunks: Map<string, CrystalChunk>): number {
  let count = 0;
  chunks.forEach((chunk) => {
    count += chunk.fragments.length;
  });
  return count;
}

function disposeCrystalChunk(chunk: CrystalChunk): void {
  chunk.fragments.forEach((fragment) => {
    fragment.mesh.geometry.dispose();
    fragment.mesh.material.dispose();
    fragment.glow.geometry.dispose();
    fragment.glow.material.dispose();
  });
}

function crystalChunkKey(xChunk: number, zChunk: number): string {
  return `${xChunk}:${zChunk}`;
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 73856093) ^ Math.imul(chunkZ, 19349663) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}
