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
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
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
      const vertexIndex = positions.length / 3;
      const p00 = pointOnPlanet(x0, z0, y00 + lift);
      const p10 = pointOnPlanet(x1, z0, y10 + lift);
      const p01 = pointOnPlanet(x0, z1, y01 + lift);
      const p11 = pointOnPlanet(x1, z1, y11 + lift);

      positions.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z, p11.x, p11.y, p11.z);
      terrainCoords.push(x0, z0, x1, z0, x0, z1, x1, z1);
      terrainHeights.push(y00, y10, y01, y11);

      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("terrainCoord", new THREE.Float32BufferAttribute(terrainCoords, 2));
  geometry.setAttribute("terrainHeight", new THREE.Float32BufferAttribute(terrainHeights, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTerrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: `
      attribute vec2 terrainCoord;
      attribute float terrainHeight;
      varying vec2 vTerrainCoord;
      varying float vTerrainHeight;
      #include <fog_pars_vertex>

      void main() {
        vTerrainCoord = terrainCoord;
        vTerrainHeight = terrainHeight;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      varying vec2 vTerrainCoord;
      varying float vTerrainHeight;
      #include <fog_pars_fragment>

      float steppedBoundaryContour(vec2 tile, float seed) {
        const float stepSize = 2.0;
        vec2 stepped = (floor(tile / stepSize) + 0.5) * stepSize;
        vec2 warped = stepped + vec2(
          sin(stepped.y * 0.047 + seed * 1.7) * 14.0 + sin((stepped.x + stepped.y) * 0.029 + seed * 2.3) * 7.0,
          cos(stepped.x * 0.041 - seed * 1.1) * 13.0 + sin((stepped.x - stepped.y) * 0.035 + seed * 0.9) * 6.0
        );
        float contour = (
          sin(warped.x * 0.083 + sin(warped.y * 0.038 + seed) * 1.9) +
          cos(warped.y * 0.071 + cos(warped.x * 0.036 - seed) * 1.7) +
          sin((warped.x - warped.y) * 0.052 + seed * 2.1)
        ) / 3.0;
        float blockTurn =
          sin(floor((tile.x + tile.y) / (stepSize * 3.0)) * 1.37 + seed) * 0.18 +
          sin(floor(tile.x / (stepSize * 2.0)) * 1.21 + seed * 1.9) * 0.12 +
          cos(floor(tile.y / (stepSize * 2.0)) * 1.43 - seed * 1.4) * 0.12;
        float combined = contour + blockTurn;
        float quantized = sign(combined) * floor(abs(combined) * 4.0 + 0.5) / 4.0;
        return clamp(quantized, -1.0, 1.0);
      }

      float materialBand(float palettePosition, vec2 tile) {
        float band = 0.0;
        for (int thresholdIndex = 1; thresholdIndex < 6; thresholdIndex += 1) {
          float threshold = float(thresholdIndex) / 6.0 + steppedBoundaryContour(tile, float(thresholdIndex)) * 0.018;
          if (palettePosition >= threshold) {
            band = float(thresholdIndex);
          }
        }
        return band;
      }

      vec3 oldTerrainPalette(float band) {
        if (band < 0.5) return vec3(0.6078, 0.3882, 0.7686);
        if (band < 1.5) return vec3(0.4314, 0.4706, 0.8745);
        if (band < 2.5) return vec3(0.3216, 0.7216, 0.7333);
        if (band < 3.5) return vec3(0.7137, 0.7882, 0.3569);
        if (band < 4.5) return vec3(0.9255, 0.4980, 0.6980);
        return vec3(1.0, 0.6941, 0.3686);
      }

      void main() {
        vec2 boundaryTile = (floor(vTerrainCoord / 2.0) + 0.5) * 2.0;
        vec2 materialTile = (floor(vTerrainCoord / 4.0) + 0.5) * 4.0;
        vec2 sampleOffset = vec2(
          steppedBoundaryContour(boundaryTile, 2.8),
          steppedBoundaryContour(boundaryTile, 4.4)
        ) * 6.5;
        vec2 sampleTile = materialTile + sampleOffset;
        float altitude = clamp((vTerrainHeight + 2.0) / 14.0, 0.0, 1.0);
        float mineral = (sin(sampleTile.x * 0.15) + cos(sampleTile.y * 0.12) + 2.0) / 4.0;
        float pixelFleck = (sin(sampleTile.x * 1.45 + sampleTile.y * 2.1) + 1.0) * 0.5;
        float palettePosition = clamp(
          altitude * 0.64 + mineral * 0.28 + pixelFleck * 0.04 + steppedBoundaryContour(boundaryTile, 0.65) * 0.075,
          0.0,
          0.999
        );
        gl_FragColor = vec4(oldTerrainPalette(materialBand(palettePosition, boundaryTile)), 1.0);
        #include <fog_fragment>
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
