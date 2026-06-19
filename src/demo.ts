import * as THREE from "three";

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
  const demoPlayer = new THREE.Vector3(9, heightAt(9, 18) + 3.45, 18);

  return {
    update: (elapsed, delta) => {
      if (elapsed < 3.6) {
        resolveMove(demoPlayer, new THREE.Vector3(-delta * 0.18, 0, -delta * 1.6));
        const crouchDip = intervalPulse(elapsed, 0.8, 1.25, 1.85) * 0.8;
        const jumpRise = intervalPulse(elapsed, 2.05, 2.58, 3.15) * 1.25;
        demoPlayer.y = heightAt(demoPlayer.x, demoPlayer.z) + 4.05 - crouchDip + jumpRise;
        onWalk?.(demoPlayer, delta);
        camera.position.copy(demoPlayer);
        camera.lookAt(2, heightAt(0, -72) + 13.5, -96);
        return;
      }

      if (elapsed < 6.4) {
        resolveMove(demoPlayer, new THREE.Vector3(-delta * 0.32, 0, -delta * 2.75));
        demoPlayer.y = heightAt(demoPlayer.x, demoPlayer.z) + 3.15;
        onWalk?.(demoPlayer, delta);
        camera.position.copy(demoPlayer);
        camera.lookAt(6.2, heightAt(6.2, 7) + 2.5, 7);
        return;
      }

      if (elapsed < 8.4) {
        camera.position.set(12.5, heightAt(12.5, 21) + 5.4, 21);
        camera.lookAt(-6, heightAt(0, -72) + 34, -108);
        return;
      }

      const radius = 24 - Math.sin(elapsed * 0.35) * 4;
      const angle = elapsed * 0.14 + 0.35;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = heightAt(x, z) + 3.6 + Math.sin(elapsed * 0.7) * 0.7;
      camera.position.set(x, y, z);

      const horizonBlend = THREE.MathUtils.smoothstep(Math.sin(elapsed * 0.22) * 0.5 + 0.5, 0.28, 0.82);
      const localTarget = new THREE.Vector3(5.5 + Math.sin(elapsed * 0.22) * 2.4, 5.9 + Math.sin(elapsed * 0.31) * 0.8, 6 + Math.cos(elapsed * 0.18) * 2.4);
      const ridgeTarget = new THREE.Vector3(-8 + Math.sin(elapsed * 0.15) * 18, heightAt(0, -72) + 11.5, -104);
      camera.lookAt(localTarget.lerp(ridgeTarget, horizonBlend * 0.45));
    },
  };
}
