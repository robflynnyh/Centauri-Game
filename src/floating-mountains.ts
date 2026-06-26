import * as THREE from "three";
import { DIAMOND_BIOMES } from "./diamond-biome";
import {
  normalizePlanetCoords,
  placeObjectOnPlanet,
  pointOnPlanet,
  surfaceDistanceBetweenLocal,
  type LocalPlanetPoint,
} from "./planet";
import { getOceanRegions, oceanStateAt } from "./water";

type HeightSampler = (x: number, z: number) => number;

export type FloatingMountainsDebugViewState = {
  hasLineOfSight: boolean;
  inFrame: boolean;
  angularOffset: number;
  targetDistance: number;
};

export type FloatingMountainsDebugState = {
  center: LocalPlanetPoint & { groundHeight: number };
  islandCount: number;
  altitudeRange: { min: number; max: number };
  absoluteAltitudeRange: { min: number; max: number };
  bottomClearanceRange: { min: number; max: number };
  nearestDistanceToPlayer: number;
  debugSpawnHasLineOfSight: boolean;
  debugViewFramed: boolean;
  debugView: FloatingMountainsDebugViewState;
  debugSpawn: {
    x: number;
    z: number;
    yaw: number;
    pitch: number;
    altitudeAboveGround: number;
  };
  debugTarget: {
    x: number;
    z: number;
    altitude: number;
  };
  reservedZones: Array<LocalPlanetPoint & { radius: number }>;
  avoidance: {
    distanceFromStart: number;
    nearestReservedZoneClearance: number;
    nearestOceanShoreDistance: number;
    nearestDiamondBiomeClearance: number;
  };
  islands: {
    id: string;
    x: number;
    z: number;
    groundHeight: number;
    altitude: number;
    altitudeAboveGround: number;
    bottomClearance: number;
    depth: number;
    topRadius: number;
    hero: boolean;
  }[];
};

export type FloatingMountainsSystem = {
  group: THREE.Group;
  center: LocalPlanetPoint;
  reservedZone: LocalPlanetPoint & { radius: number };
  debugSpawn: FloatingMountainsDebugState["debugSpawn"];
  debugTarget: FloatingMountainsDebugState["debugTarget"];
  update: (elapsed: number) => void;
  getDebugState: (playerPosition?: LocalPlanetPoint, camera?: THREE.Camera) => FloatingMountainsDebugState;
};

type FloatingIslandConfig = {
  id: string;
  offsetX: number;
  offsetZ: number;
  radiusX: number;
  radiusZ: number;
  depth: number;
  altitudeAboveGround: number;
  yaw: number;
  bobAmplitude: number;
  phase: number;
  rock: number;
  cap: number;
  shelfCount: number;
  vineCount: number;
  foliageCount: number;
  waterfallCount: number;
  hero?: boolean;
};

type RuntimeFloatingIsland = {
  config: FloatingIslandConfig;
  group: THREE.Group;
  x: number;
  z: number;
  groundHeight: number;
  altitude: number;
  rotation: THREE.Euler;
};

const floatingMountainsSeed = "centauri-rob-307-floating-mountain-archipelago";
const startPosition = { x: 0, z: 24 };
const reservedRadius = 225;
const minimumCenterDistanceFromStart = 720;
const minimumOceanShoreDistance = 86;
const minimumDiamondClearance = 245;
const debugAltitudeAboveGround = 78;
const debugPitch = -0.08;

const candidateCenters = [
  normalizePlanetCoords(1420, 70),
  normalizePlanetCoords(1560, 430),
  normalizePlanetCoords(1090, -170),
  normalizePlanetCoords(1710, -330),
];

const vineMaterial = new THREE.MeshBasicMaterial({ color: 0x183d43 });
const vineLeafMaterial = new THREE.MeshBasicMaterial({ color: 0x5fe28f });
const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x1e1633 });
const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0x8effe7,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const waterfallMaterial = new THREE.MeshBasicMaterial({
  color: 0xaef8ff,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const foliageMaterials = [
  new THREE.MeshBasicMaterial({ color: 0x82ff6d }),
  new THREE.MeshBasicMaterial({ color: 0xff72aa }),
  new THREE.MeshBasicMaterial({ color: 0x64e6ff }),
];

export function createFloatingMountainsRegion(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }> = []
): FloatingMountainsSystem {
  const center = chooseFloatingMountainsCenter(heightAt, avoidZones);
  const group = new THREE.Group();
  group.name = "floating-mountain-archipelago-region";
  scene.add(group);

  const configs = makeIslandConfigs();
  const islands = configs.map((config, index) => makeRuntimeIsland(center, config, index, heightAt));
  islands.forEach((island) => group.add(island.group));

  const heroIsland = islands.find((island) => island.config.hero) ?? islands[0];
  const debugTarget = {
    x: heroIsland.x,
    z: heroIsland.z,
    altitude: heroIsland.altitude + heroIsland.config.depth * 0.12,
  };
  const debugSpawn = makeDebugSpawn(center, debugTarget);
  const debugLineOfSight = hasDebugLineOfSight(heightAt, debugSpawn, debugTarget);
  const reservedZone = { x: center.x, z: center.z, radius: reservedRadius };
  const avoidance = summarizeAvoidance(center, heightAt, avoidZones);

  const update = (elapsed: number): void => {
    islands.forEach((island, index) => {
      const phase = island.config.phase + index * 0.37;
      const bob = Math.sin(elapsed * 0.28 + phase) * island.config.bobAmplitude;
      island.rotation.set(
        Math.sin(elapsed * 0.17 + phase) * 0.01,
        island.config.yaw,
        Math.sin(elapsed * 0.13 + phase * 1.7) * 0.014
      );
      placeObjectOnPlanet(island.group, island.x, island.z, island.altitude + bob, island.rotation);
    });
  };

  const getDebugState = (playerPosition: LocalPlanetPoint = debugSpawn, camera?: THREE.Camera): FloatingMountainsDebugState => {
    const altitudeRange = summarizeAltitudeRange(islands);
    const absoluteAltitudeRange = summarizeAbsoluteAltitudeRange(islands);
    const bottomClearanceRange = summarizeBottomClearanceRange(islands);
    const nearestDistanceToPlayer = Math.min(
      ...islands.map((island) => surfaceDistanceBetweenLocal(playerPosition, { x: island.x, z: island.z }))
    );
    const debugView = summarizeDebugView(camera, debugTarget, debugLineOfSight);

    return {
      center: { x: center.x, z: center.z, groundHeight: heightAt(center.x, center.z) },
      islandCount: islands.length,
      altitudeRange,
      absoluteAltitudeRange,
      bottomClearanceRange,
      nearestDistanceToPlayer,
      debugSpawnHasLineOfSight: debugLineOfSight,
      debugViewFramed: debugView.inFrame,
      debugView,
      debugSpawn,
      debugTarget,
      reservedZones: [reservedZone],
      avoidance,
      islands: islands.map((island) => ({
        id: island.config.id,
        x: island.x,
        z: island.z,
        groundHeight: island.groundHeight,
        altitude: island.altitude,
        altitudeAboveGround: island.config.altitudeAboveGround,
        bottomClearance: island.config.altitudeAboveGround - island.config.depth,
        depth: island.config.depth,
        topRadius: Math.max(island.config.radiusX, island.config.radiusZ),
        hero: Boolean(island.config.hero),
      })),
    };
  };

  update(0);

  return {
    group,
    center,
    reservedZone,
    debugSpawn,
    debugTarget,
    update,
    getDebugState,
  };
}

function chooseFloatingMountainsCenter(
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }>
): LocalPlanetPoint {
  const validCandidate = candidateCenters.find((candidate) => isValidCenter(candidate, heightAt, avoidZones));
  return validCandidate ?? candidateCenters[0];
}

function isValidCenter(
  point: LocalPlanetPoint,
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }>
): boolean {
  if (surfaceDistanceBetweenLocal(point, startPosition) < minimumCenterDistanceFromStart) return false;
  if (avoidZones.some((zone) => surfaceDistanceBetweenLocal(point, zone) < zone.radius + reservedRadius)) return false;
  if (oceanStateAt(point.x, point.z, heightAt).signedShoreDistance < minimumOceanShoreDistance) return false;
  if (nearestDiamondBiomeClearance(point) < minimumDiamondClearance) return false;

  const groundHeight = heightAt(point.x, point.z);
  if (groundHeight < -0.4) return false;
  const sampleDistance = 68;
  const samples = [
    heightAt(point.x + sampleDistance, point.z),
    heightAt(point.x - sampleDistance, point.z),
    heightAt(point.x, point.z + sampleDistance),
    heightAt(point.x, point.z - sampleDistance),
  ];
  return samples.every((height) => height > -1.4);
}

function makeIslandConfigs(): FloatingIslandConfig[] {
  return [
    {
      id: "central-needle",
      offsetX: 0,
      offsetZ: 0,
      radiusX: 24,
      radiusZ: 18,
      depth: 82,
      altitudeAboveGround: 112,
      yaw: -0.38,
      bobAmplitude: 0.32,
      phase: 0.4,
      rock: 0x6f4c91,
      cap: 0x8fc857,
      shelfCount: 5,
      vineCount: 12,
      foliageCount: 16,
      waterfallCount: 2,
      hero: true,
    },
    {
      id: "twin-shelf",
      offsetX: -58,
      offsetZ: -28,
      radiusX: 18,
      radiusZ: 13,
      depth: 64,
      altitudeAboveGround: 92,
      yaw: 0.76,
      bobAmplitude: 0.24,
      phase: 1.9,
      rock: 0x7f5a9e,
      cap: 0x69b96d,
      shelfCount: 4,
      vineCount: 9,
      foliageCount: 10,
      waterfallCount: 1,
      hero: true,
    },
    {
      id: "amber-fin",
      offsetX: 62,
      offsetZ: -42,
      radiusX: 15,
      radiusZ: 12,
      depth: 56,
      altitudeAboveGround: 84,
      yaw: -1.1,
      bobAmplitude: 0.19,
      phase: 2.8,
      rock: 0x8c547a,
      cap: 0xb0c45b,
      shelfCount: 3,
      vineCount: 8,
      foliageCount: 8,
      waterfallCount: 1,
    },
    {
      id: "high-shard",
      offsetX: 118,
      offsetZ: -74,
      radiusX: 8,
      radiusZ: 7,
      depth: 34,
      altitudeAboveGround: 104,
      yaw: 0.24,
      bobAmplitude: 0.18,
      phase: 4.4,
      rock: 0x5f5098,
      cap: 0x7fd49b,
      shelfCount: 1,
      vineCount: 4,
      foliageCount: 4,
      waterfallCount: 0,
    },
    {
      id: "west-root",
      offsetX: -108,
      offsetZ: 36,
      radiusX: 12,
      radiusZ: 9,
      depth: 46,
      altitudeAboveGround: 72,
      yaw: 1.35,
      bobAmplitude: 0.22,
      phase: 3.5,
      rock: 0x705394,
      cap: 0x55c4a4,
      shelfCount: 3,
      vineCount: 8,
      foliageCount: 7,
      waterfallCount: 0,
    },
    {
      id: "low-garden",
      offsetX: -22,
      offsetZ: 88,
      radiusX: 13,
      radiusZ: 10,
      depth: 44,
      altitudeAboveGround: 58,
      yaw: -0.86,
      bobAmplitude: 0.2,
      phase: 5.2,
      rock: 0x8960a1,
      cap: 0x7ee070,
      shelfCount: 3,
      vineCount: 7,
      foliageCount: 12,
      waterfallCount: 1,
    },
    {
      id: "small-lantern",
      offsetX: 46,
      offsetZ: 102,
      radiusX: 8,
      radiusZ: 6,
      depth: 30,
      altitudeAboveGround: 48,
      yaw: 1.82,
      bobAmplitude: 0.14,
      phase: 0.9,
      rock: 0x69488c,
      cap: 0xa4d763,
      shelfCount: 1,
      vineCount: 4,
      foliageCount: 5,
      waterfallCount: 0,
    },
    {
      id: "far-chip",
      offsetX: -138,
      offsetZ: -34,
      radiusX: 7,
      radiusZ: 6,
      depth: 28,
      altitudeAboveGround: 64,
      yaw: -1.62,
      bobAmplitude: 0.12,
      phase: 2.2,
      rock: 0x765081,
      cap: 0x63bf78,
      shelfCount: 1,
      vineCount: 3,
      foliageCount: 3,
      waterfallCount: 0,
    },
    {
      id: "mist-pillar",
      offsetX: 96,
      offsetZ: 54,
      radiusX: 10,
      radiusZ: 8,
      depth: 40,
      altitudeAboveGround: 66,
      yaw: 0.52,
      bobAmplitude: 0.16,
      phase: 4.9,
      rock: 0x7b568d,
      cap: 0x4bc6a9,
      shelfCount: 2,
      vineCount: 6,
      foliageCount: 6,
      waterfallCount: 1,
    },
    {
      id: "rear-splinter",
      offsetX: 8,
      offsetZ: -116,
      radiusX: 9,
      radiusZ: 7,
      depth: 36,
      altitudeAboveGround: 76,
      yaw: -2.28,
      bobAmplitude: 0.15,
      phase: 6.1,
      rock: 0x604f91,
      cap: 0x9acb68,
      shelfCount: 2,
      vineCount: 5,
      foliageCount: 4,
      waterfallCount: 0,
    },
  ];
}

function makeRuntimeIsland(
  center: LocalPlanetPoint,
  config: FloatingIslandConfig,
  index: number,
  heightAt: HeightSampler
): RuntimeFloatingIsland {
  const position = normalizePlanetCoords(center.x + config.offsetX, center.z + config.offsetZ);
  const groundHeight = heightAt(position.x, position.z);
  const group = makeIslandGroup(config, index);

  return {
    config,
    group,
    x: position.x,
    z: position.z,
    groundHeight,
    altitude: groundHeight + config.altitudeAboveGround,
    rotation: new THREE.Euler(),
  };
}

function makeIslandGroup(config: FloatingIslandConfig, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `floating-mountain-${config.id}`;
  const random = createSeededRandom(`${floatingMountainsSeed}:${config.id}`);
  const rockMaterial = new THREE.MeshBasicMaterial({ color: config.rock, side: THREE.DoubleSide });
  const capMaterial = new THREE.MeshBasicMaterial({ color: config.cap });
  const darkStoneMaterial = new THREE.MeshBasicMaterial({ color: tint(config.rock, 0.58) });

  const rock = new THREE.Mesh(
    makeFloatingRockGeometry(config.radiusX, config.radiusZ, config.depth, index, 6 + (index % 3)),
    rockMaterial
  );
  rock.name = `${config.id}-tapered-rock`;
  group.add(rock);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.44, 6 + (index % 3)), capMaterial);
  cap.name = `${config.id}-flat-colour-garden-cap`;
  cap.scale.set(config.radiusX * 0.84, 1, config.radiusZ * 0.74);
  cap.position.y = 0.18;
  cap.rotation.y = config.yaw * 0.4;
  group.add(cap);

  addShelves(group, config, random, darkStoneMaterial);
  addCracks(group, config, random);
  addVines(group, config, random);
  addFoliage(group, config, random);
  addGlowStones(group, config, random);
  addWaterfallStrands(group, config, random);

  return group;
}

function makeFloatingRockGeometry(
  radiusX: number,
  radiusZ: number,
  depth: number,
  islandIndex: number,
  sides: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  const ringDefs = [
    { y: 0, sx: 1, sz: 0.92 },
    { y: -depth * 0.2, sx: 0.9, sz: 0.78 },
    { y: -depth * 0.46, sx: 0.6, sz: 0.5 },
    { y: -depth * 0.75, sx: 0.28, sz: 0.24 },
    { y: -depth, sx: 0.07, sz: 0.06 },
  ];
  const anglePhase = islandIndex * 0.63;

  ringDefs.forEach((ring, ringIndex) => {
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2 + anglePhase;
      const jag = 1 + Math.sin(side * 1.7 + islandIndex * 0.9 + ringIndex * 0.8) * 0.12;
      const chip = 1 + Math.cos(side * 2.3 - islandIndex * 0.5 + ringIndex) * 0.07;
      positions.push(
        Math.cos(angle) * radiusX * ring.sx * jag,
        ring.y,
        Math.sin(angle) * radiusZ * ring.sz * chip
      );
    }
  });

  for (let ring = 0; ring < ringDefs.length - 1; ring += 1) {
    const current = ring * sides;
    const next = (ring + 1) * sides;
    for (let side = 0; side < sides; side += 1) {
      const sideNext = (side + 1) % sides;
      indices.push(current + side, next + side, current + sideNext);
      indices.push(current + sideNext, next + side, next + sideNext);
    }
  }

  const topCenter = positions.length / 3;
  positions.push(0, 0.18, 0);
  for (let side = 0; side < sides; side += 1) {
    indices.push(topCenter, side, (side + 1) % sides);
  }

  const bottomStart = (ringDefs.length - 1) * sides;
  const bottomCenter = positions.length / 3;
  positions.push(0, -depth - 0.2, 0);
  for (let side = 0; side < sides; side += 1) {
    indices.push(bottomCenter, bottomStart + ((side + 1) % sides), bottomStart + side);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addShelves(
  group: THREE.Group,
  config: FloatingIslandConfig,
  random: () => number,
  material: THREE.Material
): void {
  for (let i = 0; i < config.shelfCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const width = config.radiusX * (0.34 + random() * 0.36);
    const depth = config.radiusZ * (0.18 + random() * 0.28);
    shelf.name = `${config.id}-offset-stone-shelf-${i}`;
    shelf.scale.set(width, 0.55 + random() * 0.3, depth);
    shelf.position.set(
      Math.cos(angle) * config.radiusX * (0.7 + random() * 0.2),
      -config.depth * (0.18 + random() * 0.34),
      Math.sin(angle) * config.radiusZ * (0.68 + random() * 0.22)
    );
    shelf.rotation.set(0.04 - random() * 0.08, -angle + random() * 0.4, 0.1 - random() * 0.2);
    group.add(shelf);
  }
}

function addCracks(group: THREE.Group, config: FloatingIslandConfig, random: () => number): void {
  const crackCount = 3 + Math.floor(random() * 4);
  for (let i = 0; i < crackCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.16, config.depth * (0.16 + random() * 0.16), 0.08), crackMaterial);
    crack.name = `${config.id}-vertical-crack-${i}`;
    crack.position.set(
      Math.cos(angle) * config.radiusX * (0.78 + random() * 0.12),
      -config.depth * (0.22 + random() * 0.28),
      Math.sin(angle) * config.radiusZ * (0.72 + random() * 0.14)
    );
    crack.rotation.set(0.12 - random() * 0.24, -angle, 0.2 - random() * 0.4);
    group.add(crack);
  }
}

function addVines(group: THREE.Group, config: FloatingIslandConfig, random: () => number): void {
  for (let i = 0; i < config.vineCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const length = config.depth * (0.28 + random() * 0.46);
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.022, length, 4), vineMaterial);
    vine.name = `${config.id}-dangling-root-${i}`;
    vine.position.set(
      Math.cos(angle) * config.radiusX * (0.48 + random() * 0.44),
      -0.6 - length * 0.5,
      Math.sin(angle) * config.radiusZ * (0.48 + random() * 0.42)
    );
    vine.rotation.set(0.08 - random() * 0.16, angle * 0.1, 0.1 - random() * 0.2);
    group.add(vine);

    if (i % 3 === 0) {
      const leaf = new THREE.Mesh(new THREE.OctahedronGeometry(0.26 + random() * 0.16, 0), vineLeafMaterial);
      leaf.name = `${config.id}-root-leaf-${i}`;
      leaf.position.set(vine.position.x + (random() - 0.5) * 0.5, vine.position.y - length * 0.18, vine.position.z);
      leaf.scale.set(0.8, 1.6, 0.55);
      leaf.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      group.add(leaf);
    }
  }
}

function addFoliage(group: THREE.Group, config: FloatingIslandConfig, random: () => number): void {
  for (let i = 0; i < config.foliageCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.76;
    const material = foliageMaterials[i % foliageMaterials.length];
    const plant =
      random() > 0.35
        ? new THREE.Mesh(new THREE.ConeGeometry(0.34 + random() * 0.2, 1.1 + random() * 0.7, 4), material)
        : new THREE.Mesh(new THREE.OctahedronGeometry(0.42 + random() * 0.18, 0), material);
    plant.name = `${config.id}-alien-foliage-${i}`;
    plant.position.set(
      Math.cos(angle) * config.radiusX * radius,
      0.72 + random() * 0.28,
      Math.sin(angle) * config.radiusZ * radius
    );
    plant.rotation.set(0.12 - random() * 0.24, random() * Math.PI * 2, 0.16 - random() * 0.32);
    plant.scale.y *= 0.78 + random() * 0.72;
    group.add(plant);
  }
}

function addGlowStones(group: THREE.Group, config: FloatingIslandConfig, random: () => number): void {
  const glowCount = config.hero ? 9 : 3 + Math.floor(random() * 3);
  for (let i = 0; i < glowCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + random() * 0.2, 0), glowMaterial.clone());
    stone.name = `${config.id}-soft-glow-stone-${i}`;
    stone.position.set(
      Math.cos(angle) * config.radiusX * (0.42 + random() * 0.54),
      -config.depth * (0.08 + random() * 0.48),
      Math.sin(angle) * config.radiusZ * (0.42 + random() * 0.48)
    );
    stone.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    group.add(stone);
  }
}

function addWaterfallStrands(group: THREE.Group, config: FloatingIslandConfig, random: () => number): void {
  for (let i = 0; i < config.waterfallCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const length = config.depth * (0.42 + random() * 0.24);
    const strand = new THREE.Mesh(new THREE.PlaneGeometry(0.72 + random() * 0.42, length), waterfallMaterial);
    strand.name = `${config.id}-thin-mistfall-strand-${i}`;
    strand.position.set(
      Math.cos(angle) * config.radiusX * 0.82,
      -1.2 - length * 0.5,
      Math.sin(angle) * config.radiusZ * 0.82
    );
    strand.rotation.set(0, -angle + Math.PI * 0.5, 0.06 - random() * 0.12);
    group.add(strand);
  }
}

function makeDebugSpawn(
  center: LocalPlanetPoint,
  target: { x: number; z: number; altitude: number }
): FloatingMountainsDebugState["debugSpawn"] {
  const spawn = normalizePlanetCoords(center.x + 150, center.z + 66);
  return {
    x: spawn.x,
    z: spawn.z,
    yaw: Math.atan2(-(target.x - spawn.x), -(target.z - spawn.z)),
    pitch: debugPitch,
    altitudeAboveGround: debugAltitudeAboveGround,
  };
}

function hasDebugLineOfSight(
  heightAt: HeightSampler,
  spawn: FloatingMountainsDebugState["debugSpawn"],
  target: FloatingMountainsDebugState["debugTarget"]
): boolean {
  const spawnAltitude = heightAt(spawn.x, spawn.z) + spawn.altitudeAboveGround;
  for (let i = 1; i < 10; i += 1) {
    const t = i / 10;
    const x = THREE.MathUtils.lerp(spawn.x, target.x, t);
    const z = THREE.MathUtils.lerp(spawn.z, target.z, t);
    const rayAltitude = THREE.MathUtils.lerp(spawnAltitude, target.altitude, t);
    if (rayAltitude < heightAt(x, z) + 5.5) return false;
  }
  return true;
}

function summarizeDebugView(
  camera: THREE.Camera | undefined,
  target: FloatingMountainsDebugState["debugTarget"],
  hasLineOfSight: boolean
): FloatingMountainsDebugViewState {
  if (!camera) {
    return {
      hasLineOfSight,
      inFrame: hasLineOfSight,
      angularOffset: 0,
      targetDistance: 0,
    };
  }

  const targetWorld = pointOnPlanet(target.x, target.z, target.altitude);
  const toTarget = targetWorld.sub(camera.position);
  const targetDistance = toTarget.length();
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  const angularOffset = cameraDirection.angleTo(toTarget.normalize());
  const perspectiveCamera = camera as THREE.PerspectiveCamera & { isPerspectiveCamera?: boolean };
  const halfFov = THREE.MathUtils.degToRad((perspectiveCamera.isPerspectiveCamera ? perspectiveCamera.fov : 68) * 0.5);

  return {
    hasLineOfSight,
    inFrame: hasLineOfSight && angularOffset < halfFov * 0.74,
    angularOffset,
    targetDistance,
  };
}

function summarizeAltitudeRange(islands: RuntimeFloatingIsland[]): { min: number; max: number } {
  return {
    min: Math.min(...islands.map((island) => island.config.altitudeAboveGround)),
    max: Math.max(...islands.map((island) => island.config.altitudeAboveGround)),
  };
}

function summarizeAbsoluteAltitudeRange(islands: RuntimeFloatingIsland[]): { min: number; max: number } {
  return {
    min: Math.min(...islands.map((island) => island.altitude)),
    max: Math.max(...islands.map((island) => island.altitude)),
  };
}

function summarizeBottomClearanceRange(islands: RuntimeFloatingIsland[]): { min: number; max: number } {
  return {
    min: Math.min(...islands.map((island) => island.config.altitudeAboveGround - island.config.depth)),
    max: Math.max(...islands.map((island) => island.config.altitudeAboveGround - island.config.depth)),
  };
}

function summarizeAvoidance(
  center: LocalPlanetPoint,
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }>
): FloatingMountainsDebugState["avoidance"] {
  const nearestReservedZoneClearance =
    avoidZones.length > 0
      ? Math.min(...avoidZones.map((zone) => surfaceDistanceBetweenLocal(center, zone) - zone.radius - reservedRadius))
      : Number.POSITIVE_INFINITY;
  const nearestOceanShoreDistance = Math.min(
    oceanStateAt(center.x, center.z, heightAt).signedShoreDistance,
    ...getOceanRegions().map((region) => surfaceDistanceBetweenLocal(center, region.center) - region.baseRadius)
  );

  return {
    distanceFromStart: surfaceDistanceBetweenLocal(center, startPosition),
    nearestReservedZoneClearance,
    nearestOceanShoreDistance,
    nearestDiamondBiomeClearance: nearestDiamondBiomeClearance(center),
  };
}

function nearestDiamondBiomeClearance(point: LocalPlanetPoint): number {
  return Math.min(...DIAMOND_BIOMES.map((biome) => surfaceDistanceBetweenLocal(point, biome.center) - biome.radius));
}

function tint(colour: number, multiplier: number): number {
  const source = new THREE.Color(colour);
  source.multiplyScalar(multiplier);
  return source.getHex();
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
