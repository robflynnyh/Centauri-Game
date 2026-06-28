import * as THREE from "three";
import { normalizePlanetCoords, pointOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;

export type WeatherPocketType = "pink-rain" | "reverse-ash" | "glow-motes";

export type WeatherPaletteState = {
  primary: string;
  secondary: string;
  fog: string;
  background: string;
};

export type WeatherDebugSpawn = {
  x: number;
  z: number;
  lookAtX: number;
  lookAtZ: number;
  yaw: number;
  pitch: number;
  pocket: {
    key: string;
    x: number;
    z: number;
    radius: number;
    type: WeatherPocketType;
  };
  edgeSample: LocalPlanetPoint;
  outsideSample: LocalPlanetPoint;
};

export type WeatherDebugState = {
  pocketCount: number;
  activePocketKey: string | null;
  currentPocketType: WeatherPocketType | null;
  distanceToCenter: number;
  radius: number;
  fadeStart: number;
  fadeEnd: number;
  intensity: number;
  visibleParticleCount: number;
  particleLimit: number;
  debugPocketDistance: number;
  debugPocketIntensity: number;
  activePalette: WeatherPaletteState | null;
  nearestPocket: {
    key: string;
    x: number;
    z: number;
    radius: number;
    type: WeatherPocketType;
    distanceToCenter: number;
  } | null;
  debugSpawn: WeatherDebugSpawn;
  pocketTypes: WeatherPocketType[];
};

export type WeatherSkyInfluence = {
  amount: number;
  fogHex: number;
  backgroundHex: number;
  fogDensityBoost: number;
  prismAmount: number;
};

export type WeatherSystem = {
  group: THREE.Group;
  update: (elapsed: number, focus: LocalPlanetPoint, context?: WeatherUpdateContext) => void;
  getDebugState: () => WeatherDebugState;
  getSkyInfluence: () => WeatherSkyInfluence;
};

type WeatherUpdateContext = {
  nearestBiomePatchDistance?: number;
};

type WeatherPalette = {
  primary: THREE.Color;
  secondary: THREE.Color;
  fog: THREE.Color;
  background: THREE.Color;
};

type WeatherPocket = {
  key: string;
  x: number;
  z: number;
  radius: number;
  type: WeatherPocketType;
  phase: number;
  baseIntensity: number;
  palette: WeatherPalette;
};

type WeatherParticle = {
  x: number;
  z: number;
  altitude: number;
  size: number;
  length: number;
  speed: number;
  phase: number;
  driftAngle: number;
  driftRange: number;
  tone: number;
};

type WeatherPatch = WeatherPocket & {
  particles: WeatherParticle[];
  mesh: THREE.Mesh<THREE.BufferGeometry, WeatherMaterial>;
  positionAttribute: THREE.BufferAttribute;
  alphaAttribute: THREE.BufferAttribute;
  toneAttribute: THREE.BufferAttribute;
  distanceToFocus: number;
  intensity: number;
  visibleParticleCount: number;
  initialized: boolean;
};

type WeatherMaterial = THREE.ShaderMaterial & {
  uniforms: {
    primaryColour: { value: THREE.Color };
    secondaryColour: { value: THREE.Color };
    globalOpacity: { value: number };
  };
};

const weatherChunkSize = 260;
const weatherChunkRadius = 2;
const maxRenderedWeatherPatches = 6;
const weatherGenerationDistance = 620;
const weatherFadeMargin = 32;
const weatherVisibilityCutoff = 0.018;
const weatherParticleLimit = 72;
const weatherTypes: WeatherPocketType[] = ["pink-rain", "reverse-ash", "glow-motes"];

const paletteByType: Record<WeatherPocketType, WeatherPalette> = {
  "pink-rain": {
    primary: new THREE.Color(0xff8edc),
    secondary: new THREE.Color(0xfff0a8),
    fog: new THREE.Color(0xff9fd7),
    background: new THREE.Color(0x8d6dff),
  },
  "reverse-ash": {
    primary: new THREE.Color(0xbaf6ff),
    secondary: new THREE.Color(0xfff7d6),
    fog: new THREE.Color(0xc8f4ff),
    background: new THREE.Color(0x6c7bd6),
  },
  "glow-motes": {
    primary: new THREE.Color(0xe7ff66),
    secondary: new THREE.Color(0x72ffe4),
    fog: new THREE.Color(0xb8ffdd),
    background: new THREE.Color(0x5e8fba),
  },
};

const debugWeatherPocket = findDebugWeatherPocket();
const debugWeatherSpawn = makeDebugSpawn(debugWeatherPocket);

export function createWeatherSystem(scene: THREE.Scene, heightAt: HeightSampler, isDemo: boolean): WeatherSystem {
  const group = new THREE.Group();
  group.name = "local-alien-weather-pockets";
  scene.add(group);

  const patches = new Map<string, WeatherPatch>();
  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;
  let relevantKeys = new Set<string>();
  let debugState = makeEmptyDebugState();
  let skyInfluence: WeatherSkyInfluence = {
    amount: 0,
    fogHex: paletteByType["pink-rain"].fog.getHex(),
    backgroundHex: paletteByType["pink-rain"].background.getHex(),
    fogDensityBoost: 0,
    prismAmount: 0,
  };

  const update = (elapsed: number, focus: LocalPlanetPoint, context: WeatherUpdateContext = {}): void => {
    const normalizedFocus = normalizePlanetCoords(focus.x, focus.z);
    const nextChunkX = Math.floor(normalizedFocus.x / weatherChunkSize);
    const nextChunkZ = Math.floor(normalizedFocus.z / weatherChunkSize);

    if (nextChunkX !== centerChunkX || nextChunkZ !== centerChunkZ) {
      centerChunkX = nextChunkX;
      centerChunkZ = nextChunkZ;
      relevantKeys = syncWeatherPatches(group, patches, heightAt, normalizedFocus, centerChunkX, centerChunkZ, isDemo);
    }

    const biomeClearance = context.nearestBiomePatchDistance ?? Number.POSITIVE_INFINITY;
    const biomeFade = THREE.MathUtils.lerp(0.58, 1, THREE.MathUtils.smoothstep(biomeClearance, 14, 58));
    patches.forEach((patch) => updateWeatherPatch(patch, heightAt, elapsed, normalizedFocus, biomeFade, isDemo));
    pruneInactiveWeatherPatches(group, patches, relevantKeys);
    debugState = getWeatherDebugState(patches);
    skyInfluence = getWeatherSkyInfluence(debugState);
  };

  return {
    group,
    update,
    getDebugState: () => ({ ...debugState }),
    getSkyInfluence: () => ({ ...skyInfluence }),
  };
}

export function getWeatherDebugSpawn(): WeatherDebugSpawn {
  return {
    ...debugWeatherSpawn,
    pocket: { ...debugWeatherSpawn.pocket },
    edgeSample: { ...debugWeatherSpawn.edgeSample },
    outsideSample: { ...debugWeatherSpawn.outsideSample },
  };
}

function syncWeatherPatches(
  group: THREE.Group,
  patches: Map<string, WeatherPatch>,
  heightAt: HeightSampler,
  focus: LocalPlanetPoint,
  centerChunkX: number,
  centerChunkZ: number,
  isDemo: boolean
): Set<string> {
  const candidates: Array<{ pocket: WeatherPocket; distance: number }> = [];
  for (let z = -weatherChunkRadius; z <= weatherChunkRadius; z += 1) {
    for (let x = -weatherChunkRadius; x <= weatherChunkRadius; x += 1) {
      const chunkX = centerChunkX + x;
      const chunkZ = centerChunkZ + z;
      const pocket = createWeatherPocketCandidate(chunkX, chunkZ);
      if (!pocket) continue;

      const normalizedPocket = normalizePlanetCoords(pocket.x, pocket.z);
      const distance = surfaceDistanceBetweenLocal(focus, normalizedPocket);
      if (distance > weatherGenerationDistance) continue;
      candidates.push({ pocket: { ...pocket, x: normalizedPocket.x, z: normalizedPocket.z }, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const relevantKeys = new Set<string>();
  for (const { pocket } of candidates.slice(0, maxRenderedWeatherPatches)) {
    relevantKeys.add(pocket.key);
    if (patches.has(pocket.key)) continue;

    const patch = createWeatherPatch(pocket, heightAt, isDemo);
    patches.set(pocket.key, patch);
    group.add(patch.mesh);
  }

  return relevantKeys;
}

function pruneInactiveWeatherPatches(group: THREE.Group, patches: Map<string, WeatherPatch>, relevantKeys: Set<string>): void {
  patches.forEach((patch, key) => {
    if (relevantKeys.has(key) || patch.mesh.visible) return;

    group.remove(patch.mesh);
    patch.mesh.geometry.dispose();
    patch.mesh.material.dispose();
    patches.delete(key);
  });
}

function createWeatherPatch(pocket: WeatherPocket, heightAt: HeightSampler, isDemo: boolean): WeatherPatch {
  const random = createChunkRandom(Math.floor(pocket.x * 11), Math.floor(pocket.z * 13));
  const particleCount = particleCountForType(pocket.type, isDemo);
  const particles: WeatherParticle[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.pow(random(), 0.58) * pocket.radius * 0.92;
    particles.push({
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      altitude: THREE.MathUtils.lerp(1.4, 12.5, random()),
      size: THREE.MathUtils.lerp(0.18, pocket.type === "pink-rain" ? 0.34 : 0.62, random()),
      length: THREE.MathUtils.lerp(pocket.type === "pink-rain" ? 2.8 : 0.34, pocket.type === "pink-rain" ? 5.2 : 0.92, random()),
      speed: THREE.MathUtils.lerp(pocket.type === "pink-rain" ? 0.2 : 0.045, pocket.type === "pink-rain" ? 0.42 : 0.13, random()),
      phase: random() * Math.PI * 2,
      driftAngle: random() * Math.PI * 2,
      driftRange: pocket.radius * THREE.MathUtils.lerp(0.035, 0.11, random()),
      tone: random(),
    });
  }

  const geometry = makeWeatherGeometry(particles.length);
  const material = makeWeatherMaterial(pocket);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `weather-pocket-${pocket.type}`;
  mesh.frustumCulled = true;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), pocket.radius + 24);
  mesh.position.copy(pointOnPlanet(pocket.x, pocket.z, heightAt(pocket.x, pocket.z) + 5));

  return {
    ...pocket,
    particles,
    mesh,
    positionAttribute: geometry.getAttribute("position") as THREE.BufferAttribute,
    alphaAttribute: geometry.getAttribute("weatherAlpha") as THREE.BufferAttribute,
    toneAttribute: geometry.getAttribute("weatherTone") as THREE.BufferAttribute,
    distanceToFocus: Number.POSITIVE_INFINITY,
    intensity: 0,
    visibleParticleCount: 0,
    initialized: false,
  };
}

function updateWeatherPatch(
  patch: WeatherPatch,
  heightAt: HeightSampler,
  elapsed: number,
  focus: LocalPlanetPoint,
  biomeFade: number,
  isDemo: boolean
): void {
  const center = normalizePlanetCoords(patch.x, patch.z);
  const centerAltitude = heightAt(center.x, center.z) + 5;
  const centerWorld = pointOnPlanet(center.x, center.z, centerAltitude);
  const distanceToFocus = surfaceDistanceBetweenLocal(focus, center);
  const rawFade = 1 - THREE.MathUtils.smoothstep(distanceToFocus, fadeStartForPocket(patch), fadeEndForPocket(patch));
  const focusFade = Math.pow(THREE.MathUtils.clamp(rawFade, 0, 1), 1.32);
  const breath = 0.88 + Math.sin(elapsed * 0.27 + patch.phase) * 0.12;
  const intensity = focusFade * patch.baseIntensity * breath * biomeFade * (isDemo ? 1.18 : 1);

  patch.distanceToFocus = distanceToFocus;
  patch.intensity = intensity;
  patch.visibleParticleCount = 0;
  patch.mesh.visible = intensity > weatherVisibilityCutoff;

  if (!patch.mesh.visible) {
    clearWeatherPatchAlpha(patch);
    return;
  }

  patch.mesh.position.copy(centerWorld);
  patch.mesh.material.uniforms.globalOpacity.value = isDemo ? 1.08 : 0.94;
  const positions = patch.positionAttribute.array as Float32Array;
  const alphas = patch.alphaAttribute.array as Float32Array;
  const tones = patch.toneAttribute.array as Float32Array;
  let vertexIndex = 0;

  patch.particles.forEach((particle, particleIndex) => {
    const drift = Math.sin(elapsed * particle.speed + particle.phase) * particle.driftRange;
    const sideDrift = Math.cos(elapsed * particle.speed * 0.73 + particle.phase) * particle.driftRange * 0.56;
    const driftX = Math.cos(particle.driftAngle) * drift - Math.sin(particle.driftAngle) * sideDrift;
    const driftZ = Math.sin(particle.driftAngle) * drift + Math.cos(particle.driftAngle) * sideDrift;
    const localX = particle.x + driftX;
    const localZ = particle.z + driftZ;
    const edgeDistance = Math.hypot(localX, localZ);
    const edgeFade = 1 - THREE.MathUtils.smoothstep(edgeDistance, patch.radius * 0.64, patch.radius * 1.02);
    const pulse = 0.74 + Math.sin(elapsed * 0.9 + particle.phase + particleIndex * 0.17) * 0.26;
    const alpha = THREE.MathUtils.clamp(intensity * edgeFade * pulse, 0, 1);
    if (alpha > 0.025) patch.visibleParticleCount += 1;

    if (patch.type === "pink-rain") {
      vertexIndex = writeRainParticle(
        positions,
        alphas,
        tones,
        vertexIndex,
        centerWorld,
        center,
        patch,
        particle,
        localX,
        localZ,
        elapsed,
        alpha,
        heightAt
      );
    } else if (patch.type === "reverse-ash") {
      vertexIndex = writeAshParticle(
        positions,
        alphas,
        tones,
        vertexIndex,
        centerWorld,
        center,
        patch,
        particle,
        localX,
        localZ,
        elapsed,
        alpha,
        heightAt
      );
    } else {
      vertexIndex = writeMoteParticle(
        positions,
        alphas,
        tones,
        vertexIndex,
        centerWorld,
        center,
        patch,
        particle,
        localX,
        localZ,
        elapsed,
        alpha,
        heightAt
      );
    }
  });

  patch.positionAttribute.needsUpdate = true;
  patch.alphaAttribute.needsUpdate = true;
  if (!patch.initialized) {
    patch.toneAttribute.needsUpdate = true;
    patch.initialized = true;
  }
}

function writeRainParticle(
  positions: Float32Array,
  alphas: Float32Array,
  tones: Float32Array,
  vertexIndex: number,
  centerWorld: THREE.Vector3,
  center: LocalPlanetPoint,
  patch: WeatherPatch,
  particle: WeatherParticle,
  localX: number,
  localZ: number,
  elapsed: number,
  alpha: number,
  heightAt: HeightSampler
): number {
  const fall = positiveModulo(elapsed * particle.speed + particle.phase * 0.17, 1);
  const altitude = 2.2 + (1 - fall) * 13.5;
  const halfWidth = particle.size * 0.12;
  const sideAngle = particle.driftAngle + Math.PI * 0.5;
  const sideX = Math.cos(sideAngle) * halfWidth;
  const sideZ = Math.sin(sideAngle) * halfWidth;
  const sampleX = center.x + localX;
  const sampleZ = center.z + localZ;
  const topAltitude = heightWithPocketLift(heightAt, sampleX, sampleZ, altitude + particle.length * 0.42);
  const bottomAltitude = heightWithPocketLift(heightAt, sampleX, sampleZ, altitude - particle.length * 0.58);
  const points = [
    pointOnPlanet(sampleX - sideX, sampleZ - sideZ, topAltitude),
    pointOnPlanet(sampleX + sideX, sampleZ + sideZ, topAltitude),
    pointOnPlanet(sampleX + sideX, sampleZ + sideZ, bottomAltitude),
    pointOnPlanet(sampleX - sideX, sampleZ - sideZ, bottomAltitude),
  ];
  return writeWeatherQuad(positions, alphas, tones, vertexIndex, centerWorld, points, alpha * 0.58, particle.tone);
}

function writeAshParticle(
  positions: Float32Array,
  alphas: Float32Array,
  tones: Float32Array,
  vertexIndex: number,
  centerWorld: THREE.Vector3,
  center: LocalPlanetPoint,
  patch: WeatherPatch,
  particle: WeatherParticle,
  localX: number,
  localZ: number,
  elapsed: number,
  alpha: number,
  heightAt: HeightSampler
): number {
  const rise = positiveModulo(elapsed * particle.speed + particle.phase * 0.13, 1);
  const altitude = 1.4 + rise * 13.2;
  const verticalFade = Math.sin(rise * Math.PI);
  const spin = elapsed * 0.28 + particle.phase;
  const sampleX = center.x + localX + Math.sin(spin * 0.7) * 0.28;
  const sampleZ = center.z + localZ + Math.cos(spin * 0.6) * 0.28;
  return writeDiamondParticle(
    positions,
    alphas,
    tones,
    vertexIndex,
    centerWorld,
    sampleX,
    sampleZ,
    heightWithPocketLift(heightAt, sampleX, sampleZ, altitude),
    particle.size * (0.8 + verticalFade * 0.6),
    spin,
    alpha * verticalFade * 0.44,
    particle.tone
  );
}

function writeMoteParticle(
  positions: Float32Array,
  alphas: Float32Array,
  tones: Float32Array,
  vertexIndex: number,
  centerWorld: THREE.Vector3,
  center: LocalPlanetPoint,
  patch: WeatherPatch,
  particle: WeatherParticle,
  localX: number,
  localZ: number,
  elapsed: number,
  alpha: number,
  heightAt: HeightSampler
): number {
  const float = Math.sin(elapsed * particle.speed + particle.phase) * 1.8;
  const spin = elapsed * 0.42 + particle.phase;
  const sampleX = center.x + localX + Math.sin(spin * 0.48) * 0.54;
  const sampleZ = center.z + localZ + Math.cos(spin * 0.41) * 0.54;
  const altitude = heightWithPocketLift(heightAt, sampleX, sampleZ, particle.altitude + float);
  return writeDiamondParticle(
    positions,
    alphas,
    tones,
    vertexIndex,
    centerWorld,
    sampleX,
    sampleZ,
    altitude,
    particle.size * (1.0 + Math.sin(spin * 1.7) * 0.2),
    spin,
    alpha * 0.62,
    particle.tone
  );
}

function heightWithPocketLift(heightAt: HeightSampler, x: number, z: number, altitude: number): number {
  return heightAt(x, z) + altitude;
}

function writeDiamondParticle(
  positions: Float32Array,
  alphas: Float32Array,
  tones: Float32Array,
  vertexIndex: number,
  centerWorld: THREE.Vector3,
  x: number,
  z: number,
  altitude: number,
  size: number,
  spin: number,
  alpha: number,
  tone: number
): number {
  const centerPoint = pointOnPlanet(x, z, altitude);
  const east = pointOnPlanet(x + 0.25, z, altitude).sub(pointOnPlanet(x - 0.25, z, altitude)).normalize();
  const up = pointOnPlanet(x, z, altitude + 0.25).sub(pointOnPlanet(x, z, altitude - 0.25)).normalize();
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const corners = [
    { x: 0, y: size },
    { x: size * 0.68, y: 0 },
    { x: 0, y: -size },
    { x: -size * 0.68, y: 0 },
  ].map((corner) => {
    const rotatedX = corner.x * cos - corner.y * sin;
    const rotatedY = corner.x * sin + corner.y * cos;
    return centerPoint.clone().addScaledVector(east, rotatedX).addScaledVector(up, rotatedY);
  });

  return writeWeatherQuad(positions, alphas, tones, vertexIndex, centerWorld, corners, alpha, tone);
}

function writeWeatherQuad(
  positions: Float32Array,
  alphas: Float32Array,
  tones: Float32Array,
  vertexIndex: number,
  centerWorld: THREE.Vector3,
  points: THREE.Vector3[],
  alpha: number,
  tone: number
): number {
  for (const point of points) {
    const cursor = vertexIndex * 3;
    positions[cursor] = point.x - centerWorld.x;
    positions[cursor + 1] = point.y - centerWorld.y;
    positions[cursor + 2] = point.z - centerWorld.z;
    alphas[vertexIndex] = alpha;
    tones[vertexIndex] = tone;
    vertexIndex += 1;
  }
  return vertexIndex;
}

function clearWeatherPatchAlpha(patch: WeatherPatch): void {
  const alphas = patch.alphaAttribute.array as Float32Array;
  alphas.fill(0);
  patch.alphaAttribute.needsUpdate = true;
}

function makeWeatherGeometry(particleCount: number): THREE.BufferGeometry {
  const vertexCount = particleCount * 4;
  const positions = new Float32Array(vertexCount * 3);
  const alphas = new Float32Array(vertexCount);
  const tones = new Float32Array(vertexCount);
  const indices: number[] = [];

  for (let particle = 0; particle < particleCount; particle += 1) {
    const offset = particle * 4;
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);
  const toneAttribute = new THREE.BufferAttribute(tones, 1);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  toneAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("weatherAlpha", alphaAttribute);
  geometry.setAttribute("weatherTone", toneAttribute);
  geometry.setIndex(indices);
  return geometry;
}

function makeWeatherMaterial(pocket: WeatherPocket): WeatherMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: pocket.type === "glow-motes" ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      primaryColour: { value: pocket.palette.primary.clone() },
      secondaryColour: { value: pocket.palette.secondary.clone() },
      globalOpacity: { value: 1 },
    },
    vertexShader: `
      attribute float weatherAlpha;
      attribute float weatherTone;
      varying float vWeatherAlpha;
      varying float vWeatherTone;

      void main() {
        vWeatherAlpha = weatherAlpha;
        vWeatherTone = weatherTone;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 primaryColour;
      uniform vec3 secondaryColour;
      uniform float globalOpacity;
      varying float vWeatherAlpha;
      varying float vWeatherTone;

      void main() {
        float alpha = clamp(vWeatherAlpha * globalOpacity, 0.0, 1.0);
        if (alpha <= 0.004) discard;
        vec3 colour = mix(primaryColour, secondaryColour, clamp(vWeatherTone, 0.0, 1.0));
        gl_FragColor = vec4(colour, alpha);
      }
    `,
  }) as WeatherMaterial;
}

function getWeatherDebugState(patches: Map<string, WeatherPatch>): WeatherDebugState {
  let activePatch: WeatherPatch | null = null;
  let nearestPatch: WeatherPatch | null = null;
  let debugPatch: WeatherPatch | null = null;
  let visibleParticleCount = 0;

  for (const patch of patches.values()) {
    visibleParticleCount += patch.visibleParticleCount;
    if (!nearestPatch || patch.distanceToFocus < nearestPatch.distanceToFocus) nearestPatch = patch;
    if (!activePatch || patch.intensity > activePatch.intensity) activePatch = patch;
    if (patch.key === debugWeatherSpawn.pocket.key) debugPatch = patch;
  }

  if (activePatch && activePatch.intensity <= weatherVisibilityCutoff) activePatch = null;
  const activePalette = activePatch ? paletteToState(activePatch.palette) : null;
  return {
    pocketCount: patches.size,
    activePocketKey: activePatch?.key ?? null,
    currentPocketType: activePatch?.type ?? null,
    distanceToCenter: activePatch?.distanceToFocus ?? nearestPatch?.distanceToFocus ?? Number.POSITIVE_INFINITY,
    radius: activePatch?.radius ?? nearestPatch?.radius ?? 0,
    fadeStart: activePatch ? fadeStartForPocket(activePatch) : nearestPatch ? fadeStartForPocket(nearestPatch) : 0,
    fadeEnd: activePatch ? fadeEndForPocket(activePatch) : nearestPatch ? fadeEndForPocket(nearestPatch) : 0,
    intensity: activePatch?.intensity ?? 0,
    visibleParticleCount,
    particleLimit: maxRenderedWeatherPatches * weatherParticleLimit,
    debugPocketDistance: debugPatch?.distanceToFocus ?? Number.POSITIVE_INFINITY,
    debugPocketIntensity: debugPatch?.intensity ?? 0,
    activePalette,
    nearestPocket: nearestPatch
      ? {
          key: nearestPatch.key,
          x: nearestPatch.x,
          z: nearestPatch.z,
          radius: nearestPatch.radius,
          type: nearestPatch.type,
          distanceToCenter: nearestPatch.distanceToFocus,
        }
      : null,
    debugSpawn: getWeatherDebugSpawn(),
    pocketTypes: [...weatherTypes],
  };
}

function getWeatherSkyInfluence(state: WeatherDebugState): WeatherSkyInfluence {
  if (!state.activePalette || state.intensity <= weatherVisibilityCutoff) {
    return {
      amount: 0,
      fogHex: paletteByType["pink-rain"].fog.getHex(),
      backgroundHex: paletteByType["pink-rain"].background.getHex(),
      fogDensityBoost: 0,
      prismAmount: 0,
    };
  }

  const amount = THREE.MathUtils.clamp(state.intensity, 0, 1);
  const type = state.currentPocketType ?? "pink-rain";
  const palette = paletteByType[type];
  return {
    amount,
    fogHex: palette.fog.getHex(),
    backgroundHex: palette.background.getHex(),
    fogDensityBoost: THREE.MathUtils.lerp(0.001, type === "pink-rain" ? 0.0038 : 0.0028, amount),
    prismAmount: type === "glow-motes" ? amount * 0.06 : amount * 0.035,
  };
}

function makeEmptyDebugState(): WeatherDebugState {
  return {
    pocketCount: 0,
    activePocketKey: null,
    currentPocketType: null,
    distanceToCenter: Number.POSITIVE_INFINITY,
    radius: 0,
    fadeStart: 0,
    fadeEnd: 0,
    intensity: 0,
    visibleParticleCount: 0,
    particleLimit: maxRenderedWeatherPatches * weatherParticleLimit,
    debugPocketDistance: Number.POSITIVE_INFINITY,
    debugPocketIntensity: 0,
    activePalette: null,
    nearestPocket: null,
    debugSpawn: getWeatherDebugSpawn(),
    pocketTypes: [...weatherTypes],
  };
}

function createWeatherPocketCandidate(chunkX: number, chunkZ: number): WeatherPocket | null {
  const random = createChunkRandom(chunkX * 17 - 31, chunkZ * 19 + 47);
  const chance = random();
  if (chance > 0.34) return null;

  const x = (chunkX + 0.18 + random() * 0.64) * weatherChunkSize;
  const z = (chunkZ + 0.18 + random() * 0.64) * weatherChunkSize;
  if (Math.hypot(x - 8, z - 18) < 96) return null;

  const type = weatherTypes[Math.min(weatherTypes.length - 1, Math.floor(random() * weatherTypes.length))];
  const radius = THREE.MathUtils.lerp(46, 72, random());
  return {
    key: `${chunkX}:${chunkZ}:weather`,
    x,
    z,
    radius,
    type,
    phase: random() * Math.PI * 2,
    baseIntensity: THREE.MathUtils.lerp(0.72, 0.96, random()),
    palette: paletteByType[type],
  };
}

function findDebugWeatherPocket(): WeatherPocket {
  const candidates: WeatherPocket[] = [];
  for (let chunkZ = -8; chunkZ <= 8; chunkZ += 1) {
    for (let chunkX = -8; chunkX <= 8; chunkX += 1) {
      const pocket = createWeatherPocketCandidate(chunkX, chunkZ);
      if (!pocket) continue;
      if (Math.hypot(pocket.x, pocket.z) < 180) continue;
      candidates.push(pocket);
    }
  }

  candidates.sort((a, b) => {
    const typeA = a.type === "pink-rain" ? 0 : a.type === "glow-motes" ? 1 : 2;
    const typeB = b.type === "pink-rain" ? 0 : b.type === "glow-motes" ? 1 : 2;
    return typeA - typeB || Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z);
  });

  const pocket = candidates[0];
  if (pocket) return pocket;

  throw new Error("Weather debug spawn could not find a deterministic generated pocket");
}

function makeDebugSpawn(pocket: WeatherPocket): WeatherDebugSpawn {
  const angle = pocket.phase + 0.7;
  const distance = Math.min(18, pocket.radius * 0.34);
  const x = pocket.x + Math.cos(angle) * distance;
  const z = pocket.z + Math.sin(angle) * distance;
  return {
    x,
    z,
    lookAtX: pocket.x,
    lookAtZ: pocket.z,
    yaw: Math.atan2(x - pocket.x, z - pocket.z),
    pitch: -0.08,
    pocket: {
      key: pocket.key,
      x: pocket.x,
      z: pocket.z,
      radius: pocket.radius,
      type: pocket.type,
    },
    edgeSample: {
      x: pocket.x + Math.cos(angle) * (pocket.radius * 0.82),
      z: pocket.z + Math.sin(angle) * (pocket.radius * 0.82),
    },
    outsideSample: {
      x: pocket.x + Math.cos(angle) * (pocket.radius + weatherFadeMargin + 70),
      z: pocket.z + Math.sin(angle) * (pocket.radius + weatherFadeMargin + 70),
    },
  };
}

function fadeStartForPocket(pocket: Pick<WeatherPocket, "radius">): number {
  return pocket.radius * 0.46;
}

function fadeEndForPocket(pocket: Pick<WeatherPocket, "radius">): number {
  return pocket.radius + weatherFadeMargin;
}

function particleCountForType(type: WeatherPocketType, isDemo: boolean): number {
  const base = type === "pink-rain" ? 64 : type === "reverse-ash" ? 52 : 58;
  return Math.min(weatherParticleLimit, base + (isDemo ? 8 : 0));
}

function paletteToState(palette: WeatherPalette): WeatherPaletteState {
  return {
    primary: `#${palette.primary.getHexString()}`,
    secondary: `#${palette.secondary.getHexString()}`,
    fog: `#${palette.fog.getHexString()}`,
    background: `#${palette.background.getHexString()}`,
  };
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 73856093) ^ Math.imul(chunkZ, 19349663) ^ 0x6a09e667) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}
