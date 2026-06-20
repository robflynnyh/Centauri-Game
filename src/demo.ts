import * as THREE from "three";
import { lookAtPlanetPoint, PLANET_RADIUS, type LocalPlanetPoint } from "./planet";

type HeightSampler = (x: number, z: number) => number;
type ResolveMove = (position: THREE.Vector3, movement: THREE.Vector3) => void;
type WalkObserver = (position: THREE.Vector3, delta: number) => void;

function intervalPulse(value: number, start: number, peak: number, end: number): number {
  if (value < start || value > end) return 0;
  if (value < peak) return THREE.MathUtils.smoothstep(value, start, peak);
  return 1 - THREE.MathUtils.smoothstep(value, peak, end);
}

function sunFacingLongitude(elapsed: number): number {
  const phase = (elapsed / 18 + 0.18) % 1;
  return phase * Math.PI * 2;
}

function showSkyRegion(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  onWalk: WalkObserver | undefined,
  elapsed: number,
  longitudeOffset: number,
  latitude: number,
  targetLongitudeOffset: number
): void {
  const sunLongitude = sunFacingLongitude(elapsed);
  const x = (sunLongitude + longitudeOffset) * PLANET_RADIUS;
  const z = latitude * PLANET_RADIUS;
  const targetX = (sunLongitude + longitudeOffset + targetLongitudeOffset) * PLANET_RADIUS;
  const targetZ = (latitude * 0.72 + 0.08) * PLANET_RADIUS;
  const position = new THREE.Vector3(x, 0, z);
  onWalk?.(position, 0);
  lookAtPlanetPoint(
    camera,
    x,
    z,
    heightAt(x, z) + 36,
    targetX,
    targetZ,
    heightAt(targetX, targetZ) + 16
  );
}

export function createPrDemoController(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  resolveMove: ResolveMove,
  onWalk?: WalkObserver,
  temple?: { position: LocalPlanetPoint; approachPosition: LocalPlanetPoint }
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

      if (elapsed < 7.4) {
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

      if (elapsed < 8.8) {
        const templePosition = temple?.position ?? { x: 260, z: -240 };
        const approach = temple?.approachPosition ?? { x: 278, z: -248 };
        onWalk?.(new THREE.Vector3(templePosition.x, 0, templePosition.z), 0);
        lookAtPlanetPoint(
          camera,
          approach.x,
          approach.z,
          heightAt(approach.x, approach.z) + 7.8,
          templePosition.x,
          templePosition.z,
          heightAt(templePosition.x, templePosition.z) + 5.7
        );
        return;
      }

      if (elapsed < 10.6) {
        showSkyRegion(camera, heightAt, onWalk, elapsed, 0, -0.15, 0.18);
        return;
      }

      if (elapsed < 12.6) {
        showSkyRegion(camera, heightAt, onWalk, elapsed, Math.PI * 0.5, 0.05, -0.22);
        return;
      }

      if (elapsed < 16.0) {
        showSkyRegion(camera, heightAt, onWalk, elapsed, Math.PI, 0.16, -0.18);
        return;
      }

      if (elapsed < 18.2) {
        const focus = { x: 25.0, z: -614.0 };
        const x = 44 + Math.sin(elapsed * 0.5) * 3;
        const z = -593 + Math.cos(elapsed * 0.45) * 3;
        onWalk?.(new THREE.Vector3(x, 0, z), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + 5.6,
          focus.x,
          focus.z,
          heightAt(focus.x, focus.z) + 1.3
        );
        return;
      }

      if (elapsed < 20.0) {
        const focus = { x: 25.0, z: -614.0 };
        const x = 31 + Math.sin(elapsed * 0.55) * 1.2;
        const z = -607 + Math.cos(elapsed * 0.48) * 1.2;
        onWalk?.(new THREE.Vector3(x, 0, z), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + 3.6,
          focus.x,
          focus.z,
          heightAt(focus.x, focus.z) + 1.2
        );
        return;
      }

      const x = -128 + Math.sin(elapsed * 0.34) * 9;
      const z = -464 + Math.cos(elapsed * 0.29) * 7;
      onWalk?.(new THREE.Vector3(x, 0, z), 0);
      const targetX = -210 + Math.sin(elapsed * 0.17) * 20;
      const targetZ = -630 + Math.cos(elapsed * 0.15) * 32;
      lookAtPlanetPoint(
        camera,
        x,
        z,
        heightAt(x, z) + 28 + Math.sin(elapsed * 0.44) * 1.2,
        targetX,
        targetZ,
        heightAt(targetX, targetZ) + 10
      );
    },
  };
}
