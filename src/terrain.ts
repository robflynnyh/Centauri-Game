import * as THREE from "three";
import { detailCoordinatesAt, normalizePlanetCoords, placeObjectOnPlanet, pointOnPlanet, PLANET_RADIUS } from "./planet";
import { oceanTerrainOffsetAt } from "./water";

export type TerrainSystem = {
  group: THREE.Group;
  update: (centerX: number, centerZ: number) => void;
  getTerrainPerfState: () => TerrainPerfState;
  getTerrainState: () => {
    centerX: number;
    centerZ: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cellSize: number;
    chunkSize: number;
    chunkCount: number;
  };
};

export type TerrainPerfState = {
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

type TerrainChunk = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

type TerrainChunkSyncStats = {
  createdChunks: number;
  disposedChunks: number;
  cachedChunks: number;
  visibleChunks: number;
};

const terrainPalette = [
  new THREE.Color(0x9b63c4),
  new THREE.Color(0x6e78df),
  new THREE.Color(0x52b8bb),
  new THREE.Color(0xb6c95b),
  new THREE.Color(0xec7fb2),
  new THREE.Color(0xffb15e),
];

export function heightAt(x: number, z: number): number {
  const detail = detailCoordinatesAt(x, z);
  const tileX = detail.x;
  const tileZ = detail.z;
  const d = Math.sqrt(tileX * tileX + tileZ * tileZ);
  const island = Math.max(0, 1 - Math.pow(d / 106, 2.28));
  const ridges = Math.sin(tileX * 0.18) * Math.cos(tileZ * 0.16) * 1.45;
  const alienPulse = Math.sin((tileX + tileZ) * 0.07) * 0.85 + Math.sin(Math.hypot(tileX, tileZ) * 0.28) * 0.7;
  const northShoulder = Math.max(0, 1 - Math.abs(tileZ + 55) / 24) * (1 - Math.min(Math.abs(tileX) / 106, 1)) * 3.1;
  const westShelf = Math.max(0, 1 - Math.abs(tileX + 64) / 26) * (1 - Math.min(Math.abs(tileZ) / 96, 1)) * 1.8;
  const baseHeight =
    island * (ridges + alienPulse + 8.5) - 3.2 + northShoulder + westShelf + mountainHeightAt(tileX, tileZ) + globeUndulationAt(x, z);
  return baseHeight + oceanTerrainOffsetAt(x, z, baseHeight);
}

function globeUndulationAt(x: number, z: number): number {
  const normalized = normalizePlanetCoords(x, z);
  const longitude = normalized.x / PLANET_RADIUS;
  const latitude = normalized.z / PLANET_RADIUS;
  const wrappedTile = detailCoordinatesAt(x, z);
  const seamFade = THREE.MathUtils.smoothstep(Math.hypot(wrappedTile.x, wrappedTile.z), 82, 118);
  const waveA = Math.sin(Math.sin(longitude) * 7.1 + Math.cos(latitude * 1.7) * 3.6);
  const waveB = Math.sin(Math.cos(longitude * 2.3) * 4.2 + Math.sin(latitude * 2.1) * 5.4);
  return seamFade * (waveA * 1.15 + waveB * 0.85);
}

function mountainHeightAt(x: number, z: number): number {
  const northBelt = Math.max(0, 1 - Math.abs(z + 72) / 28);
  const northTaper = 1 - Math.min(Math.abs(x) / 116, 1);
  const northCrests = Math.pow(northBelt, 1.8) * Math.pow(Math.max(0, northTaper), 0.75);
  const serration = 0.64 + Math.abs(Math.sin(x * 0.105 + Math.sin(z * 0.045) * 1.8)) * 0.56;

  const sideMasses =
    mound(x, z, -78, -42, 18, 24, 7.8) +
    mound(x, z, 82, -54, 20, 28, 9.4) +
    mound(x, z, 74, 34, 18, 22, 6.5);

  return northCrests * serration * 14.5 + sideMasses;
}

function mound(x: number, z: number, centerX: number, centerZ: number, radiusX: number, radiusZ: number, height: number): number {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  return Math.max(0, 1 - dx * dx - dz * dz) * height;
}

const terrainChunkSize = 96;
const terrainChunkSegments = 24;
const terrainChunkRadius = 5;
const terrainChunkCellSize = terrainChunkSize / terrainChunkSegments;
const terrainColourBlockSize = terrainChunkCellSize * 2;

export function createTerrainSystem(): TerrainSystem {
  const group = new THREE.Group();
  group.name = "spherical-planet-terrain";
  const terrainMaterial = makeTerrainMaterial();
  const perfState: TerrainPerfState = {
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
  const chunks = new Map<string, TerrainChunk>();

  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;

  const update = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / terrainChunkSize);
    const nextChunkZ = Math.floor(normalized.z / terrainChunkSize);
    if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;

    centerChunkX = nextChunkX;
    centerChunkZ = nextChunkZ;
    const rebuildStart = performance.now();
    const stats = syncTerrainChunks(group, terrainMaterial, chunks, centerChunkX, centerChunkZ);
    const rebuildMs = performance.now() - rebuildStart;
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
    getTerrainPerfState: () => ({ ...perfState }),
    getTerrainState: () => getTerrainState(centerChunkX, centerChunkZ),
  };
}

function syncTerrainChunks(
  group: THREE.Group,
  terrainMaterial: THREE.MeshBasicMaterial,
  chunks: Map<string, TerrainChunk>,
  centerChunkX: number,
  centerChunkZ: number
): TerrainChunkSyncStats {
  const desiredKeys = new Set<string>();
  const orderedChunks: TerrainChunk[] = [];
  let createdChunks = 0;

  for (let zChunk = centerChunkZ - terrainChunkRadius; zChunk <= centerChunkZ + terrainChunkRadius; zChunk += 1) {
    for (let xChunk = centerChunkX - terrainChunkRadius; xChunk <= centerChunkX + terrainChunkRadius; xChunk += 1) {
      const key = terrainChunkKey(xChunk, zChunk);
      desiredKeys.add(key);
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = makeTerrainChunk(terrainMaterial, xChunk, zChunk);
        chunks.set(key, chunk);
        createdChunks += 1;
      }
      orderedChunks.push(chunk);
    }
  }

  let disposedChunks = 0;
  chunks.forEach((chunk, key) => {
    if (desiredKeys.has(key)) return;
    group.remove(chunk);
    chunk.geometry.dispose();
    chunks.delete(key);
    disposedChunks += 1;
  });

  orderedChunks.forEach((chunk) => group.add(chunk));

  return {
    createdChunks,
    disposedChunks,
    cachedChunks: chunks.size,
    visibleChunks: orderedChunks.length,
  };
}

function makeTerrainChunk(terrainMaterial: THREE.MeshBasicMaterial, xChunk: number, zChunk: number): TerrainChunk {
  const xMin = xChunk * terrainChunkSize;
  const zMin = zChunk * terrainChunkSize;
  const chunk = new THREE.Mesh(
    makeTerrainGeometry(xMin, xMin + terrainChunkSize, zMin, zMin + terrainChunkSize, terrainChunkSegments, terrainChunkSegments),
    terrainMaterial
  );
  chunk.name = `spherical-terrain-chunk-${xChunk}-${zChunk}`;
  return chunk;
}

function terrainChunkKey(xChunk: number, zChunk: number): string {
  return `${xChunk}:${zChunk}`;
}

function getTerrainState(
  centerChunkX: number,
  centerChunkZ: number
): ReturnType<TerrainSystem["getTerrainState"]> {
  const minChunkX = centerChunkX - terrainChunkRadius;
  const maxChunkX = centerChunkX + terrainChunkRadius + 1;
  const minChunkZ = centerChunkZ - terrainChunkRadius;
  const maxChunkZ = centerChunkZ + terrainChunkRadius + 1;
  return {
    centerX: (minChunkX + maxChunkX) * 0.5 * terrainChunkSize,
    centerZ: (minChunkZ + maxChunkZ) * 0.5 * terrainChunkSize,
    minX: minChunkX * terrainChunkSize,
    maxX: maxChunkX * terrainChunkSize,
    minZ: minChunkZ * terrainChunkSize,
    maxZ: maxChunkZ * terrainChunkSize,
    cellSize: terrainChunkCellSize,
    chunkSize: terrainChunkSize,
    chunkCount: Math.pow(terrainChunkRadius * 2 + 1, 2),
  };
}

function terrainColourForCell(centerX: number, centerZ: number, centerY: number): THREE.Color {
  const detail = detailCoordinatesAt(centerX, centerZ);
  const blockX = Math.floor(detail.x / terrainColourBlockSize);
  const blockZ = Math.floor(detail.z / terrainColourBlockSize);
  const blockCenterX = (blockX + 0.5) * terrainColourBlockSize;
  const blockCenterZ = (blockZ + 0.5) * terrainColourBlockSize;

  const altitude = THREE.MathUtils.clamp((centerY + 2) / 14, 0, 1);
  const broadMineral = (Math.sin(blockCenterX * 0.095) + Math.cos(blockCenterZ * 0.085) + 2) / 4;
  const steppedBoundary =
    Math.sin(blockX * 0.77 + blockZ * 0.31) * 0.42 +
    Math.cos(blockX * 0.41 - blockZ * 0.69) * 0.36 +
    Math.sin((blockX + blockZ) * 0.27) * 0.22;
  const palettePosition = THREE.MathUtils.clamp(altitude * 0.68 + broadMineral * 0.18 + steppedBoundary * 0.14, 0, 0.999);
  const band = Math.floor(palettePosition * terrainPalette.length);
  return terrainPalette[band];
}

function makeTerrainGeometry(
  xMin: number,
  xMax: number,
  zMin: number,
  zMax: number,
  xSegments: number,
  zSegments: number,
  lift = 0
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const cellSizeX = (xMax - xMin) / xSegments;
  const cellSizeZ = (zMax - zMin) / zSegments;

  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const x0 = xMin + xIndex * cellSizeX;
      const x1 = x0 + cellSizeX;
      const z0 = zMin + zIndex * cellSizeZ;
      const z1 = z0 + cellSizeZ;
      const y00 = heightAt(x0, z0);
      const y10 = heightAt(x1, z0);
      const y01 = heightAt(x0, z1);
      const y11 = heightAt(x1, z1);
      const centerX = (x0 + x1) * 0.5;
      const centerZ = (z0 + z1) * 0.5;
      const centerY = (y00 + y10 + y01 + y11) * 0.25;

      const colour = terrainColourForCell(centerX, centerZ, centerY);
      const vertexIndex = positions.length / 3;
      const p00 = pointOnPlanet(x0, z0, y00 + lift);
      const p10 = pointOnPlanet(x1, z0, y10 + lift);
      const p01 = pointOnPlanet(x0, z1, y01 + lift);
      const p11 = pointOnPlanet(x1, z1, y11 + lift);

      positions.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z, p11.x, p11.y, p11.z);

      for (let i = 0; i < 4; i += 1) {
        colours.push(colour.r, colour.g, colour.b);
      }

      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTerrainMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}

export function makeHorizonLandforms(): THREE.Group {
  const group = new THREE.Group();
  const crestMaterial = new THREE.MeshBasicMaterial({ color: 0x4e2d88, side: THREE.DoubleSide });
  const butteMaterial = new THREE.MeshBasicMaterial({ color: 0xd25598, side: THREE.DoubleSide });

  addCrestStones(group, crestMaterial);
  addSideButtes(group, butteMaterial);
  return group;
}

function addCrestStones(group: THREE.Group, material: THREE.Material): void {
  const placements = [
    { x: -58, z: -74, height: 2.4, radius: 1.8, lean: -0.35 },
    { x: -34, z: -80, height: 3.3, radius: 2.2, lean: 0.22 },
    { x: -8, z: -73, height: 2.8, radius: 1.9, lean: -0.16 },
    { x: 21, z: -78, height: 3.7, radius: 2.4, lean: 0.31 },
    { x: 52, z: -70, height: 2.6, radius: 1.8, lean: -0.24 },
  ];

  placements.forEach(({ x, z, height, radius, lean }) => {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    placeObjectOnPlanet(crest, x, z, heightAt(x, z) + height * 0.5 - 0.08, new THREE.Euler(lean * 0.25, x * 0.01, lean));
    crest.scale.x = 1.2;
    crest.scale.z = 0.7;
    group.add(crest);
  });
}

function addSideButtes(group: THREE.Group, material: THREE.Material): void {
  const placements = [
    { x: -86, z: -48, height: 13, radius: 7, lean: -0.28 },
    { x: -72, z: 64, height: 10, radius: 6, lean: 0.22 },
    { x: 78, z: -62, height: 15, radius: 8, lean: 0.34 },
    { x: 92, z: 28, height: 11, radius: 6, lean: -0.18 },
  ];

  placements.forEach(({ x, z, height, radius, lean }) => {
    const butte = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    placeObjectOnPlanet(butte, x, z, heightAt(x, z) + height * 0.5 - 0.8, new THREE.Euler(lean * 0.25, x * 0.01, lean));
    butte.scale.x = 1.4;
    butte.scale.z = 0.72;
    group.add(butte);
  });
}
