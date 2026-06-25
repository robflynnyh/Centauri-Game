import * as THREE from "three";
import {
  normalizePlanetCoords,
  placeObjectOnPlanet,
  surfaceDistanceBetweenLocal,
  type LocalPlanetPoint,
} from "./planet";

type HeightSampler = (x: number, z: number) => number;

export type ParamotorPlacementState = {
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  approachX: number;
  approachZ: number;
  takeoffYaw: number;
  hillHeight: number;
  hillSlope: number;
  distanceFromSpawn: number;
};

export type ParamotorDevice = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  homePosition: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  reservedZone: LocalPlanetPoint & { radius: number };
  interactionRadius: number;
  maxAltitude: number;
  takeoffYaw: number;
  parkAt: (position: LocalPlanetPoint, yaw: number) => void;
  update: (
    elapsed: number,
    input:
      | { mounted: false }
      | { mounted: true; position: LocalPlanetPoint; baseAltitude: number; yaw: number; throttle: number }
  ) => void;
  getPlacementState: () => ParamotorPlacementState;
};

const paramotorSeed = "centauri-rob-296-single-paramotor";
const startPosition = { x: 0, z: 24 };
const interactionRadius = 8.6;
const reservedRadius = 18;
const maxAltitude = 135;

export function createParamotorDevice(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }> = []
): ParamotorDevice {
  const placement = chooseParamotorPlacement(heightAt, avoidZones);
  const group = makeParamotorModel();
  scene.add(group);

  let parkedYaw = placement.takeoffYaw;

  const updateParkedPose = (elapsed: number): void => {
    placeObjectOnPlanet(
      group,
      placement.position.x,
      placement.position.z,
      heightAt(placement.position.x, placement.position.z) + 0.08,
      new THREE.Euler(0, parkedYaw, subtleGroundRock(elapsed))
    );
    updatePropeller(group, elapsed, 0);
  };

  const device: ParamotorDevice = {
    group,
    position: placement.position,
    homePosition: { ...placement.homePosition },
    approachPosition: placement.approachPosition,
    reservedZone: { x: placement.homePosition.x, z: placement.homePosition.z, radius: reservedRadius },
    interactionRadius,
    maxAltitude,
    takeoffYaw: placement.takeoffYaw,
    parkAt: (position, yaw) => {
      const normalized = normalizePlanetCoords(position.x, position.z);
      placement.position.x = normalized.x;
      placement.position.z = normalized.z;
      parkedYaw = yaw;
    },
    update: (elapsed, input) => {
      if (!input.mounted) {
        updateParkedPose(elapsed);
        return;
      }

      const normalized = normalizePlanetCoords(input.position.x, input.position.z);
      placeObjectOnPlanet(
        group,
        normalized.x,
        normalized.z,
        input.baseAltitude,
        new THREE.Euler(Math.sin(elapsed * 1.9) * 0.015, input.yaw, Math.sin(elapsed * 2.3) * 0.025)
      );
      updatePropeller(group, elapsed, input.throttle);
    },
    getPlacementState: () => ({
      homeX: placement.homePosition.x,
      homeZ: placement.homePosition.z,
      x: placement.position.x,
      z: placement.position.z,
      approachX: placement.approachPosition.x,
      approachZ: placement.approachPosition.z,
      takeoffYaw: parkedYaw,
      hillHeight: placement.hillHeight,
      hillSlope: placement.hillSlope,
      distanceFromSpawn: surfaceDistanceBetweenLocal(startPosition, placement.homePosition),
    }),
  };

  updateParkedPose(0);
  return device;
}

function chooseParamotorPlacement(
  heightAt: HeightSampler,
  avoidZones: Array<LocalPlanetPoint & { radius: number }>
): {
  position: LocalPlanetPoint;
  homePosition: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  takeoffYaw: number;
  hillHeight: number;
  hillSlope: number;
} {
  const random = createSeededRandom(paramotorSeed);
  const spawnHeight = heightAt(startPosition.x, startPosition.z);
  let best:
    | {
        point: LocalPlanetPoint;
        score: number;
        height: number;
        slope: number;
        downhill: LocalPlanetPoint;
      }
    | null = null;

  for (let i = 0; i < 180; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 44 + random() * 72;
    const northBias = i % 3 === 0 ? -26 - random() * 42 : 0;
    const candidate = normalizePlanetCoords(
      startPosition.x + Math.cos(angle) * radius,
      startPosition.z + Math.sin(angle) * radius + northBias
    );
    if (isInAvoidZone(candidate, avoidZones)) continue;

    const height = heightAt(candidate.x, candidate.z);
    const slope = localSlopeAt(candidate.x, candidate.z, heightAt);
    const downhill = downhillDirectionAt(candidate.x, candidate.z, heightAt);
    if (height < spawnHeight + 2.2 || height > spawnHeight + 19) continue;
    if (slope < 0.08 || slope > 0.48) continue;
    if (downhill.x === 0 && downhill.z === 0) continue;
    if (!hasStableFooting(candidate, heightAt)) continue;

    const distance = surfaceDistanceBetweenLocal(startPosition, candidate);
    const distanceScore = Math.abs(distance - 72) / 72;
    const slopeScore = Math.abs(slope - 0.18) / 0.18;
    const heightScore = Math.abs(height - (spawnHeight + 7.2)) / 12;
    const northScore = candidate.z < startPosition.z ? 0 : 0.18;
    const score = distanceScore + slopeScore * 0.65 + heightScore * 0.55 + northScore;
    if (!best || score < best.score) {
      best = { point: candidate, score, height, slope, downhill };
    }
  }

  const fallback = normalizePlanetCoords(74, 34);
  const fallbackDownhill = downhillDirectionAt(fallback.x, fallback.z, heightAt);
  const chosen = best ?? {
    point: fallback,
    height: heightAt(fallback.x, fallback.z),
    slope: localSlopeAt(fallback.x, fallback.z, heightAt),
    downhill: fallbackDownhill.x || fallbackDownhill.z ? fallbackDownhill : { x: -0.28, z: 0.96 },
  };

  const approachPosition = normalizePlanetCoords(
    chosen.point.x + chosen.downhill.x * 6.4,
    chosen.point.z + chosen.downhill.z * 6.4
  );
  const takeoffYaw = yawForHeading(chosen.downhill);

  return {
    position: { ...chosen.point },
    homePosition: { ...chosen.point },
    approachPosition,
    takeoffYaw,
    hillHeight: chosen.height,
    hillSlope: chosen.slope,
  };
}

function isInAvoidZone(point: LocalPlanetPoint, zones: Array<LocalPlanetPoint & { radius: number }>): boolean {
  return zones.some((zone) => surfaceDistanceBetweenLocal(point, zone) < zone.radius + reservedRadius);
}

function hasStableFooting(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const height = heightAt(point.x, point.z);
  const samples = [
    heightAt(point.x + 3.5, point.z),
    heightAt(point.x - 3.5, point.z),
    heightAt(point.x, point.z + 3.5),
    heightAt(point.x, point.z - 3.5),
  ];
  return samples.every((sample) => sample > -0.5 && Math.abs(sample - height) < 4.8);
}

function localSlopeAt(x: number, z: number, heightAt: HeightSampler): number {
  const sampleDistance = 3.2;
  const east = Math.abs(heightAt(x + sampleDistance, z) - heightAt(x - sampleDistance, z)) / (sampleDistance * 2);
  const north = Math.abs(heightAt(x, z + sampleDistance) - heightAt(x, z - sampleDistance)) / (sampleDistance * 2);
  const diagonalA =
    Math.abs(heightAt(x + sampleDistance, z + sampleDistance) - heightAt(x - sampleDistance, z - sampleDistance)) /
    (sampleDistance * Math.SQRT2 * 2);
  const diagonalB =
    Math.abs(heightAt(x + sampleDistance, z - sampleDistance) - heightAt(x - sampleDistance, z + sampleDistance)) /
    (sampleDistance * Math.SQRT2 * 2);
  return Math.max(east, north, diagonalA, diagonalB);
}

function downhillDirectionAt(x: number, z: number, heightAt: HeightSampler): LocalPlanetPoint {
  const sampleDistance = 3.2;
  const gradientX = (heightAt(x + sampleDistance, z) - heightAt(x - sampleDistance, z)) / (sampleDistance * 2);
  const gradientZ = (heightAt(x, z + sampleDistance) - heightAt(x, z - sampleDistance)) / (sampleDistance * 2);
  const length = Math.hypot(gradientX, gradientZ);
  if (length < 0.0001) return { x: 0, z: 0 };
  return { x: -gradientX / length, z: -gradientZ / length };
}

function yawForHeading(heading: LocalPlanetPoint): number {
  return Math.atan2(-heading.x, -heading.z);
}

function makeParamotorModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-hill-paramotor";

  const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x2b2358 });
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x17132c });
  const seatMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a84 });
  const canopyMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x46e1c4 }),
    new THREE.MeshBasicMaterial({ color: 0xf1ec72 }),
    new THREE.MeshBasicMaterial({ color: 0x7d62ff }),
  ];
  const cordMaterial = new THREE.MeshBasicMaterial({ color: 0xd8fbff });
  const fuelMaterial = new THREE.MeshBasicMaterial({ color: 0xffb15e });
  const propMaterial = new THREE.MeshBasicMaterial({ color: 0xeefcff, transparent: true, opacity: 0.72, depthWrite: false });

  const skidLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 2.15), shadowMaterial);
  skidLeft.position.set(-0.72, 0.11, 0.08);
  group.add(skidLeft);

  const skidRight = skidLeft.clone();
  skidRight.position.x = 0.72;
  group.add(skidRight);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.46, 0.88), seatMaterial);
  seat.position.set(0, 0.82, -0.06);
  seat.rotation.x = -0.12;
  group.add(seat);

  const harness = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.12, 0.16), frameMaterial);
  harness.position.set(0, 1.28, 0.35);
  harness.rotation.x = 0.18;
  group.add(harness);

  const fuel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.74, 6), fuelMaterial);
  fuel.position.set(0.78, 0.88, 0.42);
  fuel.rotation.z = 0.08;
  group.add(fuel);

  const propeller = new THREE.Group();
  propeller.name = "paramotor-propeller";
  propeller.position.set(0, 1.22, 1.05);
  const propRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.045, 5, 22), frameMaterial);
  propeller.add(propRing);
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.13, 0.05), propMaterial);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.24, 0.05), propMaterial.clone());
  propeller.add(bladeA, bladeB);
  group.add(propeller);

  const mastTop = new THREE.Vector3(0, 3.5, -0.18);
  addBar(group, new THREE.Vector3(-0.62, 1.16, 0.2), mastTop, 0.045, frameMaterial);
  addBar(group, new THREE.Vector3(0.62, 1.16, 0.2), mastTop, 0.045, frameMaterial);
  addBar(group, new THREE.Vector3(-0.72, 0.22, -0.82), new THREE.Vector3(-1.86, 3.7, -0.64), 0.025, cordMaterial);
  addBar(group, new THREE.Vector3(0.72, 0.22, -0.82), new THREE.Vector3(1.86, 3.7, -0.64), 0.025, cordMaterial);
  addBar(group, new THREE.Vector3(-0.42, 0.32, 0.76), new THREE.Vector3(-2.3, 3.62, 0.16), 0.022, cordMaterial);
  addBar(group, new THREE.Vector3(0.42, 0.32, 0.76), new THREE.Vector3(2.3, 3.62, 0.16), 0.022, cordMaterial);

  for (let i = 0; i < 7; i += 1) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 1.36), canopyMaterials[i % canopyMaterials.length]);
    panel.position.set((i - 3) * 0.72, 4.08 + Math.cos((i - 3) * 0.45) * 0.16, -0.34);
    panel.rotation.set(0.11, 0, (i - 3) * -0.035);
    group.add(panel);
  }

  const noseFlag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 4), fuelMaterial);
  noseFlag.position.set(0, 2.45, -1.16);
  noseFlag.rotation.x = -Math.PI * 0.5;
  group.add(noseFlag);

  group.userData = { propeller };
  return group;
}

function addBar(group: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) return;

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 5), material);
  bar.position.copy(start).add(end).multiplyScalar(0.5);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  group.add(bar);
}

function updatePropeller(group: THREE.Group, elapsed: number, throttle: number): void {
  const propeller = group.userData.propeller as THREE.Group | undefined;
  if (!propeller) return;
  propeller.rotation.z = elapsed * THREE.MathUtils.lerp(5, 34, throttle);
  propeller.scale.setScalar(1 + throttle * 0.08);
}

function subtleGroundRock(elapsed: number): number {
  return Math.sin(elapsed * 0.72) * 0.012;
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
