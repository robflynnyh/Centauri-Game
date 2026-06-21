import * as THREE from "three";
import {
  detailCoordinatesAt,
  normalizePlanetCoords,
  placeObjectOnPlanet,
  PLANET_DETAIL_PERIOD,
  surfaceDistanceBetweenLocal,
  type LocalPlanetPoint,
} from "./planet";

type HeightSampler = (x: number, z: number) => number;
type SolidObstacle = {
  x: number;
  z: number;
  radius: number;
};

type Creature = {
  root: THREE.Group;
  body: THREE.Mesh;
  eyes: THREE.Group;
  feet: THREE.Mesh[];
  anchor: THREE.Vector3;
  route: THREE.Vector3[];
  phase: number;
  interval: number;
};

type Beetle = {
  root: THREE.Group;
  wings: THREE.Mesh[];
  anchor: LocalPlanetPoint;
  radius: number;
  altitude: number;
  speed: number;
  phase: number;
  wobble: number;
  localPosition: LocalPlanetPoint;
  nearestObstacleClearance: number;
};

type MountainBird = {
  root: THREE.Group;
  flock: THREE.Group[];
  anchor: LocalPlanetPoint;
  radius: number;
  altitude: number;
  speed: number;
  phase: number;
  fleeAmount: number;
  fleeTimer: number;
  fleeDirection: LocalPlanetPoint;
  fleeOffset: LocalPlanetPoint;
  fleeVelocity: LocalPlanetPoint;
  localPosition: LocalPlanetPoint;
  heading: number;
  roll: number;
  lastUpdateElapsed: number | null;
  lastFrameDisplacement: number;
  recentMaxFrameDisplacement: number;
  terrainClearance: number;
  anchorHeight: number;
  anchorSuitability: number;
};

export type BirdDebugState = {
  total: number;
  visible: number;
  fleeing: number;
  nearestTerrainClearance: number;
  minAnchorHeight: number;
  minAnchorSuitability: number;
  nearestAnchor: LocalPlanetPoint;
  distantAnchor: LocalPlanetPoint;
  nearestPosition: LocalPlanetPoint;
  maxFrameDisplacement: number;
};

const creatureSpecs = [
  { x: 6.6, z: 11.2, angle: -1.05, phase: 0.2, interval: 2.35, hopDistance: 1.05, scale: 1.12 },
  { x: 2.1, z: 5.9, angle: 0.74, phase: 1.25, interval: 2.8, hopDistance: 0.82 },
  { x: -15.3, z: -4.5, angle: 2.48, phase: 0.92, interval: 3.05, hopDistance: 0.78 },
  { x: 20.5, z: -12.6, angle: -2.2, phase: 1.68, interval: 2.55, hopDistance: 0.92 },
  { x: -5.2, z: 8.7, angle: -0.2, phase: 0.55, interval: 2.15, hopDistance: 0.68 },
];

const beetleSpecs = [
  { x: 4.8, z: 8.4, radius: 2.1, altitude: 2.9, speed: 0.42, phase: 0.1, wobble: 0.78, scale: 0.92 },
  { x: -18, z: 13, radius: 2.8, altitude: 3.4, speed: 0.34, phase: 2.6, wobble: 1.2 },
  { x: 29, z: -15, radius: 2.3, altitude: 2.7, speed: 0.38, phase: 4.1, wobble: 0.64 },
  { x: 263, z: -237, radius: 3.4, altitude: 4.2, speed: 0.26, phase: 1.4, wobble: 1.45, scale: 1.08 },
  { x: 315, z: -266, radius: 2.5, altitude: 3.2, speed: 0.32, phase: 3.8, wobble: 0.96 },
  { x: -174, z: 126, radius: 3.2, altitude: 3.8, speed: 0.3, phase: 5.2, wobble: 1.08 },
  { x: 438, z: 92, radius: 2.9, altitude: 3.6, speed: 0.28, phase: 2.1, wobble: 1.32 },
  { x: -396, z: -312, radius: 3.6, altitude: 4.1, speed: 0.24, phase: 0.7, wobble: 0.86 },
];

const mountainBirdSearchPoints = [
  { x: 0, z: -76 },
  { x: -16, z: -76 },
  { x: 16, z: -78 },
  { x: 24, z: -78 },
  { x: -32, z: -78 },
  { x: 42, z: -74 },
  { x: -52, z: -74 },
  { x: 78, z: -54 },
  { x: -78, z: -42 },
  { x: 52, z: -68 },
  { x: -56, z: -70 },
];

const birdVisibilityDistance = 360;
const birdScareDistance = 34;
const birdFleeMaxSpeed = 8.4;
const birdFleeMaxAcceleration = 7.2;
const birdFleeDamping = 1.35;
const distributedBirdCellRadiusX = 18;
const distributedBirdCellRadiusZ = 8;
const maxDistributedBirdFlocks = 56;

export function createAlienWaterCreatures(
  scene: THREE.Scene,
  heightAt: HeightSampler
): { creatureGroup: THREE.Group; update: (elapsed: number) => void } {
  const creatureGroup = new THREE.Group();
  scene.add(creatureGroup);

  const creatures = creatureSpecs.map((spec, index) => {
    const anchor = new THREE.Vector3(spec.x, 0, spec.z);
    const route = makePatrolRoute(spec.angle, spec.hopDistance, index);
    const root = makeCreature(index);
    root.scale.multiplyScalar(spec.scale ?? 1);
    placeObjectOnPlanet(root, spec.x, spec.z, heightAt(spec.x, spec.z) + 0.08, new THREE.Euler(0, -spec.angle + Math.PI * 0.5, 0));
    creatureGroup.add(root);

    return {
      root,
      body: root.userData.body as THREE.Mesh,
      eyes: root.userData.eyes as THREE.Group,
      feet: root.userData.feet as THREE.Mesh[],
      anchor,
      route,
      phase: spec.phase,
      interval: spec.interval,
    } satisfies Creature;
  });

  return {
    creatureGroup,
    update: (elapsed) => {
      creatures.forEach((creature, index) => {
        const rawCycle = (elapsed + creature.phase) / creature.interval;
        const hopIndex = Math.floor(rawCycle);
        const cycle = rawCycle - hopIndex;
        const hopActive = cycle < 0.42;
        const hopT = hopActive ? THREE.MathUtils.smoothstep(cycle / 0.42, 0, 1) : 0;
        const start = creature.route[hopIndex % creature.route.length];
        const end = creature.route[(hopIndex + 1) % creature.route.length];
        const local = new THREE.Vector3().lerpVectors(start, end, hopActive ? hopT : 1);
        const x = creature.anchor.x + local.x;
        const z = creature.anchor.z + local.z;
        const hopArc = hopActive ? Math.sin(hopT * Math.PI) * 0.62 : 0;
        const idleBob = hopActive ? 0 : Math.sin(elapsed * 3.1 + index) * 0.025;
        const facing = new THREE.Vector3().subVectors(end, start);

        placeObjectOnPlanet(
          creature.root,
          x,
          z,
          heightAt(x, z) + hopArc + idleBob + 0.08,
          new THREE.Euler(0, Math.atan2(facing.x, facing.z), hopActive ? Math.sin(hopT * Math.PI) * 0.12 * Math.sign(facing.x || 1) : 0)
        );
        creature.body.scale.set(1 + hopArc * 0.16, 1 - hopArc * 0.08, 1 + hopArc * 0.1);
        creature.eyes.position.y = 0.34 + hopArc * 0.05;
        creature.feet.forEach((foot, footIndex) => {
          foot.position.z = (footIndex === 0 ? -0.28 : 0.28) - hopArc * 0.12;
          foot.rotation.x = hopActive ? -0.42 + hopArc * 0.25 : -0.42;
        });
      });
    },
  };
}

export function createMountainBirds(
  scene: THREE.Scene,
  heightAt: HeightSampler
): {
  birdGroup: THREE.Group;
  update: (elapsed: number, focus: LocalPlanetPoint) => void;
  getState: () => BirdDebugState;
} {
  const birdGroup = new THREE.Group();
  birdGroup.name = "mountain-birds";
  scene.add(birdGroup);

  const anchors = chooseMountainBirdAnchors(heightAt);
  const birds = anchors.map((anchor, index) => {
    const root = makeBirdFlock(index);
    const scale = 2.85 + (index % 3) * 0.22;
    root.scale.setScalar(scale);
    birdGroup.add(root);

    return {
      root,
      flock: root.userData.flock as THREE.Group[],
      anchor,
      radius: 8.5 + (index % 3) * 2.6,
      altitude: 8.2 + (index % 2) * 2.6,
      speed: 0.13 + index * 0.018,
      phase: index * 1.67,
      fleeAmount: 0,
      fleeTimer: 0,
      fleeDirection: { x: Math.cos(index * 1.7), z: Math.sin(index * 1.7) },
      fleeOffset: { x: 0, z: 0 },
      fleeVelocity: { x: 0, z: 0 },
      localPosition: { ...anchor },
      heading: index * 0.22,
      roll: 0,
      lastUpdateElapsed: null as number | null,
      lastFrameDisplacement: 0,
      recentMaxFrameDisplacement: 0,
      terrainClearance: Number.POSITIVE_INFINITY,
      anchorHeight: heightAt(anchor.x, anchor.z),
      anchorSuitability: mountainBirdSuitabilityAt(anchor.x, anchor.z, heightAt),
    } satisfies MountainBird;
  });

  return {
    birdGroup,
    update: (elapsed, focus) => {
      birds.forEach((bird, index) => {
        const delta = bird.lastUpdateElapsed === null ? 1 / 60 : THREE.MathUtils.clamp(elapsed - bird.lastUpdateElapsed, 0.001, 0.05);
        bird.lastUpdateElapsed = elapsed;
        const anchorDistance = surfaceDistanceBetweenLocal(focus, bird.anchor);
        if (anchorDistance > birdVisibilityDistance) {
          bird.root.visible = false;
          updateBirdFleeState(bird, 0, focus, elapsed, delta, index);
          return;
        }

        bird.root.visible = true;
        const scare = 1 - THREE.MathUtils.smoothstep(anchorDistance, birdScareDistance * 0.45, birdScareDistance);
        updateBirdFleeState(bird, scare, focus, elapsed, delta, index);

        const t = elapsed * bird.speed + bird.phase;
        const orbit = mountainBirdOrbitPosition(bird, t);
        const orbitInfluence = 1 - bird.fleeAmount * 0.86;
        const current = {
          x: bird.anchor.x + (orbit.x - bird.anchor.x) * orbitInfluence + bird.fleeOffset.x,
          z: bird.anchor.z + (orbit.z - bird.anchor.z) * orbitInfluence + bird.fleeOffset.z,
        };
        const nextOrbit = mountainBirdOrbitPosition(bird, t + 0.08);
        const nextOrbitInfluence = 1 - bird.fleeAmount * 0.86;
        const next = {
          x: bird.anchor.x + (nextOrbit.x - bird.anchor.x) * nextOrbitInfluence + bird.fleeOffset.x + bird.fleeVelocity.x * 0.08,
          z: bird.anchor.z + (nextOrbit.z - bird.anchor.z) * nextOrbitInfluence + bird.fleeOffset.z + bird.fleeVelocity.z * 0.08,
        };
        const headingDx = next.x - current.x;
        const headingDz = next.z - current.z;
        const headingMotion = Math.hypot(headingDx, headingDz);
        const targetHeading =
          bird.fleeAmount > 0.18 ? Math.atan2(bird.fleeDirection.x, bird.fleeDirection.z) : headingMotion > 0.035 ? Math.atan2(headingDx, headingDz) : bird.heading;
        bird.heading = moveAngleToward(bird.heading, targetHeading, delta * 0.42);
        bird.roll = THREE.MathUtils.lerp(
          bird.roll,
          Math.sin(t * 0.48 + index) * 0.025 * (1 - bird.fleeAmount),
          1 - Math.exp(-delta * 1.8)
        );
        const speedLift = THREE.MathUtils.clamp(Math.hypot(bird.fleeVelocity.x, bird.fleeVelocity.z) / birdFleeMaxSpeed, 0, 1);
        const altitudeLift = bird.fleeAmount * 5.8 + speedLift * 1.8 + Math.sin(t * 1.1) * 0.55;
        const terrainHeight = heightAt(current.x, current.z);
        const altitude = terrainHeight + bird.altitude + altitudeLift;

        bird.lastFrameDisplacement = surfaceDistanceBetweenLocal(bird.localPosition, current);
        bird.recentMaxFrameDisplacement = Math.max(bird.recentMaxFrameDisplacement * Math.exp(-delta * 1.7), bird.lastFrameDisplacement);
        bird.localPosition = current;
        bird.terrainClearance = altitude - terrainHeight;

        placeObjectOnPlanet(
          bird.root,
          current.x,
          current.z,
          altitude,
          new THREE.Euler(-0.025 - bird.fleeAmount * 0.035, bird.heading, bird.roll)
        );

        bird.flock.forEach((mesh, birdIndex) => {
          const basePosition = mesh.userData.basePosition as THREE.Vector3;
          const smoothedOffset = mesh.userData.smoothedOffset as THREE.Vector3;
          const reactionDelay = mesh.userData.reactionDelay as number;
          const wingPhase = mesh.userData.wingPhase as number;
          const wingSpeed = mesh.userData.wingSpeed as number;
          const localFlee = THREE.MathUtils.clamp((bird.fleeAmount - reactionDelay) / 0.72, 0, 1);
          const localTarget = new THREE.Vector3(
            Math.sin(birdIndex * 1.9 + index) * localFlee * 0.28,
            Math.sin(elapsed * 2.3 + birdIndex + index) * 0.055 + localFlee * (0.08 + (birdIndex % 3) * 0.025),
            Math.cos(birdIndex * 1.4 + index) * localFlee * 0.22
          );
          smoothedOffset.lerp(localTarget, 1 - Math.exp(-delta * (2.4 + birdIndex * 0.16)));
          const wingBeat = Math.sin(elapsed * wingSpeed + wingPhase) * (0.075 + bird.fleeAmount * 0.1);
          mesh.rotation.z = (birdIndex - 2) * 0.07 + wingBeat;
          mesh.position.copy(basePosition).add(smoothedOffset);
        });
      });
    },
    getState: () => {
      const visibleBirds = birds.filter((bird) => bird.root.visible);
      const nearest = visibleBirds[0]?.anchor ?? birds[0]?.anchor ?? { x: 0, z: 0 };
      const distant = birds.find((bird) => surfaceDistanceBetweenLocal(bird.anchor, nearest) > 720)?.anchor ?? nearest;

      return {
        total: birds.length,
        visible: visibleBirds.length,
        fleeing: birds.filter((bird) => bird.fleeAmount > 0.35).length,
        nearestTerrainClearance: visibleBirds.reduce((nearestClearance, bird) => Math.min(nearestClearance, bird.terrainClearance), Number.POSITIVE_INFINITY),
        minAnchorHeight: birds.reduce((minHeight, bird) => Math.min(minHeight, bird.anchorHeight), Number.POSITIVE_INFINITY),
        minAnchorSuitability: birds.reduce((minSuitability, bird) => Math.min(minSuitability, bird.anchorSuitability), Number.POSITIVE_INFINITY),
        nearestAnchor: nearest,
        distantAnchor: distant,
        nearestPosition: visibleBirds[0]?.localPosition ?? birds[0]?.localPosition ?? { x: 0, z: 0 },
        maxFrameDisplacement: visibleBirds.reduce((maxDisplacement, bird) => Math.max(maxDisplacement, bird.recentMaxFrameDisplacement), 0),
      };
    },
  };
}

export function createRareFlyingBeetles(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  obstacles: SolidObstacle[] = []
): {
  beetleGroup: THREE.Group;
  update: (elapsed: number, focus: LocalPlanetPoint) => void;
  getState: () => { total: number; visible: number; nearestObstacleClearance: number };
} {
  const beetleGroup = new THREE.Group();
  beetleGroup.name = "rare-flying-beetles";
  scene.add(beetleGroup);

  const beetles = beetleSpecs.map((spec, index) => {
    const root = makeBeetle(index);
    root.scale.multiplyScalar(spec.scale ?? 1);
    beetleGroup.add(root);

    return {
      root,
      wings: root.userData.wings as THREE.Mesh[],
      anchor: { x: spec.x, z: spec.z },
      radius: spec.radius,
      altitude: spec.altitude,
      speed: spec.speed,
      phase: spec.phase,
      wobble: spec.wobble,
      localPosition: { x: spec.x, z: spec.z },
      nearestObstacleClearance: Number.POSITIVE_INFINITY,
    } satisfies Beetle;
  });

  return {
    beetleGroup,
    update: (elapsed, focus) => {
      beetles.forEach((beetle, index) => {
        const distanceToFocus = surfaceDistanceBetweenLocal(focus, beetle.anchor);
        if (distanceToFocus > 240) {
          beetle.root.visible = false;
          return;
        }

        beetle.root.visible = true;
        const t = elapsed * beetle.speed + beetle.phase;
        const nextT = t + 0.08;
        const current = steerBeetleAroundObstacles(beetlePosition(beetle, t), obstacles, t + beetle.wobble);
        const next = steerBeetleAroundObstacles(beetlePosition(beetle, nextT), obstacles, nextT + beetle.wobble);
        const heading = Math.atan2(next.x - current.x, next.z - current.z);
        const wingBeat = Math.sin(elapsed * 24 + index * 0.8);
        const roll = Math.sin(t * 1.7 + beetle.wobble) * 0.22;
        const bob = Math.sin(t * 2.4 + beetle.wobble) * 0.28;
        beetle.localPosition = current;
        beetle.nearestObstacleClearance = current.nearestObstacleClearance;

        placeObjectOnPlanet(
          beetle.root,
          current.x,
          current.z,
          heightAt(current.x, current.z) + beetle.altitude + bob + current.altitudeLift,
          new THREE.Euler(Math.sin(t * 1.3) * 0.08, heading, roll)
        );
        beetle.wings.forEach((wing, wingIndex) => {
          wing.rotation.z = (wingIndex === 0 ? 0.82 : -0.82) + wingBeat * (wingIndex === 0 ? 0.42 : -0.42);
        });
      });
    },
    getState: () => ({
      total: beetles.length,
      visible: beetles.filter((beetle) => beetle.root.visible).length,
      nearestObstacleClearance: beetles.reduce(
        (nearest, beetle) => (beetle.root.visible ? Math.min(nearest, beetle.nearestObstacleClearance) : nearest),
        Number.POSITIVE_INFINITY
      ),
    }),
  };
}

function chooseMountainBirdAnchors(heightAt: HeightSampler): LocalPlanetPoint[] {
  const localAnchors = rankedMountainBirdCandidates(heightAt, 0, 0, 0)
    .slice(0, 5)
    .map(({ x, z }) => ({ x, z }));
  const distributedAnchors = chooseDistributedMountainBirdAnchors(heightAt, localAnchors);
  return [...localAnchors, ...distributedAnchors];
}

function rankedMountainBirdCandidates(
  heightAt: HeightSampler,
  offsetX: number,
  offsetZ: number,
  seedOffset: number
): (LocalPlanetPoint & { height: number; suitability: number; sort: number })[] {
  return mountainBirdSearchPoints
    .map((point, index) => {
      const best = bestMountainCandidateNear(point.x + offsetX, point.z + offsetZ, heightAt, seedOffset + index);
      return {
        ...best,
        sort: best.suitability * 100 + best.height,
      };
    })
    .filter((candidate) => candidate.suitability >= 0.62 && candidate.height >= 13.4)
    .sort((a, b) => b.sort - a.sort);
}

function chooseDistributedMountainBirdAnchors(heightAt: HeightSampler, localAnchors: LocalPlanetPoint[]): LocalPlanetPoint[] {
  const candidates: (LocalPlanetPoint & { height: number; suitability: number; sort: number; cellDistance: number })[] = [];
  for (let cellZ = -distributedBirdCellRadiusZ; cellZ <= distributedBirdCellRadiusZ; cellZ += 1) {
    for (let cellX = -distributedBirdCellRadiusX; cellX <= distributedBirdCellRadiusX; cellX += 1) {
      if (cellX === 0 && cellZ === 0) continue;
      if (!shouldPlaceDistributedBirdCell(cellX, cellZ)) continue;

      const offsetX = cellX * PLANET_DETAIL_PERIOD;
      const offsetZ = cellZ * PLANET_DETAIL_PERIOD;
      const best = rankedMountainBirdCandidates(heightAt, offsetX, offsetZ, cellX * 37 + cellZ * 101)[0];
      if (!best) continue;
      const normalized = normalizePlanetCoords(best.x, best.z);
      const tooClose = [...localAnchors, ...candidates].some((anchor) => surfaceDistanceBetweenLocal(anchor, normalized) < birdVisibilityDistance * 1.1);
      if (tooClose) continue;

      const cellDistance = Math.hypot(cellX, cellZ);
      candidates.push({
        ...normalized,
        height: best.height,
        suitability: best.suitability,
        sort: best.sort - cellDistance * 0.18 + distributedBirdHash(cellX, cellZ) * 4.5,
        cellDistance,
      });
    }
  }

  return candidates
    .sort((a, b) => b.sort - a.sort)
    .slice(0, maxDistributedBirdFlocks)
    .map(({ x, z }) => ({ x, z }));
}

function shouldPlaceDistributedBirdCell(cellX: number, cellZ: number): boolean {
  const distance = Math.hypot(cellX, cellZ);
  if (distance < 1.6) return false;
  const threshold = distance < 5 ? 0.34 : distance < 11 ? 0.24 : 0.18;
  return distributedBirdHash(cellX, cellZ) < threshold;
}

function distributedBirdHash(cellX: number, cellZ: number): number {
  const value = Math.sin(cellX * 127.1 + cellZ * 311.7 + 41.9) * 43758.5453123;
  return value - Math.floor(value);
}

function bestMountainCandidateNear(
  centerX: number,
  centerZ: number,
  heightAt: HeightSampler,
  seed: number
): LocalPlanetPoint & { height: number; suitability: number } {
  let best = { x: centerX, z: centerZ, height: heightAt(centerX, centerZ), suitability: mountainBirdSuitabilityAt(centerX, centerZ, heightAt) };
  for (let ring = 0; ring < 4; ring += 1) {
    const radius = 5 + ring * 7;
    for (let step = 0; step < 9; step += 1) {
      const angle = seed * 1.37 + ring * 0.73 + step * ((Math.PI * 2) / 9);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      const height = heightAt(x, z);
      const suitability = mountainBirdSuitabilityAt(x, z, heightAt);
      if (suitability * 100 + height > best.suitability * 100 + best.height) {
        best = { x, z, height, suitability };
      }
    }
  }
  return best;
}

function mountainBirdSuitabilityAt(x: number, z: number, heightAt: HeightSampler): number {
  const detail = detailCoordinatesAt(x, z);
  const height = heightAt(x, z);
  const sampleDistance = 7;
  const neighbours = [
    heightAt(x + sampleDistance, z),
    heightAt(x - sampleDistance, z),
    heightAt(x, z + sampleDistance),
    heightAt(x, z - sampleDistance),
  ];
  const relief = Math.max(...neighbours.map((neighbour) => Math.abs(height - neighbour)));
  const northRidge = Math.max(0, 1 - Math.abs(detail.z + 72) / 38) * (1 - Math.min(Math.abs(detail.x) / 126, 1));
  const sideMass =
    radialMass(detail.x, detail.z, -78, -42, 30, 34) +
    radialMass(detail.x, detail.z, 82, -54, 32, 38) +
    radialMass(detail.x, detail.z, 74, 34, 30, 32);
  const mountainProfile = THREE.MathUtils.clamp(Math.max(northRidge, sideMass), 0, 1);
  const highEnough = THREE.MathUtils.smoothstep(height, 7.5, 17);
  const reliefScore = THREE.MathUtils.smoothstep(relief, 0.8, 4.2);
  return THREE.MathUtils.clamp(highEnough * 0.58 + reliefScore * 0.16 + mountainProfile * 0.46, 0, 1);
}

function radialMass(x: number, z: number, centerX: number, centerZ: number, radiusX: number, radiusZ: number): number {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  return Math.max(0, 1 - dx * dx - dz * dz);
}

function mountainBirdOrbitPosition(bird: MountainBird, t: number): LocalPlanetPoint {
  return {
    x: bird.anchor.x + Math.sin(t) * bird.radius + Math.sin(t * 0.57 + bird.phase) * bird.radius * 0.42,
    z: bird.anchor.z + Math.cos(t * 0.82) * bird.radius * 0.72 + Math.sin(t * 1.31 + bird.phase) * bird.radius * 0.24,
  };
}

function updateBirdFleeState(
  bird: MountainBird,
  scare: number,
  focus: LocalPlanetPoint,
  elapsed: number,
  delta: number,
  index: number
): void {
  const scareActive = scare > 0.18;
  if (scareActive && bird.fleeTimer <= 0.08 + index * 0.025) {
    const direction = escapeDirectionFromFocus(bird.localPosition, focus, elapsed, index);
    const blend = bird.fleeTimer > 0 ? 0.28 : 1;
    bird.fleeDirection = normalizeLocalDirection({
      x: THREE.MathUtils.lerp(bird.fleeDirection.x, direction.x, blend),
      z: THREE.MathUtils.lerp(bird.fleeDirection.z, direction.z, blend),
    });
    bird.fleeTimer = Math.max(bird.fleeTimer, 1.65 + (index % 3) * 0.28 + scare * 0.5);
  }

  bird.fleeTimer = Math.max(0, bird.fleeTimer - delta);
  const targetFleeAmount = bird.fleeTimer > 0 ? Math.max(scare, 0.42) : 0;
  const fleeRate = targetFleeAmount > bird.fleeAmount ? 1.65 : 0.52;
  bird.fleeAmount = THREE.MathUtils.lerp(bird.fleeAmount, targetFleeAmount, 1 - Math.exp(-delta * fleeRate));

  const timerBoost = THREE.MathUtils.smoothstep(bird.fleeTimer, 0, 0.9);
  const sideSlip = 0;
  const desiredSpeed = birdFleeMaxSpeed * bird.fleeAmount * (0.66 + (index % 4) * 0.055) * timerBoost;
  const targetVelocity = {
    x: (bird.fleeDirection.x - bird.fleeDirection.z * sideSlip) * desiredSpeed,
    z: (bird.fleeDirection.z + bird.fleeDirection.x * sideSlip) * desiredSpeed,
  };

  bird.fleeVelocity = moveLocalVectorToward(bird.fleeVelocity, targetVelocity, birdFleeMaxAcceleration * delta);
  bird.fleeVelocity.x *= Math.exp(-delta * birdFleeDamping * (bird.fleeTimer > 0 ? 0.2 : 1));
  bird.fleeVelocity.z *= Math.exp(-delta * birdFleeDamping * (bird.fleeTimer > 0 ? 0.2 : 1));

  bird.fleeOffset.x += bird.fleeVelocity.x * delta;
  bird.fleeOffset.z += bird.fleeVelocity.z * delta;

  const returnDamping = bird.fleeTimer > 0 ? 0.08 : 0.62;
  bird.fleeOffset.x *= Math.exp(-delta * returnDamping);
  bird.fleeOffset.z *= Math.exp(-delta * returnDamping);
}

function moveAngleToward(current: number, target: number, maxDelta: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function escapeDirectionFromFocus(point: LocalPlanetPoint, focus: LocalPlanetPoint, elapsed: number, index: number): LocalPlanetPoint {
  const dx = point.x - focus.x;
  const dz = point.z - focus.z;
  const length = Math.hypot(dx, dz);
  const fallbackAngle = index * 1.91;
  const awayX = length > 0.001 ? dx / length : Math.cos(fallbackAngle);
  const awayZ = length > 0.001 ? dz / length : Math.sin(fallbackAngle);
  const variation = (index - 2) * 0.045;
  return normalizeLocalDirection({
    x: awayX - awayZ * variation,
    z: awayZ + awayX * variation,
  });
}

function normalizeLocalDirection(direction: LocalPlanetPoint): LocalPlanetPoint {
  const length = Math.hypot(direction.x, direction.z);
  if (length <= 0.0001) return { x: 1, z: 0 };
  return {
    x: direction.x / length,
    z: direction.z / length,
  };
}

function moveLocalVectorToward(current: LocalPlanetPoint, target: LocalPlanetPoint, maxDelta: number): LocalPlanetPoint {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= maxDelta || distance <= 0.0001) return { ...target };
  const scale = maxDelta / distance;
  return {
    x: current.x + dx * scale,
    z: current.z + dz * scale,
  };
}

function makeBirdFlock(seed: number): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: seed % 2 === 0 ? 0xfff6bf : 0xff75c8,
    side: THREE.DoubleSide,
  });
  const offsets = [
    { x: -2.1, z: 0.5, scale: 0.82 },
    { x: -0.9, z: -0.25, scale: 0.72 },
    { x: 0.2, z: 0.15, scale: 0.94 },
    { x: 1.45, z: -0.42, scale: 0.68 },
    { x: 2.35, z: 0.38, scale: 0.78 },
  ];
  const flock = offsets.map((offset, index) => {
    const bird = makeChunkyBirdSilhouette(material);
    bird.position.set(offset.x, (index % 2) * 0.18, offset.z);
    bird.rotation.y = (index - 2) * 0.08;
    bird.scale.setScalar(offset.scale);
    bird.userData.basePosition = bird.position.clone();
    bird.userData.smoothedOffset = new THREE.Vector3();
    bird.userData.reactionDelay = 0.04 + ((seed + index) % 4) * 0.08;
    bird.userData.wingPhase = seed * 0.91 + index * 1.37;
    bird.userData.wingSpeed = 5.2 + ((seed + index) % 5) * 0.46;
    root.add(bird);
    return bird;
  });

  root.userData = { flock };
  return root;
}

function makeChunkyBirdSilhouette(material: THREE.Material): THREE.Group {
  const bird = new THREE.Group();
  addWingStroke(bird, material, -0.46, 0.04, 0.24, 0.72);
  addWingStroke(bird, material, -1.02, 0.18, 0.42, 0.52);
  addWingStroke(bird, material, 0.46, 0.04, -0.24, 0.72);
  addWingStroke(bird, material, 1.02, 0.18, -0.42, 0.52);

  const cross = bird.clone();
  cross.rotation.y = Math.PI * 0.5;
  bird.add(cross);
  return bird;
}

function addWingStroke(group: THREE.Group, material: THREE.Material, x: number, y: number, angle: number, length: number): void {
  const stroke = new THREE.Mesh(new THREE.BoxGeometry(length, 0.13, 0.08), material);
  stroke.position.set(x, y, 0);
  stroke.rotation.z = angle;
  group.add(stroke);
}

function makePatrolRoute(angle: number, hopDistance: number, seed: number): THREE.Vector3[] {
  const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-forward.z, 0, forward.x);
  const tight = hopDistance * 0.55;
  const wide = hopDistance * (0.92 + (seed % 2) * 0.22);
  return [
    forward.clone().multiplyScalar(-tight).add(side.clone().multiplyScalar(-0.18)),
    forward.clone().multiplyScalar(wide).add(side.clone().multiplyScalar(0.2)),
    forward.clone().multiplyScalar(wide * 0.45).add(side.clone().multiplyScalar(0.82)),
    forward.clone().multiplyScalar(-wide * 0.72).add(side.clone().multiplyScalar(0.52)),
    forward.clone().multiplyScalar(-tight * 0.35).add(side.clone().multiplyScalar(-0.42)),
  ];
}

function makeCreature(seed: number): THREE.Group {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x6cffbc : 0x7de7ff });
  const bellyMaterial = new THREE.MeshBasicMaterial({ color: 0xff7bd4 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x24145f });
  const crestMaterial = new THREE.MeshBasicMaterial({ color: 0xffe45b });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), bodyMaterial);
  body.scale.set(1.18, 0.58, 0.92);
  body.position.y = 0.28;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 5), bodyMaterial);
  head.position.set(0, 0.33, 0.3);
  head.scale.set(1.08, 0.72, 0.78);
  root.add(head);

  const belly = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), bellyMaterial);
  belly.position.set(0, 0.25, 0.49);
  belly.rotation.x = -0.42;
  belly.scale.set(1.2, 0.58, 1);
  root.add(belly);

  const eyes = new THREE.Group();
  [-0.16, 0.16].forEach((x) => {
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), bodyMaterial);
    brow.position.set(x, 0.48, 0.24);
    brow.scale.set(1, 0.72, 0.82);
    eyes.add(brow);

    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), eyeMaterial);
    eye.position.set(x, 0.51, 0.31);
    eye.scale.set(0.82, 1.12, 0.58);
    eyes.add(eye);
  });
  root.add(eyes);

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), crestMaterial);
  crest.position.set(0, 0.52, -0.04);
  crest.rotation.x = -0.55;
  root.add(crest);

  const feet = [-0.24, 0.24].map((x) => {
    const foot = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16, 0), bellyMaterial);
    foot.position.set(x, 0.08, 0.3);
    foot.rotation.set(-0.42, 0, x > 0 ? -0.2 : 0.2);
    foot.scale.set(1.25, 0.36, 0.8);
    root.add(foot);
    return foot;
  });

  root.userData = { body, eyes, feet };
  root.scale.setScalar(0.78);
  return root;
}

function beetlePosition(beetle: Beetle, t: number): LocalPlanetPoint {
  return {
    x: beetle.anchor.x + Math.sin(t) * beetle.radius + Math.sin(t * 2.3 + beetle.wobble) * beetle.radius * 0.28,
    z: beetle.anchor.z + Math.cos(t * 0.86 + beetle.wobble) * beetle.radius * 0.72 + Math.sin(t * 1.7) * beetle.radius * 0.18,
  };
}

function steerBeetleAroundObstacles(
  point: LocalPlanetPoint,
  obstacles: SolidObstacle[],
  fallbackAngle: number
): LocalPlanetPoint & { altitudeLift: number; nearestObstacleClearance: number } {
  let pushX = 0;
  let pushZ = 0;
  let altitudeLift = 0;
  let nearestObstacleClearance = Number.POSITIVE_INFINITY;

  obstacles.forEach((obstacle) => {
    const dx = point.x - obstacle.x;
    const dz = point.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const clearance = distance - obstacle.radius;
    nearestObstacleClearance = Math.min(nearestObstacleClearance, clearance);
    const avoidRadius = obstacle.radius + 2.35;
    if (distance >= avoidRadius) return;

    const fallbackX = Math.cos(fallbackAngle);
    const fallbackZ = Math.sin(fallbackAngle);
    const awayX = distance > 0.001 ? dx / distance : fallbackX;
    const awayZ = distance > 0.001 ? dz / distance : fallbackZ;
    const strength = 1 - THREE.MathUtils.smoothstep(distance, obstacle.radius + 0.45, avoidRadius);
    pushX += awayX * strength * (avoidRadius - distance) * 0.86;
    pushZ += awayZ * strength * (avoidRadius - distance) * 0.86;
    altitudeLift = Math.max(altitudeLift, strength * 0.95);
  });

  const steered = {
    x: point.x + pushX,
    z: point.z + pushZ,
  };

  if (pushX !== 0 || pushZ !== 0) {
    nearestObstacleClearance = obstacles.reduce((nearest, obstacle) => {
      const distance = Math.hypot(steered.x - obstacle.x, steered.z - obstacle.z);
      return Math.min(nearest, distance - obstacle.radius);
    }, Number.POSITIVE_INFINITY);
  }

  return {
    ...steered,
    altitudeLift,
    nearestObstacleClearance,
  };
}

function makeBeetle(seed: number): THREE.Group {
  const root = new THREE.Group();
  const shellMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x142a66 : 0x40216f });
  const bellyMaterial = new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0xffd15e : 0x64ffd4 });
  const wingMaterial = new THREE.MeshBasicMaterial({
    color: seed % 2 === 0 ? 0x98fff1 : 0xff9fe7,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff9c });

  const abdomen = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), shellMaterial);
  abdomen.scale.set(0.84, 0.56, 1.26);
  abdomen.position.z = -0.06;
  root.add(abdomen);

  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), bellyMaterial);
  head.position.set(0, 0.02, 0.18);
  head.scale.set(0.95, 0.72, 0.82);
  root.add(head);

  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.18, 5), wingMaterial);
    wing.position.set(side * 0.12, 0.03, -0.02);
    wing.rotation.set(Math.PI * 0.5, 0, side * 0.82);
    wing.scale.set(0.7, 1.32, 1);
    root.add(wing);
    return wing;
  });

  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), eyeMaterial);
    eye.position.set(x, 0.07, 0.275);
    root.add(eye);
  });

  for (let i = 0; i < 3; i += 1) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.16), bellyMaterial);
      leg.position.set(side * 0.15, -0.07, -0.12 + i * 0.11);
      leg.rotation.set(0.15, side * 0.38, side * 0.46);
      root.add(leg);
    });
  }

  root.userData = { wings };
  root.scale.setScalar(0.86);
  return root;
}
