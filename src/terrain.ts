import * as THREE from "three";
import { detailCoordinatesAt, normalizePlanetCoords, placeObjectOnPlanet, pointOnPlanet, PLANET_RADIUS } from "./planet";

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

function mound(x: number, z: number, centerX: number, centerZ: number, radiusX: number, radiusZ: number, height: number): number {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  return Math.max(0, 1 - dx * dx - dz * dz) * height;
}

const terrainChunkSize = 96;
const terrainChunkSegments = 24;
const terrainChunkRadius = 5;
const terrainChunkCellSize = terrainChunkSize / terrainChunkSegments;
const boundaryStepSize = terrainChunkCellSize;

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

function rebuildTerrainChunks(group: THREE.Group, terrainMaterial: THREE.ShaderMaterial, centerChunkX: number, centerChunkZ: number): void {
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
  const terrainCoords: number[] = [];
  const terrainHeights: number[] = [];
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
      const detail = detailCoordinatesAt(centerX, centerZ);

      const palettePosition = terrainPalettePosition(centerY, detail.x, detail.z);
      const band = THREE.MathUtils.clamp(Math.floor(palettePosition * terrainPalette.length), 0, terrainPalette.length - 1);
      const colour = terrainPalette[band];
      const vertexIndex = positions.length / 3;
      const p00 = pointOnPlanet(x0, z0, y00 + lift);
      const p10 = pointOnPlanet(x1, z0, y10 + lift);
      const p01 = pointOnPlanet(x0, z1, y01 + lift);
      const p11 = pointOnPlanet(x1, z1, y11 + lift);

      positions.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z, p11.x, p11.y, p11.z);
      terrainCoords.push(x0, z0, x1, z0, x0, z1, x1, z1);
      terrainHeights.push(y00, y10, y01, y11);

      for (let i = 0; i < 4; i += 1) {
        colours.push(colour.r, colour.g, colour.b);
      }

      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute("terrainCoord", new THREE.Float32BufferAttribute(terrainCoords, 2));
  geometry.setAttribute("terrainHeight", new THREE.Float32BufferAttribute(terrainHeights, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function terrainPalettePosition(centerY: number, detailX: number, detailZ: number): number {
  const altitude = THREE.MathUtils.clamp((centerY + 2) / 14, 0, 1);
  const mineral = (Math.sin(detailX * 0.15) + Math.cos(detailZ * 0.12) + 2) / 4;
  const pixelFleck = (Math.sin(detailX * 1.45 + detailZ * 2.1) + 1) * 0.5;
  const organicField = steppedBoundaryField(detailX, detailZ);
  const basePosition = 0.34 + altitude * 0.18 + mineral * 0.08 + (organicField - 0.5) * 0.18 + pixelFleck * 0.04;
  const bandPosition = basePosition * terrainPalette.length + steppedBoundaryBandJitter(detailX, detailZ) * 0.18;
  return THREE.MathUtils.clamp(bandPosition / terrainPalette.length, 0, 0.999);
}

function steppedBoundaryField(detailX: number, detailZ: number): number {
  const warpX = Math.sin(detailZ * 0.083) * 9.5 + Math.sin((detailX + detailZ) * 0.047) * 5.5;
  const warpZ = Math.cos(detailX * 0.071) * 8.5 + Math.sin((detailX - detailZ) * 0.052) * 6;
  const warpedX = detailX + warpX;
  const warpedZ = detailZ + warpZ;
  const cellX = Math.floor(detailX / boundaryStepSize);
  const cellZ = Math.floor(detailZ / boundaryStepSize);
  const lobeA = Math.sin(warpedX * 0.092 + Math.sin(warpedZ * 0.056) * 2.3);
  const lobeB = Math.cos(warpedZ * 0.088 + Math.cos(warpedX * 0.049) * 2.1);
  const lobeC = Math.sin((warpedX - warpedZ) * 0.061 + Math.cos((warpedX + warpedZ) * 0.041) * 2.6);
  const chipped = hashCell(cellX + 17, cellZ - 23) * 2 - 1;
  return THREE.MathUtils.clamp((lobeA + lobeB + lobeC + 3) / 6 + chipped * 0.06, 0, 1);
}

function steppedBoundaryBandJitter(detailX: number, detailZ: number): number {
  const cellX = Math.floor(detailX / boundaryStepSize);
  const cellZ = Math.floor(detailZ / boundaryStepSize);
  const wobbleA = Math.sin(cellX * 0.63 + cellZ * 0.19 + Math.sin(cellZ * 0.41) * 1.7);
  const wobbleB = Math.cos(cellZ * 0.58 - cellX * 0.27 + Math.sin(cellX * 0.33) * 1.3);
  const diagonalBreak = Math.sin((cellX + cellZ) * 0.37 + Math.cos((cellX - cellZ) * 0.29) * 1.9);
  const pixelNudge = hashCell(cellX, cellZ) * 2 - 1;
  return wobbleA * 1.42 + wobbleB * 1.12 + diagonalBreak * 0.86 + pixelNudge * 0.72;
}

function hashCell(cellX: number, cellZ: number): number {
  let state = (Math.imul(cellX, 374761393) ^ Math.imul(cellZ, 668265263) ^ 0x85ebca6b) >>> 0;
  state = Math.imul(state ^ (state >>> 13), 1274126177) >>> 0;
  state = (state ^ (state >>> 16)) >>> 0;
  return state / 0xffffffff;
}

function makeTerrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec2 terrainCoord;
      attribute float terrainHeight;
      varying vec2 vTerrainCoord;
      varying float vTerrainHeight;

      void main() {
        vTerrainCoord = terrainCoord;
        vTerrainHeight = terrainHeight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vTerrainCoord;
      varying float vTerrainHeight;

      float hashCell(vec2 cell) {
        vec3 p3 = fract(vec3(cell.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec3 palette(float band) {
        if (band < 0.5) return vec3(0.6078, 0.3882, 0.7686);
        if (band < 1.5) return vec3(0.4314, 0.4706, 0.8745);
        if (band < 2.5) return vec3(0.3216, 0.7216, 0.7333);
        if (band < 3.5) return vec3(0.7137, 0.7882, 0.3569);
        if (band < 4.5) return vec3(0.9255, 0.4980, 0.6980);
        return vec3(1.0, 0.6941, 0.3686);
      }

      void main() {
        float pixelSize = 2.0;
        vec2 cell = floor(vTerrainCoord / pixelSize);
        vec2 p = cell * pixelSize;
        float warpX = sin(p.y * 0.083) * 9.5 + sin((p.x + p.y) * 0.047) * 5.5;
        float warpY = cos(p.x * 0.071) * 8.5 + sin((p.x - p.y) * 0.052) * 6.0;
        vec2 warped = p + vec2(warpX, warpY);
        float lobeA = sin(warped.x * 0.092 + sin(warped.y * 0.056) * 2.3);
        float lobeB = cos(warped.y * 0.088 + cos(warped.x * 0.049) * 2.1);
        float lobeC = sin((warped.x - warped.y) * 0.061 + cos((warped.x + warped.y) * 0.041) * 2.6);
        float chipped = hashCell(cell + vec2(17.0, -23.0)) * 2.0 - 1.0;
        float organic = clamp((lobeA + lobeB + lobeC + 3.0) / 6.0 + chipped * 0.12, 0.0, 1.0);
        float altitude = clamp((vTerrainHeight + 2.0) / 14.0, 0.0, 1.0);
        float mineral = (sin(p.x * 0.15) + cos(p.y * 0.12) + 2.0) / 4.0;
        float fleck = hashCell(cell * 1.7 + vec2(5.0, 11.0));
        float field = altitude * 0.16 + mineral * 0.12 + organic * 0.62 + fleck * 0.1;
        float band = floor(clamp(field * 6.0, 0.0, 5.999));
        gl_FragColor = vec4(palette(band), 1.0);
      }
    `,
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
