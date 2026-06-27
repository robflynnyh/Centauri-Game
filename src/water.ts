import * as THREE from "three";
import {
  normalizePlanetCoords,
  PLANET_CIRCUMFERENCE,
  pointOnPlanet,
  surfaceDistanceBetweenLocal,
  type LocalPlanetPoint,
} from "./planet";

type HeightSampler = (x: number, z: number) => number;

type OceanPalette = {
  deep: number;
  mid: number;
  shore: number;
};

type OceanPaletteColours = {
  deep: THREE.Color;
  mid: THREE.Color;
  shore: THREE.Color;
};

export type OceanRegion = {
  id: "vermilion" | "lapis" | "amethyst";
  name: string;
  center: LocalPlanetPoint;
  baseRadius: number;
  waterSurfaceHeight: number;
  maxDepth: number;
  palette: OceanPalette;
  seed: number;
};

export type OceanState = {
  isInOcean: boolean;
  regionId: OceanRegion["id"] | null;
  nearestRegionId: OceanRegion["id"];
  regionName: string | null;
  centerDistance: number;
  shorelineRadius: number;
  signedShoreDistance: number;
  nearestShoreDistance: number;
  normalizedShorelineAmount: number;
  waterSurfaceHeight: number;
  maxDepth: number;
  terrainDepthBelowSurface: number;
  immersionAmount: number;
  movementSpeedMultiplier: number;
};

export type OceanDebugRegionState = {
  id: OceanRegion["id"];
  name: string;
  palette: {
    deep: string;
    mid: string;
    shore: string;
  };
  center: LocalPlanetPoint;
  waterSurfaceHeight: number;
  baseRadius: number;
  minShorelineRadius: number;
  maxShorelineRadius: number;
  meanShorelineRadius: number;
  estimatedShorelineCircumference: number;
  maxTerrainDepthBelowSurface: number;
  deepSample: LocalPlanetPoint;
  shoreSample: LocalPlanetPoint;
  outsideShoreSample: LocalPlanetPoint;
  shorelineSamples: {
    angle: number;
    inside: LocalPlanetPoint;
    outside: LocalPlanetPoint;
  }[];
};

export type OceanDebugState = {
  oceanCount: number;
  movementSpeedMultiplierInOcean: number;
  regions: OceanDebugRegionState[];
};

export type OceanSystem = {
  group: THREE.Group;
  update: (centerX: number, centerZ: number) => void;
  getRenderState: () => { centerX: number; centerZ: number; chunkSize: number; chunkCount: number; renderedChunks: number };
  getOceanPerfState: () => OceanPerfState;
};

export type OceanPerfState = {
  rebuilds: number;
  lastRebuildMs: number;
  maxRebuildMs: number;
  totalRebuildMs: number;
  lastCreatedChunks: number;
  lastDisposedChunks: number;
  cachedChunks: number;
  visibleChunks: number;
  lastChunkX: number;
  lastChunkZ: number;
};

type OceanChunk = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
};

type OceanChunkSyncStats = {
  createdChunks: number;
  disposedChunks: number;
  cachedChunks: number;
  visibleChunks: number;
};

const shoreBandWidth = 42;
const outsideBankBlendDistance = 72;
const oceanChunkSize = 96;
const oceanChunkSegments = 32;
const oceanChunkRadius = 5;
const oceanChunkHalfDiagonal = Math.SQRT2 * oceanChunkSize * 0.5;
const oceanChunkCullPadding = 150;
const oceanColourScratch = new THREE.Color();
const oceanPalettes: Record<OceanRegion["id"], OceanPalette> = {
  vermilion: {
    deep: 0x1156b8,
    mid: 0x1fa6d2,
    shore: 0x94fff2,
  },
  lapis: {
    deep: 0x1156b8,
    mid: 0x1fa6d2,
    shore: 0x94fff2,
  },
  amethyst: {
    deep: 0x3c177c,
    mid: 0x8e3ed2,
    shore: 0xe0a7ff,
  },
};
const oceanPaletteColours: Record<OceanRegion["id"], OceanPaletteColours> = {
  vermilion: makeOceanPaletteColours(oceanPalettes.vermilion),
  lapis: makeOceanPaletteColours(oceanPalettes.lapis),
  amethyst: makeOceanPaletteColours(oceanPalettes.amethyst),
};

export const OCEAN_REGIONS: OceanRegion[] = [
  {
    id: "vermilion",
    name: "Vermilion Still",
    center: { x: 870, z: 285 },
    baseRadius: 305,
    waterSurfaceHeight: -1.15,
    maxDepth: 24,
    palette: oceanPalettes.vermilion,
    seed: 11.7,
  },
  {
    id: "lapis",
    name: "Lapis Hollow",
    center: { x: -905, z: -365 },
    baseRadius: 308,
    waterSurfaceHeight: -1.85,
    maxDepth: 27,
    palette: oceanPalettes.lapis,
    seed: 29.3,
  },
  {
    id: "amethyst",
    name: "Amethyst Abyss",
    center: { x: 2450, z: 920 },
    baseRadius: 306,
    waterSurfaceHeight: -1.55,
    maxDepth: 26,
    palette: oceanPalettes.amethyst,
    seed: 47.9,
  },
];

export function getOceanRegions(): OceanRegion[] {
  return OCEAN_REGIONS.map((region) => ({ ...region, center: { ...region.center } }));
}

export function oceanStateAt(x: number, z: number, heightSampler?: HeightSampler): OceanState {
  const normalized = normalizePlanetCoords(x, z);
  let nearestRegion = OCEAN_REGIONS[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestRadius = nearestRegion.baseRadius;
  let nearestSignedDistance = Number.POSITIVE_INFINITY;

  OCEAN_REGIONS.forEach((region) => {
    const centerDistance = surfaceDistanceBetweenLocal(normalized, region.center);
    const radius = shorelineRadiusAt(region, normalized.x, normalized.z);
    const signedDistance = centerDistance - radius;
    const nearestRank = signedDistance <= 0 ? signedDistance : Math.abs(signedDistance);
    if (nearestRank < nearestDistance) {
      nearestDistance = nearestRank;
      nearestRegion = region;
      nearestRadius = radius;
      nearestSignedDistance = signedDistance;
    }
  });

  const terrainHeight = heightSampler ? heightSampler(normalized.x, normalized.z) : Number.POSITIVE_INFINITY;
  const terrainDepthBelowSurface = Math.max(0, nearestRegion.waterSurfaceHeight - terrainHeight);
  const isInOcean = nearestSignedDistance <= 0;
  const immersionAmount = isInOcean ? THREE.MathUtils.smoothstep(terrainDepthBelowSurface, 0.18, 2.4) : 0;

  return {
    isInOcean,
    regionId: isInOcean ? nearestRegion.id : null,
    nearestRegionId: nearestRegion.id,
    regionName: isInOcean ? nearestRegion.name : null,
    centerDistance: surfaceDistanceBetweenLocal(normalized, nearestRegion.center),
    shorelineRadius: nearestRadius,
    signedShoreDistance: nearestSignedDistance,
    nearestShoreDistance: Math.abs(nearestSignedDistance),
    normalizedShorelineAmount: 1 - THREE.MathUtils.smoothstep(Math.abs(nearestSignedDistance), 0, shoreBandWidth),
    waterSurfaceHeight: nearestRegion.waterSurfaceHeight,
    maxDepth: nearestRegion.maxDepth,
    terrainDepthBelowSurface,
    immersionAmount,
    movementSpeedMultiplier: immersionAmount > 0.1 ? 0.5 : 1,
  };
}

export function oceanTerrainOffsetAt(x: number, z: number, baseHeight: number): number {
  const state = oceanStateAt(x, z);
  if (!state.isInOcean) return shorelineBankOffsetAt(state, x, z, baseHeight);

  const inwardDistance = Math.max(0, -state.signedShoreDistance);
  const shelfAmount = THREE.MathUtils.smoothstep(inwardDistance, 0, 46);
  const deepAmount = THREE.MathUtils.smoothstep(inwardDistance, 46, state.shorelineRadius * 0.72);
  const basinFloorNoise = basinNoiseAt(x, z) * 1.45;
  const targetDepth = 0.25 + shelfAmount * 4.2 + deepAmount * Math.max(0, state.maxDepth - 5);
  const targetHeight = state.waterSurfaceHeight - targetDepth + basinFloorNoise * (0.25 + deepAmount * 0.75);
  const carveAmount = THREE.MathUtils.smoothstep(inwardDistance, 8, 74);
  const desiredHeight = THREE.MathUtils.lerp(baseHeight, targetHeight, carveAmount);
  return Math.min(0, desiredHeight - baseHeight);
}

function shorelineBankOffsetAt(state: OceanState, x: number, z: number, baseHeight: number): number {
  if (state.signedShoreDistance > outsideBankBlendDistance) return 0;
  if (baseHeight >= state.waterSurfaceHeight + 0.08) return 0;

  const bankAmount = 1 - THREE.MathUtils.smoothstep(state.signedShoreDistance, 18, outsideBankBlendDistance);
  const bankNoise = Math.sin(x * 0.083 + z * 0.041) * 0.12 + Math.cos(x * 0.037 - z * 0.091) * 0.08;
  const targetHeight = state.waterSurfaceHeight + 0.12 + bankNoise + state.signedShoreDistance * 0.028;
  return Math.max(0, targetHeight - baseHeight) * bankAmount;
}

export function getOceanDebugSpawn(regionId: OceanRegion["id"] = OCEAN_REGIONS[0].id): { x: number; z: number; yaw: number } {
  const region = OCEAN_REGIONS.find((candidate) => candidate.id === regionId) ?? OCEAN_REGIONS[0];
  const angle = 0.16;
  const shoreRadius = shorelineRadiusAtAngle(region, angle);
  const x = region.center.x + Math.cos(angle) * (shoreRadius + 18);
  const z = region.center.z + Math.sin(angle) * (shoreRadius + 18);
  return {
    x,
    z,
    yaw: Math.atan2(x - region.center.x, z - region.center.z),
  };
}

export function getOceanDebugState(heightSampler: HeightSampler): OceanDebugState {
  return {
    oceanCount: OCEAN_REGIONS.length,
    movementSpeedMultiplierInOcean: 0.5,
    regions: OCEAN_REGIONS.map((region) => summarizeOceanRegion(region, heightSampler)),
  };
}

export function createOceanSystem(): OceanSystem {
  const group = new THREE.Group();
  group.name = "spherical-planet-oceans";
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;
  let renderedChunks = 0;
  const chunks = new Map<string, OceanChunk>();
  const perfState: OceanPerfState = {
    rebuilds: 0,
    lastRebuildMs: 0,
    maxRebuildMs: 0,
    totalRebuildMs: 0,
    lastCreatedChunks: 0,
    lastDisposedChunks: 0,
    cachedChunks: 0,
    visibleChunks: 0,
    lastChunkX: 0,
    lastChunkZ: 0,
  };

  const update = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / oceanChunkSize);
    const nextChunkZ = Math.floor(normalized.z / oceanChunkSize);
    if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;

    centerChunkX = nextChunkX;
    centerChunkZ = nextChunkZ;
    const rebuildStart = performance.now();
    const stats = syncOceanChunks(group, material, chunks, centerChunkX, centerChunkZ);
    const rebuildMs = performance.now() - rebuildStart;
    renderedChunks = stats.visibleChunks;
    perfState.rebuilds += 1;
    perfState.lastRebuildMs = rebuildMs;
    perfState.maxRebuildMs = Math.max(perfState.maxRebuildMs, rebuildMs);
    perfState.totalRebuildMs += rebuildMs;
    perfState.lastCreatedChunks = stats.createdChunks;
    perfState.lastDisposedChunks = stats.disposedChunks;
    perfState.cachedChunks = stats.cachedChunks;
    perfState.visibleChunks = stats.visibleChunks;
    perfState.lastChunkX = centerChunkX;
    perfState.lastChunkZ = centerChunkZ;
  };

  update(0, 0);

  return {
    group,
    update,
    getRenderState: () => ({
      centerX: centerChunkX * oceanChunkSize,
      centerZ: centerChunkZ * oceanChunkSize,
      chunkSize: oceanChunkSize,
      chunkCount: Math.pow(oceanChunkRadius * 2 + 1, 2),
      renderedChunks,
    }),
    getOceanPerfState: () => ({ ...perfState }),
  };
}

function syncOceanChunks(
  group: THREE.Group,
  material: THREE.MeshBasicMaterial,
  chunks: Map<string, OceanChunk>,
  centerChunkX: number,
  centerChunkZ: number
): OceanChunkSyncStats {
  const desiredKeys = new Set<string>();
  const orderedMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  let createdChunks = 0;

  for (let zChunk = centerChunkZ - oceanChunkRadius; zChunk <= centerChunkZ + oceanChunkRadius; zChunk += 1) {
    for (let xChunk = centerChunkX - oceanChunkRadius; xChunk <= centerChunkX + oceanChunkRadius; xChunk += 1) {
      const key = oceanChunkKey(xChunk, zChunk);
      desiredKeys.add(key);
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = makeOceanChunk(material, xChunk, zChunk);
        chunks.set(key, chunk);
        createdChunks += 1;
      }
      if (chunk.mesh) orderedMeshes.push(chunk.mesh);
    }
  }

  let disposedChunks = 0;
  chunks.forEach((chunk, key) => {
    if (desiredKeys.has(key)) return;
    if (chunk.mesh) {
      group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    chunks.delete(key);
    disposedChunks += 1;
  });

  orderedMeshes.forEach((mesh) => group.add(mesh));

  return {
    createdChunks,
    disposedChunks,
    cachedChunks: chunks.size,
    visibleChunks: orderedMeshes.length,
  };
}

function makeOceanChunk(material: THREE.MeshBasicMaterial, xChunk: number, zChunk: number): OceanChunk {
  const xMin = xChunk * oceanChunkSize;
  const zMin = zChunk * oceanChunkSize;
  if (!chunkMayContainOcean(xMin, xMin + oceanChunkSize, zMin, zMin + oceanChunkSize)) {
    return { mesh: null };
  }

  const geometry = makeOceanGeometry(xMin, xMin + oceanChunkSize, zMin, zMin + oceanChunkSize);
  if (geometry.getAttribute("position").count === 0) {
    geometry.dispose();
    return { mesh: null };
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `spherical-ocean-chunk-${xChunk}-${zChunk}`;
  mesh.renderOrder = 1;
  return { mesh };
}

function oceanChunkKey(xChunk: number, zChunk: number): string {
  return `${xChunk}:${zChunk}`;
}

function chunkMayContainOcean(xMin: number, xMax: number, zMin: number, zMax: number): boolean {
  const center = { x: (xMin + xMax) * 0.5, z: (zMin + zMax) * 0.5 };
  return OCEAN_REGIONS.some((region) => {
    const conservativeRadius = region.baseRadius + oceanChunkCullPadding + oceanChunkHalfDiagonal;
    return surfaceDistanceBetweenLocal(center, region.center) <= conservativeRadius;
  });
}

function makeOceanGeometry(xMin: number, xMax: number, zMin: number, zMax: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const cellSizeX = (xMax - xMin) / oceanChunkSegments;
  const cellSizeZ = (zMax - zMin) / oceanChunkSegments;

  for (let zIndex = 0; zIndex <= oceanChunkSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex <= oceanChunkSegments; xIndex += 1) {
      const x = xMin + xIndex * cellSizeX;
      const z = zMin + zIndex * cellSizeZ;
      const state = oceanStateAt(x, z);
      const point = pointOnPlanet(x, z, waterSurfaceHeightAt(x, z));
      const colour = setOceanColourForState(state, x, z, oceanColourScratch);
      positions.push(point.x, point.y, point.z);
      colours.push(colour.r, colour.g, colour.b, waterAlphaForState(state));
    }
  }

  for (let zIndex = 0; zIndex < oceanChunkSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < oceanChunkSegments; xIndex += 1) {
      const x0 = xMin + xIndex * cellSizeX;
      const x1 = x0 + cellSizeX;
      const z0 = zMin + zIndex * cellSizeZ;
      const z1 = z0 + cellSizeZ;
      if (!shouldRenderOceanCell(x0, x1, z0, z1)) continue;

      const row = oceanChunkSegments + 1;
      const topLeft = zIndex * row + xIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + row;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shouldRenderOceanCell(x0: number, x1: number, z0: number, z1: number): boolean {
  const centerX = (x0 + x1) * 0.5;
  const centerZ = (z0 + z1) * 0.5;
  const samples = [
    oceanStateAt(centerX, centerZ),
    oceanStateAt(x0, z0),
    oceanStateAt(x1, z0),
    oceanStateAt(x0, z1),
    oceanStateAt(x1, z1),
  ];
  return samples.some((state) => waterAlphaForState(state) > 0.05);
}

function waterAlphaForState(state: OceanState): number {
  return 1 - THREE.MathUtils.smoothstep(state.signedShoreDistance, -1.5, 5.5);
}

function waterSurfaceHeightAt(x: number, z: number): number {
  const state = oceanStateAt(x, z);
  const shoreFade = 1 - THREE.MathUtils.smoothstep(Math.abs(state.signedShoreDistance), 0, 18);
  const broadRipple = Math.sin(x * 0.065 + z * 0.031) * 0.028 + Math.cos(x * 0.042 - z * 0.057) * 0.021;
  const fineRipple = Math.sin(x * 0.19 + z * 0.13) * Math.cos(x * 0.11 - z * 0.17) * 0.012;
  return state.waterSurfaceHeight + (broadRipple + fineRipple) * (0.35 + shoreFade * 0.65);
}

function setOceanColourForState(state: OceanState, x: number, z: number, target: THREE.Color): THREE.Color {
  const depthAmount = THREE.MathUtils.clamp((-state.signedShoreDistance - 30) / Math.max(1, state.shorelineRadius * 0.55), 0, 1);
  const shoreAmount = state.normalizedShorelineAmount;
  const shimmer = Math.sin(x * 0.047 + z * 0.081) * 0.5 + Math.cos(x * 0.073 - z * 0.039) * 0.5;
  const palette = oceanPaletteColours[state.nearestRegionId];
  return target.copy(palette.mid).lerp(palette.deep, depthAmount).lerp(palette.shore, shoreAmount * 0.72).offsetHSL(0, 0, shimmer * 0.025);
}

function summarizeOceanRegion(region: OceanRegion, heightSampler: HeightSampler): OceanDebugRegionState {
  const sampleCount = 96;
  let minRadius = Number.POSITIVE_INFINITY;
  let maxRadius = 0;
  let radiusSum = 0;
  let circumference = 0;
  let previous = shorePointAt(region, sampleCount - 1);

  for (let i = 0; i < sampleCount; i += 1) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const radius = shorelineRadiusAtAngle(region, angle);
    const point = shorePointAt(region, i);
    minRadius = Math.min(minRadius, radius);
    maxRadius = Math.max(maxRadius, radius);
    radiusSum += radius;
    circumference += surfaceDistanceBetweenLocal(previous, point);
    previous = point;
  }

  let maxDepth = 0;
  let deepSample = { ...region.center };
  for (let ring = 0; ring <= 4; ring += 1) {
    const ringRadius = region.baseRadius * (ring / 4) * 0.72;
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2 + ring * 0.19;
      const point = normalizePlanetCoords(region.center.x + Math.cos(angle) * ringRadius, region.center.z + Math.sin(angle) * ringRadius);
      const depth = region.waterSurfaceHeight - heightSampler(point.x, point.z);
      if (depth > maxDepth) {
        maxDepth = depth;
        deepSample = point;
      }
    }
  }

  const shoreSample = shorePointAt(region, 0);
  const outsideShoreSample = normalizePlanetCoords(region.center.x + maxRadius + 36, region.center.z);
  const shorelineSamples = Array.from({ length: 12 }, (_, index) => shorelineDebugSampleAt(region, (index / 12) * Math.PI * 2));

  return {
    id: region.id,
    name: region.name,
    palette: oceanPaletteDebug(region.palette),
    center: { ...region.center },
    waterSurfaceHeight: region.waterSurfaceHeight,
    baseRadius: region.baseRadius,
    minShorelineRadius: minRadius,
    maxShorelineRadius: maxRadius,
    meanShorelineRadius: radiusSum / sampleCount,
    estimatedShorelineCircumference: circumference,
    maxTerrainDepthBelowSurface: maxDepth,
    deepSample,
    shoreSample,
    outsideShoreSample,
    shorelineSamples,
  };
}

function makeOceanPaletteColours(palette: OceanPalette): OceanPaletteColours {
  return {
    deep: new THREE.Color(palette.deep),
    mid: new THREE.Color(palette.mid),
    shore: new THREE.Color(palette.shore),
  };
}

function oceanPaletteDebug(palette: OceanPalette): OceanDebugRegionState["palette"] {
  return {
    deep: oceanColourHex(palette.deep),
    mid: oceanColourHex(palette.mid),
    shore: oceanColourHex(palette.shore),
  };
}

function oceanColourHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function shorelineDebugSampleAt(
  region: OceanRegion,
  angle: number
): { angle: number; inside: LocalPlanetPoint; outside: LocalPlanetPoint } {
  let inside = pointAtSignedShoreDistance(region, angle, -24);
  let outside = pointAtSignedShoreDistance(region, angle, 8);

  for (let i = 0; i < 12 && !oceanStateAt(inside.x, inside.z).isInOcean; i += 1) {
    inside = pointAtSignedShoreDistance(region, angle, -24 - i * 8);
  }

  for (let i = 0; i < 12 && oceanStateAt(outside.x, outside.z).isInOcean; i += 1) {
    outside = pointAtSignedShoreDistance(region, angle, 8 + i * 8);
  }

  return { angle, inside, outside };
}

function pointAtSignedShoreDistance(region: OceanRegion, angle: number, targetSignedDistance: number): LocalPlanetPoint {
  let low = 0;
  let high = region.baseRadius + 180;

  for (let i = 0; i < 22; i += 1) {
    const radius = (low + high) * 0.5;
    const point = pointAtPolarOffset(region, angle, radius);
    const signedDistance = oceanStateAt(point.x, point.z).signedShoreDistance;
    if (signedDistance < targetSignedDistance) {
      low = radius;
    } else {
      high = radius;
    }
  }

  return pointAtPolarOffset(region, angle, (low + high) * 0.5);
}

function pointAtPolarOffset(region: OceanRegion, angle: number, radius: number): LocalPlanetPoint {
  return normalizePlanetCoords(region.center.x + Math.cos(angle) * radius, region.center.z + Math.sin(angle) * radius);
}

function shorePointAt(region: OceanRegion, sampleIndex: number): LocalPlanetPoint {
  const sampleCount = 96;
  const angle = (sampleIndex / sampleCount) * Math.PI * 2;
  const radius = shorelineRadiusAtAngle(region, angle);
  return normalizePlanetCoords(region.center.x + Math.cos(angle) * radius, region.center.z + Math.sin(angle) * radius);
}

function shorelineRadiusAt(region: OceanRegion, x: number, z: number): number {
  const delta = localDeltaFromCenter(region.center, x, z);
  const angle = Math.atan2(delta.z, delta.x);
  return shorelineRadiusAtAngle(region, angle);
}

function shorelineRadiusAtAngle(region: OceanRegion, angle: number): number {
  const sectors = 40;
  const sector = Math.floor(THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI * 2) * sectors);
  const broad =
    Math.sin(sector * 0.73 + region.seed) * 0.56 +
    Math.cos(sector * 0.41 - region.seed * 1.7) * 0.34 +
    Math.sin(sector * 1.17 + region.seed * 0.31) * 0.24;
  const stepped = Math.round(broad * 3) / 3;
  return region.baseRadius + stepped * 34 + Math.sin(sector * 2.11 + region.seed) * 9;
}

function basinNoiseAt(x: number, z: number): number {
  const blockX = Math.floor(x / 28);
  const blockZ = Math.floor(z / 28);
  return (
    Math.sin(blockX * 0.83 + blockZ * 0.19) * 0.52 +
    Math.cos(blockZ * 0.71 - blockX * 0.37) * 0.36 +
    Math.sin((blockX + blockZ) * 0.29) * 0.22
  );
}

function localDeltaFromCenter(center: LocalPlanetPoint, x: number, z: number): LocalPlanetPoint {
  const normalized = normalizePlanetCoords(x, z);
  let dx = normalized.x - center.x;
  if (dx > PLANET_CIRCUMFERENCE * 0.5) dx -= PLANET_CIRCUMFERENCE;
  if (dx < -PLANET_CIRCUMFERENCE * 0.5) dx += PLANET_CIRCUMFERENCE;
  return { x: dx, z: normalized.z - center.z };
}
