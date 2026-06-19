import * as THREE from "three";

type HeightSampler = (x: number, z: number) => number;
type IsBlockedAt = (x: number, z: number) => boolean;

type FootstepMark = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  age: number;
  lifetime: number;
};

const minStepSpacing = 0.48;
const maxStepSpacing = 0.82;
const markLifetime = 5.6;
const maxMarks = 36;
const footSideOffset = 0.34;
const footBackOffset = 0.48;
const terrainLift = 0.055;
const minGroundSpeed = 0.2;
const markOpacity = 0.46;

const pools = [
  { x: 5.5, z: 7.5, radius: 4.8 },
  { x: -18, z: -3, radius: 3.6 },
  { x: 21, z: -15, radius: 3.2 },
];

const streamPoints = [
  new THREE.Vector2(-12, 7),
  new THREE.Vector2(-6, 8),
  new THREE.Vector2(0, 6),
  new THREE.Vector2(5.5, 7.5),
  new THREE.Vector2(11, 4),
];

export function createFootstepTrail(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  isBlockedAt: IsBlockedAt
): { walk: (position: THREE.Vector3, delta: number) => void; update: (delta: number) => void } {
  const group = new THREE.Group();
  group.name = "fading-footsteps";
  group.renderOrder = 2;
  scene.add(group);

  const marks: FootstepMark[] = [];
  const previousPosition = new THREE.Vector3();
  const travelRemainder = { value: 0 };
  let previousPositionSet = false;
  let nextFootSide = -1;
  let randomSeed = 254;
  let nextStepDistance = nextSpacing();

  const removeOldestMark = (): void => {
    const oldest = marks.shift();
    if (!oldest) return;
    group.remove(oldest.mesh);
    oldest.mesh.geometry.dispose();
    oldest.mesh.material.dispose();
  };

  const addMark = (x: number, z: number, direction: THREE.Vector3): void => {
    if (isBlockedAt(x, z) || isNearWater(x, z)) return;

    const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const sideJitter = (nextRandom() - 0.5) * 0.16;
    const backJitter = (nextRandom() - 0.5) * 0.22;
    const footX = x + side.x * (footSideOffset * nextFootSide + sideJitter) - direction.x * (footBackOffset + backJitter);
    const footZ = z + side.z * (footSideOffset * nextFootSide + sideJitter) - direction.z * (footBackOffset + backJitter);

    if (isBlockedAt(footX, footZ) || isNearWater(footX, footZ)) return;

    const radius = 0.22 + nextRandom() * 0.06;
    const geometry = makeGroundColourGeometry(heightAt, footX, footZ, radius);
    const material = new THREE.MeshBasicMaterial({
      color: nextFootSide < 0 ? 0x241151 : 0x321869,
      transparent: true,
      opacity: markOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    const mark = new THREE.Mesh(geometry, material);
    mark.renderOrder = 2;
    group.add(mark);

    marks.push({ mesh: mark, age: 0, lifetime: markLifetime });
    nextFootSide *= -1;

    while (marks.length > maxMarks) removeOldestMark();
  };

  return {
    walk: (position, delta) => {
      if (!previousPositionSet) {
        previousPosition.copy(position);
        previousPositionSet = true;
      }

      const movement = new THREE.Vector3(position.x - previousPosition.x, 0, position.z - previousPosition.z);
      const distance = movement.length();
      const direction = distance > 0 ? movement.clone().multiplyScalar(1 / distance) : movement;

      if (distance / Math.max(delta, 0.001) > minGroundSpeed) {
        travelRemainder.value += distance;
        while (travelRemainder.value >= nextStepDistance) {
          travelRemainder.value -= nextStepDistance;
          addMark(position.x, position.z, direction);
          nextStepDistance = nextSpacing();
        }
      } else {
        travelRemainder.value = Math.min(travelRemainder.value, minStepSpacing * 0.5);
      }

      previousPosition.copy(position);
    },

    update: (delta) => {
      for (let i = marks.length - 1; i >= 0; i -= 1) {
        const mark = marks[i];
        mark.age += delta;
        const fade = 1 - THREE.MathUtils.smoothstep(mark.age / mark.lifetime, 0.08, 1);
        mark.mesh.material.opacity = markOpacity * fade;

        if (mark.age >= mark.lifetime) {
          group.remove(mark.mesh);
          mark.mesh.geometry.dispose();
          mark.mesh.material.dispose();
          marks.splice(i, 1);
        }
      }
    },
  };

  function nextRandom(): number {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 0xffffffff;
  }

  function nextSpacing(): number {
    return minStepSpacing + nextRandom() * (maxStepSpacing - minStepSpacing);
  }
}

function makeGroundColourGeometry(
  heightAt: HeightSampler,
  centerX: number,
  centerZ: number,
  radius: number
): THREE.BufferGeometry {
  const segments = 14;
  const ringScales = [0, 0.52, 1];
  const positions: number[] = [centerX, heightAt(centerX, centerZ) + terrainLift, centerZ];
  const indices: number[] = [];

  ringScales.slice(1).forEach((ringScale, ringIndex) => {
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = 0.94 + Math.sin(i * 1.93 + ringIndex * 0.71 + centerX * 0.08 + centerZ * 0.1) * 0.045;
      const ringRadius = radius * ringScale * wobble;
      const worldX = centerX + Math.cos(angle) * ringRadius;
      const worldZ = centerZ + Math.sin(angle) * ringRadius;
      positions.push(worldX, heightAt(worldX, worldZ) + terrainLift, worldZ);
    }
  });

  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const inner = 1 + i;
    const nextInner = 1 + next;
    const outer = 1 + segments + i;
    const nextOuter = 1 + segments + next;
    indices.push(0, inner, nextInner, inner, outer, nextInner, nextInner, outer, nextOuter);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function isNearWater(x: number, z: number): boolean {
  if (pools.some((pool) => squaredDistance(x, z, pool.x, pool.z) < pool.radius * pool.radius)) return true;

  return streamPoints.some((point, index) => {
    const next = streamPoints[index + 1];
    return next ? distanceToSegmentSquared(x, z, point, next) < 0.55 * 0.55 : false;
  });
}

function squaredDistance(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function distanceToSegmentSquared(x: number, z: number, start: THREE.Vector2, end: THREE.Vector2): number {
  const segmentX = end.x - start.x;
  const segmentZ = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(((x - start.x) * segmentX + (z - start.y) * segmentZ) / lengthSquared, 0, 1);
  return squaredDistance(x, z, start.x + segmentX * t, start.y + segmentZ * t);
}
