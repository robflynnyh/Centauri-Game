import * as THREE from "three";
import { detailCoordinatesAt, normalizePlanetCoords, placeObjectOnPlanet, pointOnPlanet, PLANET_RADIUS } from "./planet";

export type MassiveMountainPathSample = {
  x: number;
  z: number;
  progress: number;
  width: number;
  height: number;
};

export type MassiveMountainDebugState = {
  center: { x: number; z: number };
  base: { x: number; z: number; height: number };
  peak: { x: number; z: number; height: number };
  normalMountainPeakHeight: number;
  mountainRise: number;
  pathSamples: MassiveMountainPathSample[];
  steepFaceSamples: { x: number; z: number; height: number; slope: number; slipperiness: number; downhillX: number; downhillZ: number }[];
  reservedZones: { x: number; z: number; radius: number }[];
};

export type TerrainSystem = {
  group: THREE.Group;
  update: (centerX: number, centerZ: number) => void;
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

const terrainPalette = [
  new THREE.Color(0x9b63c4),
  new THREE.Color(0x6e78df),
  new THREE.Color(0x52b8bb),
  new THREE.Color(0xb6c95b),
  new THREE.Color(0xec7fb2),
  new THREE.Color(0xffb15e),
];

export function heightAt(x: number, z: number): number {
  const baseHeight = baseTerrainHeightAt(x, z);
  return baseHeight + massiveMountainHeightAt(x, z, baseHeight);
}

function baseTerrainHeightAt(x: number, z: number): number {
  const detail = detailCoordinatesAt(x, z);
  const tileX = detail.x;
  const tileZ = detail.z;
  const d = Math.sqrt(tileX * tileX + tileZ * tileZ);
  const island = Math.max(0, 1 - Math.pow(d / 106, 2.28));
  const ridges = Math.sin(tileX * 0.18) * Math.cos(tileZ * 0.16) * 1.45;
  const alienPulse = Math.sin((tileX + tileZ) * 0.07) * 0.85 + Math.sin(Math.hypot(tileX, tileZ) * 0.28) * 0.7;
  const northShoulder = Math.max(0, 1 - Math.abs(tileZ + 55) / 24) * (1 - Math.min(Math.abs(tileX) / 106, 1)) * 3.1;
  const westShelf = Math.max(0, 1 - Math.abs(tileX + 64) / 26) * (1 - Math.min(Math.abs(tileZ) / 96, 1)) * 1.8;
  return island * (ridges + alienPulse + 8.5) - 3.2 + northShoulder + westShelf + mountainHeightAt(tileX, tileZ) + globeUndulationAt(x, z);
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

const massiveMountainCenter = normalizePlanetCoords(612, -528);
const massiveMountainRadiusX = 188;
const massiveMountainRadiusZ = 154;
const massiveMountainPeakRise = 68;
const massiveMountainPathWidth = 8.4;
const massiveMountainPathFalloff = 20;
const massiveMountainSlipSlopeStart = 0.32;
const massiveMountainSlipSlopeFull = 0.58;
const massiveMountainPathWaypoints = [
  { x: massiveMountainCenter.x - 142, z: massiveMountainCenter.z + 82, progress: 0 },
  { x: massiveMountainCenter.x - 74, z: massiveMountainCenter.z + 62, progress: 0.14 },
  { x: massiveMountainCenter.x - 130, z: massiveMountainCenter.z + 23, progress: 0.28 },
  { x: massiveMountainCenter.x - 54, z: massiveMountainCenter.z - 12, progress: 0.43 },
  { x: massiveMountainCenter.x - 112, z: massiveMountainCenter.z - 55, progress: 0.58 },
  { x: massiveMountainCenter.x - 22, z: massiveMountainCenter.z - 83, progress: 0.72 },
  { x: massiveMountainCenter.x + 44, z: massiveMountainCenter.z - 38, progress: 0.84 },
  { x: massiveMountainCenter.x + 18, z: massiveMountainCenter.z + 10, progress: 0.94 },
  { x: massiveMountainCenter.x, z: massiveMountainCenter.z, progress: 1 },
];

export const massiveMountainReservedZones = [
  ...massiveMountainPathWaypoints.slice(0, -1).map((point) => ({ x: point.x, z: point.z, radius: massiveMountainPathWidth + 9 })),
  { x: massiveMountainCenter.x, z: massiveMountainCenter.z, radius: 26 },
];

export function isInMassiveMountainFootprint(x: number, z: number, padding = 0): boolean {
  return massiveMountainRadialAt(x, z) <= 1.08 + padding / Math.min(massiveMountainRadiusX, massiveMountainRadiusZ);
}

export function isOnMassiveMountainPath(x: number, z: number, padding = 0): boolean {
  const normalized = normalizePlanetCoords(x, z);
  return nearestMassiveMountainPathSample(normalized.x, normalized.z).distance <= massiveMountainPathWidth + padding;
}

export function massiveMountainPathInfluenceAt(x: number, z: number): number {
  const normalized = normalizePlanetCoords(x, z);
  const path = nearestMassiveMountainPathSample(normalized.x, normalized.z);
  return 1 - THREE.MathUtils.smoothstep(path.distance, massiveMountainPathWidth, massiveMountainPathWidth + massiveMountainPathFalloff);
}

export function massiveMountainSlopeAt(x: number, z: number): number {
  if (!isInMassiveMountainFootprint(x, z, 12)) return 0;

  const sampleDistance = 3.2;
  const east = Math.abs(heightAt(x + sampleDistance, z) - heightAt(x - sampleDistance, z)) / (sampleDistance * 2);
  const north = Math.abs(heightAt(x, z + sampleDistance) - heightAt(x, z - sampleDistance)) / (sampleDistance * 2);
  const diagonalA = Math.abs(heightAt(x + sampleDistance, z + sampleDistance) - heightAt(x - sampleDistance, z - sampleDistance)) / (sampleDistance * Math.SQRT2 * 2);
  const diagonalB = Math.abs(heightAt(x + sampleDistance, z - sampleDistance) - heightAt(x - sampleDistance, z + sampleDistance)) / (sampleDistance * Math.SQRT2 * 2);
  return Math.max(east, north, diagonalA, diagonalB);
}

export function massiveMountainSlipperinessAt(x: number, z: number): number {
  const radial = massiveMountainRadialAt(x, z);
  if (radial > 1.06 || radial < 0.18) return 0;

  const pathInfluence = massiveMountainPathInfluenceAt(x, z);
  const offPathAmount = 1 - THREE.MathUtils.smoothstep(pathInfluence, 0.08, 0.72);
  const steepAmount = THREE.MathUtils.smoothstep(massiveMountainSlopeAt(x, z), massiveMountainSlipSlopeStart, massiveMountainSlipSlopeFull);
  const shoulderFade = 1 - THREE.MathUtils.smoothstep(radial, 0.94, 1.08);
  return THREE.MathUtils.clamp(offPathAmount * steepAmount * shoulderFade, 0, 1);
}

export function massiveMountainDownhillDirectionAt(x: number, z: number): { x: number; z: number } {
  const sampleDistance = 3.2;
  const gradientX = (heightAt(x + sampleDistance, z) - heightAt(x - sampleDistance, z)) / (sampleDistance * 2);
  const gradientZ = (heightAt(x, z + sampleDistance) - heightAt(x, z - sampleDistance)) / (sampleDistance * 2);
  const length = Math.hypot(gradientX, gradientZ);
  if (length < 0.0001) return { x: 0, z: 0 };
  return { x: -gradientX / length, z: -gradientZ / length };
}

export function massiveMountainHeightAt(x: number, z: number, baseHeight = baseTerrainHeightAt(x, z)): number {
  const normalized = normalizePlanetCoords(x, z);
  const dx = normalized.x - massiveMountainCenter.x;
  const dz = normalized.z - massiveMountainCenter.z;
  const radial = Math.sqrt(Math.pow(dx / massiveMountainRadiusX, 2) + Math.pow(dz / massiveMountainRadiusZ, 2));
  const broadShoulder = (1 - THREE.MathUtils.smoothstep(radial, 0.62, 1.18)) * 10;
  const mainMass = Math.pow(1 - THREE.MathUtils.smoothstep(radial, 0.05, 1), 0.92) * massiveMountainPeakRise;
  const summitPlateau = (1 - THREE.MathUtils.smoothstep(radial, 0.05, 0.17)) * 3.8;
  const naturalMountainHeight = baseHeight + broadShoulder + mainMass + summitPlateau;
  const path = nearestMassiveMountainPathSample(normalized.x, normalized.z);
  const pathInfluence = 1 - THREE.MathUtils.smoothstep(path.distance, massiveMountainPathWidth, massiveMountainPathWidth + massiveMountainPathFalloff);

  if (pathInfluence <= 0) {
    return naturalMountainHeight - baseHeight;
  }

  const startHeight = baseTerrainHeightAt(massiveMountainPathWaypoints[0].x, massiveMountainPathWaypoints[0].z) + 1.2;
  const summitHeight = baseTerrainHeightAt(massiveMountainCenter.x, massiveMountainCenter.z) + massiveMountainPeakRise + 2.4;
  const climb = THREE.MathUtils.smoothstep(path.progress, 0, 1);
  const pathHeight = THREE.MathUtils.lerp(startHeight, summitHeight, climb) + Math.sin(path.progress * Math.PI * 6) * 0.55;
  const shelfHeight = THREE.MathUtils.lerp(pathHeight, naturalMountainHeight, 0.08);
  return THREE.MathUtils.lerp(naturalMountainHeight, shelfHeight, pathInfluence) - baseHeight;
}

export function getMassiveMountainDebugState(): MassiveMountainDebugState {
  const base = massiveMountainPathWaypoints[0];
  const pathSamples = sampleMassiveMountainPath();
  const normalMountainPeakHeight = sampleNormalMountainPeakHeight();
  const peakHeight = heightAt(massiveMountainCenter.x, massiveMountainCenter.z);
  return {
    center: { ...massiveMountainCenter },
    base: { x: base.x, z: base.z, height: heightAt(base.x, base.z) },
    peak: { x: massiveMountainCenter.x, z: massiveMountainCenter.z, height: peakHeight },
    normalMountainPeakHeight,
    mountainRise: peakHeight - baseTerrainHeightAt(massiveMountainCenter.x, massiveMountainCenter.z),
    pathSamples,
    steepFaceSamples: sampleMassiveMountainSteepFaces(),
    reservedZones: massiveMountainReservedZones.map((zone) => ({ ...zone })),
  };
}

function sampleMassiveMountainPath(): MassiveMountainPathSample[] {
  const samples: MassiveMountainPathSample[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const progress = i / 12;
    const point = pointOnMassiveMountainPath(progress);
    samples.push({
      x: point.x,
      z: point.z,
      progress,
      width: massiveMountainPathWidth,
      height: heightAt(point.x, point.z),
    });
  }
  return samples;
}

function pointOnMassiveMountainPath(progress: number): { x: number; z: number } {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  for (let i = 0; i < massiveMountainPathWaypoints.length - 1; i += 1) {
    const start = massiveMountainPathWaypoints[i];
    const end = massiveMountainPathWaypoints[i + 1];
    if (clamped < start.progress || clamped > end.progress) continue;
    const localT = (clamped - start.progress) / Math.max(end.progress - start.progress, 0.001);
    return {
      x: THREE.MathUtils.lerp(start.x, end.x, localT),
      z: THREE.MathUtils.lerp(start.z, end.z, localT),
    };
  }
  const last = massiveMountainPathWaypoints[massiveMountainPathWaypoints.length - 1];
  return { x: last.x, z: last.z };
}

function nearestMassiveMountainPathSample(x: number, z: number): { distance: number; progress: number } {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestProgress = 0;

  for (let i = 0; i < massiveMountainPathWaypoints.length - 1; i += 1) {
    const start = massiveMountainPathWaypoints[i];
    const end = massiveMountainPathWaypoints[i + 1];
    const segmentX = end.x - start.x;
    const segmentZ = end.z - start.z;
    const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
    const t = THREE.MathUtils.clamp(((x - start.x) * segmentX + (z - start.z) * segmentZ) / segmentLengthSq, 0, 1);
    const nearestX = start.x + segmentX * t;
    const nearestZ = start.z + segmentZ * t;
    const distance = Math.hypot(x - nearestX, z - nearestZ);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestProgress = THREE.MathUtils.lerp(start.progress, end.progress, t);
    }
  }

  return { distance: nearestDistance, progress: nearestProgress };
}

function massiveMountainRadialAt(x: number, z: number): number {
  const normalized = normalizePlanetCoords(x, z);
  const dx = normalized.x - massiveMountainCenter.x;
  const dz = normalized.z - massiveMountainCenter.z;
  return Math.sqrt(Math.pow(dx / massiveMountainRadiusX, 2) + Math.pow(dz / massiveMountainRadiusZ, 2));
}

function sampleMassiveMountainSteepFaces(): { x: number; z: number; height: number; slope: number; slipperiness: number; downhillX: number; downhillZ: number }[] {
  const candidates: { x: number; z: number; height: number; slope: number; slipperiness: number; downhillX: number; downhillZ: number }[] = [];
  for (let zOffset = -116; zOffset <= 116; zOffset += 16) {
    for (let xOffset = -140; xOffset <= 140; xOffset += 16) {
      const x = massiveMountainCenter.x + xOffset;
      const z = massiveMountainCenter.z + zOffset;
      if (!isInMassiveMountainFootprint(x, z)) continue;
      if (isOnMassiveMountainPath(x, z, 15)) continue;

      const slope = massiveMountainSlopeAt(x, z);
      const slipperiness = massiveMountainSlipperinessAt(x, z);
      if (slipperiness < 0.45) continue;
      const downhill = massiveMountainDownhillDirectionAt(x, z);
      candidates.push({ x, z, height: heightAt(x, z), slope, slipperiness, downhillX: downhill.x, downhillZ: downhill.z });
    }
  }

  return candidates.sort((a, b) => b.slope - a.slope).slice(0, 6);
}

function sampleNormalMountainPeakHeight(): number {
  let peak = Number.NEGATIVE_INFINITY;
  for (let z = -100; z <= -38; z += 4) {
    for (let x = -96; x <= 96; x += 4) {
      peak = Math.max(peak, baseTerrainHeightAt(x, z));
    }
  }
  return peak;
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

  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;

  const update = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / terrainChunkSize);
    const nextChunkZ = Math.floor(normalized.z / terrainChunkSize);
    if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;

    centerChunkX = nextChunkX;
    centerChunkZ = nextChunkZ;
    rebuildTerrainChunks(group, terrainMaterial, centerChunkX, centerChunkZ);
  };

  update(0, 0);

  return {
    group,
    update,
    getTerrainState: () => getTerrainState(centerChunkX, centerChunkZ),
  };
}

function rebuildTerrainChunks(group: THREE.Group, terrainMaterial: THREE.MeshBasicMaterial, centerChunkX: number, centerChunkZ: number): void {
  group.children.forEach((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    mesh.geometry.dispose();
  });
  group.clear();

  for (let zChunk = centerChunkZ - terrainChunkRadius; zChunk <= centerChunkZ + terrainChunkRadius; zChunk += 1) {
    for (let xChunk = centerChunkX - terrainChunkRadius; xChunk <= centerChunkX + terrainChunkRadius; xChunk += 1) {
      const xMin = xChunk * terrainChunkSize;
      const zMin = zChunk * terrainChunkSize;
      const chunk = new THREE.Mesh(
        makeTerrainGeometry(xMin, xMin + terrainChunkSize, zMin, zMin + terrainChunkSize, terrainChunkSegments, terrainChunkSegments),
        terrainMaterial
      );
      chunk.name = `spherical-terrain-chunk-${xChunk}-${zChunk}`;
      group.add(chunk);
    }
  }
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
