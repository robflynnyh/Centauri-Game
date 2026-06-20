import * as THREE from "three";
import { normalizePlanetCoords, placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

type MistPuff = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
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

export function createMistSystem(scene: THREE.Scene, camera: THREE.Camera, heightAt: HeightSampler, isDemo: boolean): MistSystem {
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
        patch.group.lookAt(camera.position);

        patch.puffs.forEach(({ mesh, opacityWeight }) => {
          mesh.material.color.copy(activeColour);
          mesh.material.opacity = distanceFade * patchPulse * opacityWeight * THREE.MathUtils.lerp(0.66, 0.82, dayAmount);
        });
      });
    },
  };
}

function makeMistPatch(baseX: number, baseZ: number, random: () => number, valleyBias: number, isDemo: boolean): MistPatch {
  const group = new THREE.Group();
  const puffs: MistPuff[] = [];
  const radius = THREE.MathUtils.lerp(5.4, 10.2, random());
  const puffCount = isDemo ? 3 : 2 + Math.floor(random() * 2);

  for (let i = 0; i < puffCount; i += 1) {
    const angle = (i / puffCount) * Math.PI * 2 + random() * 0.42;
    const distance = Math.pow(random(), 0.72) * radius * 0.54;
    const texture = makeMistTexture(random);
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: dayMistColour,
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(Math.cos(angle) * distance, 0.45 + random() * 0.75, Math.sin(angle) * distance * 0.38);
    mesh.scale.set(radius * (1.15 + random() * 0.72), radius * (0.28 + random() * 0.16), 1);
    mesh.rotation.z = random() * 0.38 - 0.19;
    group.add(mesh);
    puffs.push({ mesh, opacityWeight: isDemo ? 0.48 + random() * 0.16 : 0.3 + random() * 0.14 });
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

function makeMistTexture(random: () => number): THREE.CanvasTexture {
  const width = 48;
  const height = 18;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Missing mist texture canvas context");

  const image = context.createImageData(width, height);
  const blobs = Array.from({ length: 8 }, () => ({
    x: width * (0.14 + random() * 0.72),
    y: height * (0.32 + random() * 0.34),
    radiusX: width * (0.12 + random() * 0.18),
    radiusY: height * (0.2 + random() * 0.22),
    strength: 0.46 + random() * 0.42,
  }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const edgeFadeX = THREE.MathUtils.smoothstep(x, 0, 6) * (1 - THREE.MathUtils.smoothstep(x, width - 7, width - 1));
      const edgeFadeY = THREE.MathUtils.smoothstep(y, 0, 3) * (1 - THREE.MathUtils.smoothstep(y, height - 4, height - 1));
      const noise = Math.sin(x * 1.71 + y * 2.37 + random() * 0.08) * 0.045;
      let density = 0;

      blobs.forEach((blob) => {
        const dx = (x - blob.x) / blob.radiusX;
        const dy = (y - blob.y) / blob.radiusY;
        const falloff = Math.max(0, 1 - dx * dx - dy * dy);
        density += falloff * falloff * blob.strength;
      });

      const alpha = THREE.MathUtils.clamp((density + noise - 0.08) * edgeFadeX * edgeFadeY, 0, 1);
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function disposeMist(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (!mesh.geometry) return;
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else {
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
  });
}
