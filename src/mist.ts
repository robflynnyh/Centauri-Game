import * as THREE from "three";
import { normalizePlanetCoords, placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

type MistCell = {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  opacityWeight: number;
  lightnessShift: number;
};

type MistPuff = {
  cells: MistCell[];
  opacityWeight: number;
};

type MistPatch = {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  driftAngle: number;
  speed: number;
  radius: number;
  altitude: number;
  phase: number;
  puffs: MistPuff[];
};

export type MistSystem = {
  update: (elapsed: number, focus: LocalPlanetPoint) => void;
};

const mistChunkSize = 112;
const mistChunkRadius = 2;
const maxMistPatches = 24;
const dayMistColour = new THREE.Color(0xffc4ea);
const dayMistAccentColour = new THREE.Color(0xbfeaff);
const nightMistColour = new THREE.Color(0xa8c8ff);
const nightMistAccentColour = new THREE.Color(0xd79cff);
const mistCellGeometry = new THREE.BoxGeometry(1, 1, 1);

export function createMistSystem(scene: THREE.Scene, heightAt: HeightSampler, isDemo: boolean): MistSystem {
  const group = new THREE.Group();
  group.name = "drifting-low-mist";
  scene.add(group);

  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;
  const patches: MistPatch[] = [];

  const rebuildMist = (focus: LocalPlanetPoint): void => {
    const normalized = normalizePlanetCoords(focus.x, focus.z);
    const nextChunkX = Math.floor(normalized.x / mistChunkSize);
    const nextChunkZ = Math.floor(normalized.z / mistChunkSize);
    if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;

    disposeMist(group);
    group.clear();
    patches.length = 0;
    centerChunkX = nextChunkX;
    centerChunkZ = nextChunkZ;

    const candidates: MistPatch[] = [];
    for (let chunkZ = centerChunkZ - mistChunkRadius; chunkZ <= centerChunkZ + mistChunkRadius; chunkZ += 1) {
      for (let chunkX = centerChunkX - mistChunkRadius; chunkX <= centerChunkX + mistChunkRadius; chunkX += 1) {
        const random = createChunkRandom(chunkX, chunkZ);
        const valleyBias = valleyMistBias(chunkX, chunkZ);
        const patchCount = valleyBias > 0.68 || random() > 0.7 ? 1 : 0;

        for (let i = 0; i < patchCount; i += 1) {
          const baseX = chunkX * mistChunkSize + (0.18 + random() * 0.64) * mistChunkSize;
          const baseZ = chunkZ * mistChunkSize + (0.18 + random() * 0.64) * mistChunkSize;
          candidates.push(makeMistPatch(baseX, baseZ, random, valleyBias, isDemo));
        }
      }
    }

    if (isDemo) {
      const demoRandom = createChunkRandom(centerChunkX + 907, centerChunkZ - 613);
      candidates.push(makeMistPatch(normalized.x + 32, normalized.z - 18, demoRandom, 0.88, true));
      candidates.push(makeMistPatch(normalized.x - 26, normalized.z + 22, demoRandom, 0.76, true));
    }

    candidates
      .sort(
        (a, b) =>
          surfaceDistanceBetweenLocal(normalized, { x: a.baseX, z: a.baseZ }) -
          surfaceDistanceBetweenLocal(normalized, { x: b.baseX, z: b.baseZ })
      )
      .slice(0, maxMistPatches)
      .forEach((patch) => {
        patches.push(patch);
        group.add(patch.group);
      });
  };

  return {
    update: (elapsed, focus) => {
      rebuildMist(focus);
      const dayAmount = getDayAmount(elapsed, isDemo);
      const shimmer = Math.sin(elapsed * 0.18) * 0.5 + 0.5;
      const dayColour = dayMistColour.clone().lerp(dayMistAccentColour, shimmer * 0.42);
      const nightColour = nightMistColour.clone().lerp(nightMistAccentColour, shimmer * 0.36);
      const activeColour = nightColour.lerp(dayColour, dayAmount);

      patches.forEach((patch, index) => {
        const drift = elapsed * patch.speed;
        const wobble = Math.sin(elapsed * 0.15 + patch.phase) * patch.radius * 0.16;
        const x = patch.baseX + Math.cos(patch.driftAngle) * drift + Math.cos(patch.driftAngle + Math.PI * 0.5) * wobble;
        const z = patch.baseZ + Math.sin(patch.driftAngle) * drift + Math.sin(patch.driftAngle + Math.PI * 0.5) * wobble;
        const normalized = normalizePlanetCoords(x, z);
        const ground = heightAt(normalized.x, normalized.z);
        const breathing = Math.sin(elapsed * 0.32 + patch.phase) * 0.06;
        const fadeDistance = surfaceDistanceBetweenLocal(focus, normalized);
        const distanceFade = 1 - THREE.MathUtils.smoothstep(fadeDistance, 72, 245);
        const patchPulse = 0.82 + Math.sin(elapsed * 0.22 + patch.phase + index) * 0.12;

        patch.group.visible = distanceFade > 0.015;
        patch.group.scale.setScalar(1 + breathing);
        placeObjectOnPlanet(
          patch.group,
          normalized.x,
          normalized.z,
          ground + patch.altitude + Math.sin(elapsed * 0.27 + patch.phase) * 0.16,
          new THREE.Euler(0, patch.driftAngle + Math.sin(elapsed * 0.07 + patch.phase) * 0.08, 0)
        );

        patch.puffs.forEach(({ cells, opacityWeight }) => {
          cells.forEach((cell) => {
            cell.mesh.material.color.copy(activeColour).offsetHSL(0, -0.04, cell.lightnessShift);
            cell.mesh.material.opacity = distanceFade * patchPulse * opacityWeight * cell.opacityWeight * THREE.MathUtils.lerp(0.5, 0.62, dayAmount);
          });
        });
      });
    },
  };
}

function makeMistPatch(baseX: number, baseZ: number, random: () => number, valleyBias: number, isDemo: boolean): MistPatch {
  const group = new THREE.Group();
  const puffs: MistPuff[] = [];
  const radius = THREE.MathUtils.lerp(5.4, 10.2, random());
  const puffCount = isDemo ? 2 : 1 + Math.floor(random() * 2);

  for (let i = 0; i < puffCount; i += 1) {
    const angle = (i / puffCount) * Math.PI * 2 + random() * 0.42;
    const distance = Math.pow(random(), 0.72) * radius * 0.54;
    const center = new THREE.Vector3(Math.cos(angle) * distance, 0.45 + random() * 0.75, Math.sin(angle) * distance * 0.38);
    const cells = makeMistVoxelPuff(random, center, radius, isDemo);
    cells.forEach((cell) => group.add(cell.mesh));
    puffs.push({ cells, opacityWeight: isDemo ? 0.34 + random() * 0.1 : 0.22 + random() * 0.09 });
  }

  return {
    group,
    baseX,
    baseZ,
    driftAngle: random() * Math.PI * 2,
    speed: THREE.MathUtils.lerp(0.85, 1.55, random()),
    radius,
    altitude: THREE.MathUtils.lerp(1.15, 2.4, valleyBias),
    phase: random() * Math.PI * 2,
    puffs,
  };
}

function makeMistVoxelPuff(random: () => number, center: THREE.Vector3, radius: number, isDemo: boolean): MistCell[] {
  const cellCount = isDemo ? 64 : 36 + Math.floor(random() * 20);
  const noiseSeed = random() * 10_000;
  const cells: MistCell[] = [];

  for (let i = 0; i < cellCount; i += 1) {
    const sample = sampleMistVolume(random, noiseSeed);
    const point = sample.point;
    const localX = center.x + point.x * radius * 1.08;
    const localZ = center.z + point.z * radius * 0.48;
    const localY = center.y + point.y * radius * 0.32 + Math.max(0, 1 - Math.abs(point.x)) * radius * 0.08;
    const cellSize = radius * (0.05 + random() * 0.045);
    const cell = new THREE.Mesh(
      mistCellGeometry,
      new THREE.MeshBasicMaterial({
        color: dayMistColour,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
      })
    );
    cell.position.set(localX, localY, localZ);
    cell.scale.set(cellSize * (1.2 + random() * 0.9), cellSize * (0.62 + random() * 0.5), cellSize * (0.95 + random() * 0.85));
    cell.rotation.set(random() * 0.18 - 0.09, random() * Math.PI * 2, random() * 0.14 - 0.07);
    cells.push({
      mesh: cell,
      opacityWeight: 0.42 + sample.density * 0.45 + random() * 0.1,
      lightnessShift: random() * 0.12 - 0.04,
    });
  }

  return cells;
}

function sampleMistVolume(random: () => number, seed: number): { point: THREE.Vector3; density: number } {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const point = new THREE.Vector3(centerBiased(random), centerBiased(random), centerBiased(random));
    const density = mistDensityAt(point, seed);
    if (density > 0.36 + random() * 0.34) return { point, density };
  }
  const point = new THREE.Vector3(centerBiased(random) * 0.52, centerBiased(random) * 0.36, centerBiased(random) * 0.44);
  return { point, density: mistDensityAt(point, seed) };
}

function centerBiased(random: () => number): number {
  return ((random() + random() + random()) / 3) * 2 - 1;
}

function mistDensityAt(point: THREE.Vector3, seed: number): number {
  const ellipsoid = point.x * point.x + point.y * point.y * 1.55 + point.z * point.z * 1.25;
  if (ellipsoid > 1) return 0;
  const centerDensity = 1 - THREE.MathUtils.smoothstep(ellipsoid, 0.05, 1);
  const coarse = valueNoise3(point.x * 2.7, point.y * 3.8, point.z * 3.1, seed);
  const fine = valueNoise3(point.x * 6.3 + 3.1, point.y * 7.4 - 1.7, point.z * 5.9 + 2.4, seed + 19.37);
  return THREE.MathUtils.clamp(centerDensity * 0.74 + coarse * 0.22 + fine * 0.14, 0, 1);
}

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.017) * 43758.5453;
  return value - Math.floor(value);
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 83492791) ^ Math.imul(chunkZ, 2654435761) ^ 0xa511e9b3) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 16), 2246822507) ^ Math.imul(state ^ (state >>> 13), 3266489909)) >>> 0;
    return state / 0xffffffff;
  };
}

function valleyMistBias(chunkX: number, chunkZ: number): number {
  const lowlandWave = Math.sin(chunkX * 0.62 - chunkZ * 0.37) * 0.5 + Math.cos(chunkZ * 0.48 + chunkX * 0.21) * 0.5;
  const waterPocket = createChunkRandom(chunkX - 41, chunkZ + 73)();
  return THREE.MathUtils.clamp(0.42 + lowlandWave * 0.22 + waterPocket * 0.36, 0, 1);
}

function getDayAmount(elapsed: number, isDemo: boolean): number {
  const cycleLength = isDemo ? 18 : 96;
  const phase = (elapsed / cycleLength + 0.18) % 1;
  const daylightWave = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
  return THREE.MathUtils.smoothstep(daylightWave, 0.2, 0.82);
}

function disposeMist(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (!mesh.geometry) return;
    if (mesh.geometry !== mistCellGeometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else {
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
  });
}
