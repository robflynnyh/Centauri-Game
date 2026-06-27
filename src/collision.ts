import * as THREE from "three";

export type CollisionObstacle = {
  kind: "tree" | "rock" | "temple" | "dome-shell" | "observatory" | "radio-telescope";
  x: number;
  z: number;
  radius: number;
  dynamic?: boolean;
  blocksAt?: (x: number, z: number, playerRadius: number) => boolean;
};

const playerRadius = 0.55;

type NormalizePosition = (position: THREE.Vector3) => void;

export function createCollisionWorld(normalizePosition: NormalizePosition = () => undefined): {
  obstacles: CollisionObstacle[];
  addObstacle: (obstacle: CollisionObstacle) => void;
  replaceDynamicObstacles: (obstacles: CollisionObstacle[]) => void;
  isBlockedAt: (x: number, z: number) => boolean;
  resolveMove: (position: THREE.Vector3, movement: THREE.Vector3) => void;
} {
  const obstacles: CollisionObstacle[] = [];

  const isBlockedAt = (x: number, z: number): boolean =>
    obstacles.some((obstacle) => {
      if (obstacle.blocksAt) return obstacle.blocksAt(x, z, playerRadius);
      const minDistance = playerRadius + obstacle.radius;
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      return dx * dx + dz * dz < minDistance * minDistance;
    });

  return {
    obstacles,
    addObstacle: (obstacle) => {
      obstacles.push(obstacle);
    },
    replaceDynamicObstacles: (dynamicObstacles) => {
      for (let i = obstacles.length - 1; i >= 0; i -= 1) {
        if (obstacles[i].dynamic) obstacles.splice(i, 1);
      }
      dynamicObstacles.forEach((obstacle) => obstacles.push({ ...obstacle, dynamic: true }));
    },
    isBlockedAt,
    resolveMove: (position, movement) => {
      const candidate = position.clone();
      candidate.x += movement.x;
      normalizePosition(candidate);
      if (!isBlockedAt(candidate.x, candidate.z)) {
        position.x = candidate.x;
        position.z = candidate.z;
      }

      candidate.copy(position);
      candidate.z += movement.z;
      normalizePosition(candidate);
      if (!isBlockedAt(candidate.x, candidate.z)) {
        position.x = candidate.x;
        position.z = candidate.z;
      }
    },
  };
}
