import * as THREE from "three";
import { lookAtPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;
type ResolveMove = (position: THREE.Vector3, movement: THREE.Vector3) => void;
type WalkObserver = (position: THREE.Vector3, delta: number) => void;

function intervalPulse(value: number, start: number, peak: number, end: number): number {
  if (value < start || value > end) return 0;
  if (value < peak) return THREE.MathUtils.smoothstep(value, start, peak);
  return 1 - THREE.MathUtils.smoothstep(value, peak, end);
}

export function createPrDemoController(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  resolveMove: ResolveMove,
  onWalk?: WalkObserver
): { update: (elapsed: number, delta: number) => void } {
  const demoPlayer = new THREE.Vector3(9, 0, 18);

  return {
    update: (elapsed, delta) => {
      if (elapsed < 3.6) {
        resolveMove(demoPlayer, new THREE.Vector3(-delta * 0.18, 0, -delta * 1.6));
        const crouchDip = intervalPulse(elapsed, 0.8, 1.25, 1.85) * 0.8;
        const jumpRise = intervalPulse(elapsed, 2.05, 2.58, 3.15) * 1.25;
        onWalk?.(demoPlayer, delta);
        lookAtPlanetPoint(
          camera,
          demoPlayer.x,
          demoPlayer.z,
          heightAt(demoPlayer.x, demoPlayer.z) + 4.05 - crouchDip + jumpRise,
          2,
          -96,
          heightAt(2, -96) + 13.5
        );
        return;
      }

      if (elapsed < 8.4) {
        if (elapsed < 6.4) {
          resolveMove(demoPlayer, new THREE.Vector3(-delta * 0.32, 0, -delta * 2.75));
          onWalk?.(demoPlayer, delta);
        } else {
          onWalk?.(demoPlayer, 0);
        }
        lookAtPlanetPoint(
          camera,
          demoPlayer.x,
          demoPlayer.z,
          heightAt(demoPlayer.x, demoPlayer.z) + 3.15,
          6.7,
          10.2,
          heightAt(6.7, 10.2) + 1.85
        );
        return;
      }

      if (elapsed < 10.8) {
        const generatedBiome = new THREE.Vector3(260, 0, -240);
        onWalk?.(generatedBiome, 0);
        lookAtPlanetPoint(camera, 278, -248, heightAt(278, -248) + 8.5, 306, -268, heightAt(306, -268) + 2.8);
        return;
      }

      const radius = 68 - Math.sin(elapsed * 0.35) * 8;
      const angle = elapsed * 0.14 + 0.35;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      onWalk?.(new THREE.Vector3(x, 0, z), 0);

      const horizonBlend = THREE.MathUtils.smoothstep(Math.sin(elapsed * 0.22) * 0.5 + 0.5, 0.28, 0.82);
      const localTargetX = 5.5 + Math.sin(elapsed * 0.22) * 2.4;
      const localTargetZ = 6 + Math.cos(elapsed * 0.18) * 2.4;
      const ridgeTargetX = -8 + Math.sin(elapsed * 0.15) * 18;
      const ridgeTargetZ = -330 + Math.cos(elapsed * 0.18) * 24;
      const targetX = THREE.MathUtils.lerp(localTargetX, ridgeTargetX, horizonBlend * 0.72);
      const targetZ = THREE.MathUtils.lerp(localTargetZ, ridgeTargetZ, horizonBlend * 0.72);
      lookAtPlanetPoint(
        camera,
        x,
        z,
        heightAt(x, z) + 62 + Math.sin(elapsed * 0.7) * 3,
        targetX,
        targetZ,
        heightAt(targetX, targetZ) + THREE.MathUtils.lerp(5.9, 10.5, horizonBlend * 0.72)
      );
    },
  };
}
