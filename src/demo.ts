import * as THREE from "three";
import { getDiamondDebugSpawn } from "./diamond-biome";
import { lookAtPlanetPoint, PLANET_RADIUS, type LocalPlanetPoint } from "./planet";
import { getSunFacingLongitude } from "./sky";
import { getOceanRegions } from "./water";

type HeightSampler = (x: number, z: number) => number;
type ResolveMove = (position: THREE.Vector3, movement: THREE.Vector3) => void;
type WalkObserver = (position: THREE.Vector3, delta: number) => void;

function intervalPulse(value: number, start: number, peak: number, end: number): number {
  if (value < start || value > end) return 0;
  if (value < peak) return THREE.MathUtils.smoothstep(value, start, peak);
  return 1 - THREE.MathUtils.smoothstep(value, peak, end);
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
  const sunLongitude = getSunFacingLongitude(elapsed, true);
  showSkyRegionAtLongitude(camera, heightAt, onWalk, sunLongitude, longitudeOffset, latitude, targetLongitudeOffset);
}

function showFixedTimeSkyRegion(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  onWalk: WalkObserver | undefined,
  anchorElapsed: number,
  longitudeOffset: number,
  latitude: number,
  targetLongitudeOffset: number
): void {
  const sunLongitude = getSunFacingLongitude(anchorElapsed, true);
  showSkyRegionAtLongitude(camera, heightAt, onWalk, sunLongitude, longitudeOffset, latitude, targetLongitudeOffset);
}

function showSkyRegionAtLongitude(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  onWalk: WalkObserver | undefined,
  sunLongitude: number,
  longitudeOffset: number,
  latitude: number,
  targetLongitudeOffset: number
): void {
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

function showOceanDemoRegion(camera: THREE.Camera, heightAt: HeightSampler, onWalk: WalkObserver | undefined, elapsed: number): void {
  const ocean = getOceanRegions()[0];
  const orbit = elapsed * 0.18;
  const x = ocean.center.x + Math.cos(orbit) * 360;
  const z = ocean.center.z + Math.sin(orbit) * 120;
  const targetX = ocean.center.x - 60;
  const targetZ = ocean.center.z + 30;
  onWalk?.(new THREE.Vector3(ocean.center.x, 0, ocean.center.z), 0);
  lookAtPlanetPoint(
    camera,
    x,
    z,
    heightAt(x, z) + 86,
    targetX,
    targetZ,
    heightAt(targetX, targetZ) + 2
  );
}

function showDiamondDemoRegion(camera: THREE.Camera, heightAt: HeightSampler, onWalk: WalkObserver | undefined, elapsed: number): void {
  const spawn = getDiamondDebugSpawn();
  const orbit = elapsed * 0.42;
  const x = spawn.x - 18 + Math.sin(orbit) * 3.2;
  const z = spawn.z + 12 + Math.cos(orbit) * 2.4;
  const targetX = spawn.x + 86;
  const targetZ = spawn.z - 6;
  onWalk?.(new THREE.Vector3(spawn.x + 42, 0, spawn.z - 4), 0);
  lookAtPlanetPoint(
    camera,
    x,
    z,
    heightAt(x, z) + 5.2,
    targetX,
    targetZ,
    heightAt(targetX, targetZ) + 1.4
  );
}

export function createPrDemoController(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  resolveMove: ResolveMove,
  onWalk?: WalkObserver,
  temple?: { position: LocalPlanetPoint; approachPosition: LocalPlanetPoint },
  mountain?: { center: LocalPlanetPoint; base: LocalPlanetPoint; pathSamples: LocalPlanetPoint[] }
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

      if (elapsed < 10.4) {
        showOceanDemoRegion(camera, heightAt, onWalk, elapsed);
        return;
      }

      if (elapsed < 12.0) {
        showDiamondDemoRegion(camera, heightAt, onWalk, elapsed);
        return;
      }

      const shiftedElapsed = elapsed - 3.2;

      if (shiftedElapsed < 10.6) {
        showSkyRegion(camera, heightAt, onWalk, shiftedElapsed, 0, -0.15, 0.18);
        return;
      }

      if (shiftedElapsed < 12.6) {
        showFixedTimeSkyRegion(camera, heightAt, onWalk, 10.6, Math.PI * 0.5, 0.05, -0.22);
        return;
      }

      if (shiftedElapsed < 16.0) {
        showSkyRegion(camera, heightAt, onWalk, shiftedElapsed, Math.PI, 0.16, -0.18);
        return;
      }

      if (shiftedElapsed < 18.2) {
        const focus = { x: 12.9, z: -73.4 };
        const x = 23 + Math.sin(elapsed * 0.62) * 1.1;
        const z = -62 + Math.cos(elapsed * 0.54) * 1.1;
        onWalk?.(new THREE.Vector3(focus.x + 70, 0, focus.z + 70), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + 7.8,
          focus.x,
          focus.z,
          heightAt(focus.x, focus.z) + 3.5
        );
        return;
      }

      if (shiftedElapsed < 19.8) {
        const base = mountain?.base ?? { x: 470, z: -446 };
        const center = mountain?.center ?? { x: 612, z: -528 };
        const x = base.x - 12 + Math.sin(elapsed * 0.45) * 2.4;
        const z = base.z + 13 + Math.cos(elapsed * 0.38) * 2.4;
        onWalk?.(new THREE.Vector3(base.x, 0, base.z), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + 8.8,
          center.x,
          center.z,
          heightAt(center.x, center.z) + 22
        );
        return;
      }

      if (shiftedElapsed < 20.8) {
        const samples = mountain?.pathSamples ?? [];
        const middle = samples[Math.floor(samples.length * 0.56)] ?? { x: 500, z: -560 };
        const summit = mountain?.center ?? { x: 612, z: -528 };
        const x = middle.x + 24 + Math.sin(elapsed * 0.52) * 2.4;
        const z = middle.z + 18 + Math.cos(elapsed * 0.44) * 2.4;
        onWalk?.(new THREE.Vector3(middle.x, 0, middle.z), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + 15,
          summit.x,
          summit.z,
          heightAt(summit.x, summit.z) + 7
        );
        return;
      }

      if (shiftedElapsed < 21.2) {
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
