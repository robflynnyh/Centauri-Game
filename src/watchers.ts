import * as THREE from "three";
import type { CollisionObstacle } from "./collision";
import { isInLandmarkZone, type LandmarkZone } from "./landmarks";
import { nearestGeneratedBiomePatchDistanceAt } from "./nature";
import { normalizePlanetCoords, placeObjectOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";
import { isInMassiveMountainFootprint } from "./terrain";
import { oceanStateAt } from "./water";

type HeightSampler = (x: number, z: number) => number;
type SetCollisionObstacles = (obstacles: CollisionObstacle[]) => void;

type Watcher = {
  root: THREE.Group;
  eyeRoot: THREE.Group;
  pupil: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  anchor: LocalPlanetPoint;
  yaw: number;
  radius: number;
  collisionRadius: number;
  nearestBiomePatchDistance: number;
  eyeTargetAngle: number;
  eyeSurfaceAngle: number;
  pupilOffsetX: number;
  pupilOffsetY: number;
  eyeOffsetX: number;
  eyeOffsetZ: number;
  lastDistanceToPlayer: number;
};

export type WatcherDebugState = {
  total: number;
  nearbyUpdated: number;
  nearestDistance: number;
  nearest: {
    x: number;
    z: number;
    bodyWorldX: number;
    bodyWorldY: number;
    bodyWorldZ: number;
    eyeWorldX: number;
    eyeWorldY: number;
    eyeWorldZ: number;
    nearestBiomePatchDistance: number;
    outsideBiomeThreshold: boolean;
    eyeTargetAngle: number;
    eyeSurfaceAngle: number;
    eyeOffsetX: number;
    eyeOffsetZ: number;
    pupilOffsetX: number;
    pupilOffsetY: number;
    collisionRadius: number;
    distanceToPlayer: number;
  } | null;
  debugSpawn: {
    x: number;
    z: number;
    yaw: number;
    watcherX: number;
    watcherZ: number;
  };
};

const watcherChunkSize = 160;
const watcherChunkRadius = 4;
const watcherCellSize = 220;
const watcherBiomeClearance = 72;
const watcherObstacleClearance = 8.5;
const watcherEyeUpdateDistance = 150;
const debugWatcherSearchOrigin = { x: -128, z: -464 };
const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x7b5cff });
const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x47308f, transparent: true, opacity: 0.42 });
const cheekMaterial = new THREE.MeshBasicMaterial({ color: 0x45d3bd });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xfffceb });
const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x1c1445 });

export function createOutsideBiomeWatchers(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  obstacles: CollisionObstacle[] = [],
  landmarkZones: LandmarkZone[] = [],
  setCollisionObstacles: SetCollisionObstacles = () => undefined
): {
  group: THREE.Group;
  updateChunks: (centerX: number, centerZ: number) => void;
  updateEyes: (playerPosition: LocalPlanetPoint) => void;
  getState: (playerPosition: LocalPlanetPoint) => WatcherDebugState;
} {
  const group = new THREE.Group();
  group.name = "outside-biome-watchers";
  scene.add(group);

  let centerChunkX = Number.NaN;
  let centerChunkZ = Number.NaN;
  let watchers: Watcher[] = [];
  let nearbyUpdated = 0;

  const rebuild = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / watcherChunkSize);
    const nextChunkZ = Math.floor(normalized.z / watcherChunkSize);
    if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;

    disposeWatcherGroup(group);
    group.clear();
    watchers = [];
    const collisionObstacles: CollisionObstacle[] = [];
    centerChunkX = nextChunkX;
    centerChunkZ = nextChunkZ;

    const minX = (centerChunkX - watcherChunkRadius) * watcherChunkSize;
    const maxX = (centerChunkX + watcherChunkRadius + 1) * watcherChunkSize;
    const minZ = (centerChunkZ - watcherChunkRadius) * watcherChunkSize;
    const maxZ = (centerChunkZ + watcherChunkRadius + 1) * watcherChunkSize;
    const minCellX = Math.floor(minX / watcherCellSize);
    const maxCellX = Math.floor(maxX / watcherCellSize);
    const minCellZ = Math.floor(minZ / watcherCellSize);
    const maxCellZ = Math.floor(maxZ / watcherCellSize);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const candidate = watcherCandidateAtCell(cellX, cellZ);
        if (!candidate || !isWatcherPlacementValid(candidate, obstacles, landmarkZones)) continue;
        const watcher = makeWatcher(candidate, heightAt);
        watchers.push(watcher);
        collisionObstacles.push({ kind: "watcher", x: watcher.anchor.x, z: watcher.anchor.z, radius: watcher.collisionRadius });
        group.add(watcher.root);
      }
    }

    setCollisionObstacles(collisionObstacles);
  };

  const updateEyes = (playerPosition: LocalPlanetPoint): void => {
    nearbyUpdated = 0;
    for (const watcher of watchers) {
      const distance = surfaceDistanceBetweenLocal(playerPosition, watcher.anchor);
      watcher.lastDistanceToPlayer = distance;
      if (distance > watcherEyeUpdateDistance) continue;
      nearbyUpdated += 1;
      updateWatcherEye(watcher, playerPosition);
    }
  };

  const getState = (playerPosition: LocalPlanetPoint): WatcherDebugState => {
    let nearest: Watcher | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const watcher of watchers) {
      const distance = surfaceDistanceBetweenLocal(playerPosition, watcher.anchor);
      if (distance < nearestDistance) {
        nearest = watcher;
        nearestDistance = distance;
      }
    }

    return {
      total: watchers.length,
      nearbyUpdated,
      nearestDistance,
      nearest: nearest
        ? {
            x: nearest.anchor.x,
            z: nearest.anchor.z,
            bodyWorldX: nearest.root.position.x,
            bodyWorldY: nearest.root.position.y,
            bodyWorldZ: nearest.root.position.z,
            eyeWorldX: nearest.eyeRoot.getWorldPosition(new THREE.Vector3()).x,
            eyeWorldY: nearest.eyeRoot.getWorldPosition(new THREE.Vector3()).y,
            eyeWorldZ: nearest.eyeRoot.getWorldPosition(new THREE.Vector3()).z,
            nearestBiomePatchDistance: nearest.nearestBiomePatchDistance,
            outsideBiomeThreshold: nearest.nearestBiomePatchDistance >= watcherBiomeClearance,
            eyeTargetAngle: nearest.eyeTargetAngle,
            eyeSurfaceAngle: nearest.eyeSurfaceAngle,
            eyeOffsetX: nearest.eyeOffsetX,
            eyeOffsetZ: nearest.eyeOffsetZ,
            pupilOffsetX: nearest.pupilOffsetX,
            pupilOffsetY: nearest.pupilOffsetY,
            collisionRadius: nearest.collisionRadius,
            distanceToPlayer: nearestDistance,
          }
        : null,
      debugSpawn: getWatcherDebugSpawn(),
    };
  };

  rebuild(0, 0);

  return {
    group,
    updateChunks: rebuild,
    updateEyes,
    getState,
  };
}

export function getWatcherDebugSpawn(): WatcherDebugState["debugSpawn"] {
  const origin = normalizePlanetCoords(debugWatcherSearchOrigin.x, debugWatcherSearchOrigin.z);
  const originCellX = Math.floor(origin.x / watcherCellSize);
  const originCellZ = Math.floor(origin.z / watcherCellSize);

  for (let radius = 0; radius <= 18; radius += 1) {
    for (let cellZ = originCellZ - radius; cellZ <= originCellZ + radius; cellZ += 1) {
      for (let cellX = originCellX - radius; cellX <= originCellX + radius; cellX += 1) {
        if (Math.abs(cellX - originCellX) !== radius && Math.abs(cellZ - originCellZ) !== radius) continue;
        const candidate = watcherCandidateAtCell(cellX, cellZ);
        if (!candidate || !isWatcherPlacementValid(candidate, [], [])) continue;
        const dx = Math.sin(candidate.yaw) * 6.6;
        const dz = Math.cos(candidate.yaw) * 6.6;
        return {
          x: candidate.x + dx,
          z: candidate.z + dz,
          yaw: Math.atan2(dx, dz),
          watcherX: candidate.x,
          watcherZ: candidate.z,
        };
      }
    }
  }

  return { x: origin.x, z: origin.z + 6.6, yaw: 0, watcherX: origin.x, watcherZ: origin.z };
}

function makeWatcher(candidate: LocalPlanetPoint & { yaw: number; scale: number }, heightAt: HeightSampler): Watcher {
  const radius = 0.64 * candidate.scale;
  const root = new THREE.Group();
  root.userData.kind = "outside-biome-watcher";
  placeObjectOnPlanet(root, candidate.x, candidate.z, heightAt(candidate.x, candidate.z) - radius * 0.04, new THREE.Euler(0, candidate.yaw, 0));

  const base = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.86, 10, 5), baseMaterial);
  base.position.y = radius * 0.1;
  base.scale.set(1.45, 0.2, 1.18);
  root.add(base);

  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), bodyMaterial);
  body.position.y = radius * 0.5;
  body.scale.set(1.28, 0.68, 1.08);
  root.add(body);

  const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.2, 7, 5), cheekMaterial);
  leftCheek.position.set(-radius * 0.48, radius * 0.34, radius * 0.5);
  leftCheek.scale.set(1.35, 0.58, 0.2);
  root.add(leftCheek);

  const rightCheek = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.16, 7, 5), cheekMaterial);
  rightCheek.position.set(radius * 0.42, radius * 0.3, -radius * 0.35);
  rightCheek.scale.set(1.1, 0.5, 0.18);
  root.add(rightCheek);

  const eyeRoot = new THREE.Group();
  eyeRoot.position.set(0, radius * 0.72, radius * 0.82);
  root.add(eyeRoot);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.36, 16, 10), eyeMaterial);
  eye.scale.set(1.1, 1.32, 0.2);
  eyeRoot.add(eye);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.12, 12, 7), pupilMaterial);
  pupil.position.set(0, 0, radius * 0.08);
  pupil.scale.set(0.86, 1.08, 0.2);
  eyeRoot.add(pupil);

  return {
    root,
    eyeRoot,
    pupil,
    anchor: { x: candidate.x, z: candidate.z },
    yaw: candidate.yaw,
    radius,
    collisionRadius: radius * 0.86,
    nearestBiomePatchDistance: nearestGeneratedBiomePatchDistanceAt(candidate),
    eyeTargetAngle: 0,
    eyeSurfaceAngle: 0,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    eyeOffsetX: 0,
    eyeOffsetZ: 0,
    lastDistanceToPlayer: Number.POSITIVE_INFINITY,
  };
}

function updateWatcherEye(watcher: Watcher, playerPosition: LocalPlanetPoint): void {
  const dx = playerPosition.x - watcher.anchor.x;
  const dz = playerPosition.z - watcher.anchor.z;
  const cosYaw = Math.cos(watcher.yaw);
  const sinYaw = Math.sin(watcher.yaw);
  const localX = cosYaw * dx - sinYaw * dz;
  const localZ = sinYaw * dx + cosYaw * dz;
  const angle = Math.atan2(localX, localZ);
  const sideAmount = THREE.MathUtils.clamp(Math.sin(angle) * 0.7, -1, 1);
  const surfaceX = Math.sin(angle) * watcher.radius * 0.88;
  const surfaceZ = Math.cos(angle) * watcher.radius * 0.8;
  const maxOffsetX = watcher.radius * 0.12;
  const maxOffsetY = watcher.radius * 0.06;
  watcher.eyeTargetAngle = angle;
  watcher.eyeSurfaceAngle = angle;
  watcher.eyeOffsetX = surfaceX;
  watcher.eyeOffsetZ = surfaceZ;
  watcher.pupilOffsetX = sideAmount * maxOffsetX;
  watcher.pupilOffsetY = Math.cos(angle) * maxOffsetY * 0.28;
  watcher.eyeRoot.position.set(surfaceX, watcher.radius * 0.72, surfaceZ);
  watcher.eyeRoot.rotation.y = angle;
  watcher.pupil.position.x = watcher.pupilOffsetX;
  watcher.pupil.position.y = watcher.pupilOffsetY;
}

function watcherCandidateAtCell(cellX: number, cellZ: number): (LocalPlanetPoint & { yaw: number; scale: number }) | null {
  const random = createCellRandom(cellX - 1801, cellZ + 947);
  if (random() > 0.18) return null;

  const point = normalizePlanetCoords(
    cellX * watcherCellSize + (0.18 + random() * 0.64) * watcherCellSize,
    cellZ * watcherCellSize + (0.18 + random() * 0.64) * watcherCellSize
  );
  const yaw = random() * Math.PI * 2;
  const scale = 0.82 + random() * 0.42;
  return { ...point, yaw, scale };
}

function isWatcherPlacementValid(
  point: LocalPlanetPoint,
  obstacles: CollisionObstacle[],
  landmarkZones: LandmarkZone[]
): boolean {
  if (nearestGeneratedBiomePatchDistanceAt(point) < watcherBiomeClearance) return false;
  if (isInLandmarkZone(point, landmarkZones)) return false;
  if (isInMassiveMountainFootprint(point.x, point.z, 14)) return false;
  if (oceanStateAt(point.x, point.z).isInOcean) return false;
  return nearestObstacleClearance(point, obstacles) >= watcherObstacleClearance;
}

function nearestObstacleClearance(point: LocalPlanetPoint, obstacles: CollisionObstacle[]): number {
  if (obstacles.length === 0) return Number.POSITIVE_INFINITY;
  return obstacles.reduce((nearest, obstacle) => {
    if (obstacle.kind === "watcher") return nearest;
    const clearance = surfaceDistanceBetweenLocal(point, obstacle) - obstacle.radius;
    return Math.min(nearest, clearance);
  }, Number.POSITIVE_INFINITY);
}

function createCellRandom(cellX: number, cellZ: number): () => number {
  let state = (Math.imul(cellX, 73856093) ^ Math.imul(cellZ, 19349663) ^ 0x6a09e667) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}

function disposeWatcherGroup(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}
