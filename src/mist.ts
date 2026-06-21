import * as THREE from "three";
import { detailCoordinatesAt, normalizePlanetCoords, pointOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

export type MistSystem = {
  group: THREE.Group;
  update: (elapsed: number, focus: LocalPlanetPoint) => void;
  getDebugState: () => MistDebugState;
};

export type MistDebugState = {
  patches: number;
  visiblePatches: number;
  farVisiblePatches: number;
  farMaxAlpha: number;
  farDistance: number;
  hardCullDistance: number;
};

type MistRibbon = {
  segments: number;
  length: number;
  halfWidth: number;
  offset: number;
  angleOffset: number;
  altitude: number;
  alpha: number;
  phase: number;
  wobble: number;
  widthNoise: number[];
  sideNoise: number[];
  alphaNoise: number[];
};

type MistPatch = {
  baseX: number;
  baseZ: number;
  radius: number;
  lift: number;
  rotation: number;
  driftAngle: number;
  driftRange: number;
  driftSpeed: number;
  phase: number;
  baseAlpha: number;
  ribbons: MistRibbon[];
  mesh: THREE.Mesh<THREE.BufferGeometry, MistMaterial>;
  positionAttribute: THREE.BufferAttribute;
  alphaAttribute: THREE.BufferAttribute;
  toneAttribute: THREE.BufferAttribute;
  distanceToFocus: number;
  focusFade: number;
  maxAlpha: number;
  initialized: boolean;
};

type MistMaterial = THREE.ShaderMaterial & {
  uniforms: {
    dayAmount: { value: number };
    globalOpacity: { value: number };
    dayColour: { value: THREE.Color };
    nightColour: { value: THREE.Color };
  };
};

const mistChunkSize = 92;
const mistChunkRadius = 1;
const normalPatchLimit = 28;
const demoPatchLimit = 36;
const normalCandidatesPerChunk = 3;
const demoCandidatesPerChunk = 3;
const normalMistFadeStart = 32;
const normalMistFadeEnd = 82;
const demoMistFadeStart = 40;
const demoMistFadeEnd = 102;
const normalMistHardCullDistance = 92;
const demoMistHardCullDistance = 112;
const normalMistVisibilityCutoff = 0.075;
const demoMistVisibilityCutoff = 0.065;
const normalMistGenerationDistance = 112;
const demoMistGenerationDistance = 132;
const normalMistDebugFarDistance = 96;
const demoMistDebugFarDistance = 116;

export function createMistSystem(scene: THREE.Scene, heightAt: HeightSampler, isDemo: boolean): MistSystem {
  const group = new THREE.Group();
  group.name = "spooky-drifting-ground-mist";
  scene.add(group);

  const material = makeMistMaterial();
  const patches: MistPatch[] = [];
  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;

  const update = (elapsed: number, focus: LocalPlanetPoint): void => {
    const normalizedFocus = normalizePlanetCoords(focus.x, focus.z);
    const nextChunkX = Math.floor(normalizedFocus.x / mistChunkSize);
    const nextChunkZ = Math.floor(normalizedFocus.z / mistChunkSize);

    if (nextChunkX !== centerChunkX || nextChunkZ !== centerChunkZ) {
      centerChunkX = nextChunkX;
      centerChunkZ = nextChunkZ;
      rebuildMistPatches(group, patches, material, heightAt, normalizedFocus, centerChunkX, centerChunkZ, isDemo);
    }

    material.uniforms.dayAmount.value = getDayAmount(elapsed, isDemo);
    material.uniforms.globalOpacity.value = isDemo ? 1.04 : 0.88;
    patches.forEach((patch) => updatePatchGeometry(patch, heightAt, elapsed, normalizedFocus, isDemo));
  };

  return { group, update, getDebugState: () => getMistDebugState(patches, isDemo) };
}

function rebuildMistPatches(
  group: THREE.Group,
  patches: MistPatch[],
  material: MistMaterial,
  heightAt: HeightSampler,
  focus: LocalPlanetPoint,
  centerChunkX: number,
  centerChunkZ: number,
  isDemo: boolean
): void {
  patches.forEach((patch) => patch.mesh.geometry.dispose());
  patches.length = 0;
  group.clear();

  const chunkOffsets: Array<{ x: number; z: number; distance: number }> = [];
  for (let z = -mistChunkRadius; z <= mistChunkRadius; z += 1) {
    for (let x = -mistChunkRadius; x <= mistChunkRadius; x += 1) {
      chunkOffsets.push({ x, z, distance: Math.hypot(x, z) });
    }
  }
  chunkOffsets.sort((a, b) => a.distance - b.distance);

  const patchLimit = isDemo ? demoPatchLimit : normalPatchLimit;
  const candidatesPerChunk = isDemo ? demoCandidatesPerChunk : normalCandidatesPerChunk;
  addFocusMistPatches(group, patches, material, heightAt, focus, centerChunkX, centerChunkZ, isDemo);

  for (const offset of chunkOffsets) {
    const chunkX = centerChunkX + offset.x;
    const chunkZ = centerChunkZ + offset.z;
    const random = createChunkRandom(chunkX, chunkZ);

    for (let candidate = 0; candidate < candidatesPerChunk && patches.length < patchLimit; candidate += 1) {
      const x = (chunkX + random()) * mistChunkSize;
      const z = (chunkZ + random()) * mistChunkSize;
      const candidateCenter = normalizePlanetCoords(x, z);
      const candidateDistance = surfaceDistanceBetweenLocal(focus, candidateCenter);
      if (candidateDistance > (isDemo ? demoMistGenerationDistance : normalMistGenerationDistance)) continue;

      const suitability = mistSuitabilityAt(x, z, heightAt);
      const demoAllowance = isDemo ? 0.2 : 0;
      const chunkFalloff = 1 - THREE.MathUtils.smoothstep(offset.distance, 0.5, mistChunkRadius + 0.15);
      const chance = suitability * (isDemo ? 1.2 : 0.96) + chunkFalloff * (isDemo ? 0.18 : 0.08);

      if (suitability + demoAllowance < 0.26 || random() > chance) continue;

      const patch = createMistPatch(x, z, suitability, random, material, isDemo);
      patches.push(patch);
      group.add(patch.mesh);
    }
  }
}

function addFocusMistPatches(
  group: THREE.Group,
  patches: MistPatch[],
  material: MistMaterial,
  heightAt: HeightSampler,
  focus: LocalPlanetPoint,
  centerChunkX: number,
  centerChunkZ: number,
  isDemo: boolean
): void {
  const random = createChunkRandom(centerChunkX + 911, centerChunkZ - 349);
  const count = isDemo ? 4 : 2;

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2 + i * 1.72;
    const distance = (isDemo ? 14 : 10) + random() * (isDemo ? 34 : 24);
    const x = focus.x + Math.cos(angle) * distance;
    const z = focus.z + Math.sin(angle) * distance;
    const suitability = Math.max(mistSuitabilityAt(x, z, heightAt), isDemo ? 0.74 : 0.58);
    const patch = createMistPatch(x, z, suitability, random, material, isDemo);
    patch.baseAlpha *= isDemo ? 1.25 : 1.12;
    patches.push(patch);
    group.add(patch.mesh);
  }
}

function createMistPatch(
  x: number,
  z: number,
  suitability: number,
  random: () => number,
  material: MistMaterial,
  isDemo: boolean
): MistPatch {
  const ribbonCount = isDemo ? 4 + Math.floor(random() * 2) : 3 + Math.floor(random() * 2);
  const radius = THREE.MathUtils.lerp(8.5, 17.5, suitability) * (0.86 + random() * 0.34);
  const ribbons: MistRibbon[] = [];

  for (let i = 0; i < ribbonCount; i += 1) {
    const segments = 8 + Math.floor(random() * 4);
    const widthNoise = randomSeries(random, segments + 1, 0.72, 1.24);
    const sideNoise = randomSeries(random, segments + 1, -1, 1);
    const alphaNoise = randomSeries(random, segments + 1, 0.68, 1);
    ribbons.push({
      segments,
      length: radius * (1.18 + random() * 0.92),
      halfWidth: radius * (0.035 + random() * 0.045),
      offset: (random() - 0.5) * radius * 0.88,
      angleOffset: (random() - 0.5) * 0.48,
      altitude: 0.08 + random() * 0.56,
      alpha: 0.52 + random() * 0.34,
      phase: random() * Math.PI * 2,
      wobble: radius * (0.04 + random() * 0.06),
      widthNoise,
      sideNoise,
      alphaNoise,
    });
  }

  const geometry = makeMistGeometry(ribbons);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "terrain-anchored-mist-wisp";
  mesh.frustumCulled = true;

  const patch = {
    baseX: x,
    baseZ: z,
    radius,
    lift: 0.28 + random() * 0.26,
    rotation: random() * Math.PI * 2,
    driftAngle: random() * Math.PI * 2,
    driftRange: radius * (0.24 + random() * 0.18),
    driftSpeed: 0.034 + random() * 0.035,
    phase: random() * Math.PI * 2,
    baseAlpha: THREE.MathUtils.lerp(0.06, isDemo ? 0.17 : 0.125, suitability),
    ribbons,
    mesh,
    positionAttribute: geometry.getAttribute("position") as THREE.BufferAttribute,
    alphaAttribute: geometry.getAttribute("mistAlpha") as THREE.BufferAttribute,
    toneAttribute: geometry.getAttribute("mistTone") as THREE.BufferAttribute,
    distanceToFocus: Number.POSITIVE_INFINITY,
    focusFade: 0,
    maxAlpha: 0,
    initialized: false,
  };

  return patch;
}

function makeMistGeometry(ribbons: MistRibbon[]): THREE.BufferGeometry {
  const vertexCount = ribbons.reduce((total, ribbon) => total + (ribbon.segments + 1) * 2, 0);
  const positions = new Float32Array(vertexCount * 3);
  const alphas = new Float32Array(vertexCount);
  const tones = new Float32Array(vertexCount);
  const indices: number[] = [];
  let vertexOffset = 0;

  ribbons.forEach((ribbon) => {
    for (let i = 0; i < ribbon.segments; i += 1) {
      const a = vertexOffset + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    for (let i = 0; i <= ribbon.segments; i += 1) {
      const left = vertexOffset + i * 2;
      const right = left + 1;
      tones[left] = 0.72 + ribbon.alphaNoise[i] * 0.24;
      tones[right] = 0.72 + ribbon.widthNoise[i] * 0.2;
    }

    vertexOffset += (ribbon.segments + 1) * 2;
  });

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);
  const toneAttribute = new THREE.BufferAttribute(tones, 1);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("mistAlpha", alphaAttribute);
  geometry.setAttribute("mistTone", toneAttribute);
  geometry.setIndex(indices);
  return geometry;
}

function updatePatchGeometry(
  patch: MistPatch,
  heightAt: HeightSampler,
  elapsed: number,
  focus: LocalPlanetPoint,
  isDemo: boolean
): void {
  const drift = Math.sin(elapsed * patch.driftSpeed + patch.phase) * patch.driftRange;
  const crossDrift = Math.sin(elapsed * patch.driftSpeed * 0.63 + patch.phase * 0.7) * patch.driftRange * 0.28;
  const driftX = Math.cos(patch.driftAngle);
  const driftZ = Math.sin(patch.driftAngle);
  const sideX = -driftZ;
  const sideZ = driftX;
  const center = normalizePlanetCoords(patch.baseX + driftX * drift + sideX * crossDrift, patch.baseZ + driftZ * drift + sideZ * crossDrift);
  const centerAltitude = heightAt(center.x, center.z) + patch.lift;
  const centerWorld = pointOnPlanet(center.x, center.z, centerAltitude);
  const distanceToFocus = surfaceDistanceBetweenLocal(focus, center);
  const fadeStart = isDemo ? demoMistFadeStart : normalMistFadeStart;
  const fadeEnd = isDemo ? demoMistFadeEnd : normalMistFadeEnd;
  const rawFocusFade = 1 - THREE.MathUtils.smoothstep(distanceToFocus, fadeStart, fadeEnd);
  const distanceFade = Math.pow(rawFocusFade, isDemo ? 3.4 : 3.8);
  const terrainFade = mistTerrainDistanceFade(center.x, center.z, distanceToFocus, heightAt, isDemo);
  const hardCullDistance = isDemo ? demoMistHardCullDistance : normalMistHardCullDistance;
  const focusFade = distanceToFocus >= hardCullDistance ? 0 : distanceFade * terrainFade;

  patch.distanceToFocus = distanceToFocus;
  patch.focusFade = focusFade;
  patch.maxAlpha = 0;

  patch.mesh.visible = focusFade > (isDemo ? demoMistVisibilityCutoff : normalMistVisibilityCutoff);
  if (!patch.mesh.visible) {
    clearPatchAlpha(patch);
    return;
  }

  patch.mesh.position.copy(centerWorld);

  const positions = patch.positionAttribute.array as Float32Array;
  const alphas = patch.alphaAttribute.array as Float32Array;
  const breath = 0.86 + Math.sin(elapsed * 0.19 + patch.phase) * 0.14;
  let vertexIndex = 0;

  patch.ribbons.forEach((ribbon, ribbonIndex) => {
    const angle = patch.rotation + ribbon.angleOffset + Math.sin(elapsed * 0.035 + ribbon.phase) * 0.055;
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const ribbonSideX = -directionZ;
    const ribbonSideZ = directionX;
    const ribbonDrift = Math.sin(elapsed * 0.075 + ribbon.phase) * ribbon.wobble;
    const verticalWave = Math.sin(elapsed * 0.11 + ribbon.phase + ribbonIndex) * 0.055;

    for (let i = 0; i <= ribbon.segments; i += 1) {
      const u = i / ribbon.segments;
      const along = (u - 0.5) * ribbon.length;
      const edgeFade = Math.pow(Math.sin(u * Math.PI), 0.82);
      const width = ribbon.halfWidth * ribbon.widthNoise[i] * (0.35 + edgeFade * 0.85);
      const raggedSide = ribbon.sideNoise[i] * ribbon.halfWidth * 0.58;
      const centerSide = ribbon.offset + raggedSide + ribbonDrift * Math.sin(u * Math.PI * 2 + ribbon.phase);
      const alpha = patch.baseAlpha * ribbon.alpha * edgeFade * ribbon.alphaNoise[i] * breath * focusFade;
      patch.maxAlpha = Math.max(patch.maxAlpha, alpha);

      for (const sideSign of [-1, 1]) {
        const sideOffset = centerSide + sideSign * width;
        const sampleX = center.x + directionX * along + ribbonSideX * sideOffset;
        const sampleZ = center.z + directionZ * along + ribbonSideZ * sideOffset;
        const sampleAltitude =
          heightAt(sampleX, sampleZ) + patch.lift + ribbon.altitude + verticalWave + Math.sin(u * Math.PI * 2 + ribbon.phase) * 0.035;
        const sampleWorld = pointOnPlanet(sampleX, sampleZ, sampleAltitude);
        const positionCursor = vertexIndex * 3;
        positions[positionCursor] = sampleWorld.x - centerWorld.x;
        positions[positionCursor + 1] = sampleWorld.y - centerWorld.y;
        positions[positionCursor + 2] = sampleWorld.z - centerWorld.z;
        alphas[vertexIndex] = alpha;
        vertexIndex += 1;
      }
    }
  });

  patch.positionAttribute.needsUpdate = true;
  patch.alphaAttribute.needsUpdate = true;
  if (!patch.initialized) {
    patch.toneAttribute.needsUpdate = true;
    patch.mesh.geometry.computeBoundingSphere();
    patch.initialized = true;
  }
}

function mistSuitabilityAt(x: number, z: number, heightAt: HeightSampler): number {
  const centerHeight = heightAt(x, z);
  const sampleDistance = 8;
  const samples = [
    heightAt(x + sampleDistance, z),
    heightAt(x - sampleDistance, z),
    heightAt(x, z + sampleDistance),
    heightAt(x, z - sampleDistance),
    heightAt(x + sampleDistance * 1.4, z - sampleDistance * 1.4),
    heightAt(x - sampleDistance * 1.4, z + sampleDistance * 1.4),
  ];
  const average = samples.reduce((total, height) => total + height, 0) / samples.length;
  const roughness = samples.reduce((highest, height) => Math.max(highest, Math.abs(height - centerHeight)), 0);
  const lowland = 1 - THREE.MathUtils.smoothstep(centerHeight, 3.6, 11.5);
  const basin = THREE.MathUtils.smoothstep(average - centerHeight, 0, 3.8);
  const quietGround = 1 - THREE.MathUtils.smoothstep(roughness, 1.0, 4.7);

  const detail = detailCoordinatesAt(x, z);
  const waterLike =
    (Math.sin(detail.x * 0.135 + Math.cos(detail.z * 0.04) * 1.7) +
      Math.cos(detail.z * 0.115 - Math.sin(detail.x * 0.035) * 2.2) +
      Math.sin((detail.x - detail.z) * 0.055) +
      3) /
    6;
  const waterVein = THREE.MathUtils.smoothstep(waterLike, 0.42, 0.78);

  return THREE.MathUtils.clamp(lowland * 0.42 + basin * 0.25 + quietGround * 0.12 + waterVein * 0.26, 0, 1);
}

function mistTerrainDistanceFade(x: number, z: number, distanceToFocus: number, heightAt: HeightSampler, isDemo: boolean): number {
  const centerHeight = heightAt(x, z);
  const sampleDistance = 7;
  const samples = [
    heightAt(x + sampleDistance, z),
    heightAt(x - sampleDistance, z),
    heightAt(x, z + sampleDistance),
    heightAt(x, z - sampleDistance),
  ];
  const roughness = samples.reduce((highest, height) => Math.max(highest, Math.abs(height - centerHeight)), 0);
  const distancePressure = THREE.MathUtils.smoothstep(distanceToFocus, isDemo ? 28 : 24, isDemo ? 82 : 66);
  const quietSlopeFade = 1 - THREE.MathUtils.smoothstep(roughness, 1.05, isDemo ? 3.4 : 2.8);
  const lowlandFade = 1 - THREE.MathUtils.smoothstep(centerHeight, isDemo ? 6.6 : 5.1, isDemo ? 12.2 : 9.6);
  const distantTerrainFade = THREE.MathUtils.clamp(quietSlopeFade * 0.72 + lowlandFade * 0.28, 0, 1);

  return THREE.MathUtils.lerp(1, distantTerrainFade, distancePressure);
}

function clearPatchAlpha(patch: MistPatch): void {
  const alphas = patch.alphaAttribute.array as Float32Array;
  alphas.fill(0);
  patch.alphaAttribute.needsUpdate = true;
}

function getMistDebugState(patches: MistPatch[], isDemo: boolean): MistDebugState {
  const farDistance = isDemo ? demoMistDebugFarDistance : normalMistDebugFarDistance;
  let visiblePatches = 0;
  let farVisiblePatches = 0;
  let farMaxAlpha = 0;

  patches.forEach((patch) => {
    if (!patch.mesh.visible) return;
    visiblePatches += 1;
    if (patch.distanceToFocus < farDistance) return;

    farVisiblePatches += 1;
    farMaxAlpha = Math.max(farMaxAlpha, patch.maxAlpha);
  });

  return {
    patches: patches.length,
    visiblePatches,
    farVisiblePatches,
    farMaxAlpha,
    farDistance,
    hardCullDistance: isDemo ? demoMistHardCullDistance : normalMistHardCullDistance,
  };
}

function makeMistMaterial(): MistMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      dayAmount: { value: 1 },
      globalOpacity: { value: 1 },
      dayColour: { value: new THREE.Color(0xe7f4ff) },
      nightColour: { value: new THREE.Color(0xb49df1) },
    },
    vertexShader: `
      attribute float mistAlpha;
      attribute float mistTone;
      varying float vMistAlpha;
      varying float vMistTone;

      void main() {
        vMistAlpha = mistAlpha;
        vMistTone = mistTone;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float dayAmount;
      uniform float globalOpacity;
      uniform vec3 dayColour;
      uniform vec3 nightColour;
      varying float vMistAlpha;
      varying float vMistTone;

      void main() {
        vec3 colour = mix(nightColour, dayColour, dayAmount);
        float phaseOpacity = mix(1.28, 0.95, dayAmount);
        gl_FragColor = vec4(colour * vMistTone, vMistAlpha * globalOpacity * phaseOpacity);
      }
    `,
  }) as MistMaterial;
}

function getDayAmount(elapsed: number, isDemo: boolean): number {
  const cycleLength = isDemo ? 18 : 96;
  const phase = (elapsed / cycleLength + 0.18) % 1;
  const daylightWave = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
  return THREE.MathUtils.smoothstep(daylightWave, 0.2, 0.82);
}

function randomSeries(random: () => number, count: number, min: number, max: number): number[] {
  return Array.from({ length: count }, () => THREE.MathUtils.lerp(min, max, random()));
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 73856093) ^ Math.imul(chunkZ, 19349663) ^ 0x83f2a65d) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}
