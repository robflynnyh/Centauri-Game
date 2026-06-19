import * as THREE from "three";

export type CollisionObstacle = {
  kind: "tree" | "rock";
  x: number;
  z: number;
  radius: number;
};

const playerRadius = 0.55;

export function createCollisionWorld(): {
  obstacles: CollisionObstacle[];
  addObstacle: (obstacle: CollisionObstacle) => void;
  isBlockedAt: (x: number, z: number) => boolean;
  resolveMove: (position: THREE.Vector3, movement: THREE.Vector3) => void;
} {
  const obstacles: CollisionObstacle[] = [];

  const isBlockedAt = (x: number, z: number): boolean =>
    obstacles.some((obstacle) => {
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
    isBlockedAt,
    resolveMove: (position, movement) => {
      const nextX = position.x + movement.x;
      if (!isBlockedAt(nextX, position.z)) {
        position.x = nextX;
      }

      const nextZ = position.z + movement.z;
      if (!isBlockedAt(position.x, nextZ)) {
        position.z = nextZ;
      }
    },
  };
}
