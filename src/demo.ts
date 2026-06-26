import * as THREE from "three";
import { getDiamondDebugSpawn } from "./diamond-biome";
import type { FloatingMountainsDebugState } from "./floating-mountains";
import { lookAtPlanetPoint, PLANET_RADIUS, setCameraOnPlanet, type LocalPlanetPoint } from "./planet";
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

function setDemoFov(camera: THREE.PerspectiveCamera, fov: number): void {
  if (Math.abs(camera.fov - fov) < 0.01) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function headingFromYaw(yaw: number): LocalPlanetPoint {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
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

function showFloatingMountainsDemoRegion(
  camera: THREE.Camera,
  heightAt: HeightSampler,
  onWalk: WalkObserver | undefined,
  elapsed: number,
  floatingMountains?: FloatingMountainsDebugState
): void {
  const center = floatingMountains?.center ?? { x: 1420, z: 70, groundHeight: heightAt(1420, 70) };
  const spawn = floatingMountains?.debugSpawn ?? {
    x: center.x + 150,
    z: center.z + 66,
    yaw: 0,
    pitch: -0.08,
    altitudeAboveGround: 78,
  };
  const target = floatingMountains?.debugTarget ?? {
    x: center.x,
    z: center.z,
    altitude: heightAt(center.x, center.z) + 126,
  };
  const beat = elapsed - 14.4;
  const x = spawn.x + Math.sin(beat * 0.7) * 14;
  const z = spawn.z + Math.cos(beat * 0.52) * 10;
  onWalk?.(new THREE.Vector3(x, 0, z), 0);
  lookAtPlanetPoint(
    camera,
    x,
    z,
    heightAt(x, z) + spawn.altitudeAboveGround + Math.sin(beat * 0.42) * 2,
    target.x,
    target.z,
    target.altitude
  );
}

export function createPrDemoController(
  camera: THREE.PerspectiveCamera,
  heightAt: HeightSampler,
  resolveMove: ResolveMove,
  onWalk?: WalkObserver,
  temple?: { position: LocalPlanetPoint; approachPosition: LocalPlanetPoint },
  dome?: {
    position: LocalPlanetPoint;
    approachPosition: LocalPlanetPoint;
    entrancePosition: LocalPlanetPoint;
    entranceDirection: LocalPlanetPoint;
    radius: number;
  },
  observatory?: {
    position: LocalPlanetPoint;
    approachPosition: LocalPlanetPoint;
    telescope: {
      viewPosition: LocalPlanetPoint;
      viewHeight: number;
      yaw: number;
      pitch: number;
    };
  },
  mountain?: { center: LocalPlanetPoint; base: LocalPlanetPoint; pathSamples: LocalPlanetPoint[] },
  paramotor?: { position: LocalPlanetPoint; approachPosition: LocalPlanetPoint; takeoffYaw: number },
  floatingMountains?: FloatingMountainsDebugState
): { update: (elapsed: number, delta: number) => void } {
  const demoPlayer = new THREE.Vector3(9, 0, 18);

  return {
    update: (elapsed, delta) => {
      setDemoFov(camera, 68);
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
        const observatoryPosition = observatory?.position ?? { x: -430, z: 312 };
        const approach = observatory?.approachPosition ?? { x: -442, z: 324 };
        onWalk?.(new THREE.Vector3(observatoryPosition.x, 0, observatoryPosition.z), 0);
        lookAtPlanetPoint(
          camera,
          approach.x,
          approach.z,
          heightAt(approach.x, approach.z) + 7.2,
          observatoryPosition.x,
          observatoryPosition.z,
          heightAt(observatoryPosition.x, observatoryPosition.z) + 4.4
        );
        return;
      }

      if (elapsed < 11.8) {
        const telescope = observatory?.telescope;
        const viewPosition = telescope?.viewPosition ?? { x: -432, z: 316 };
        setDemoFov(camera, 26);
        onWalk?.(new THREE.Vector3(viewPosition.x, 0, viewPosition.z), 0);
        setCameraOnPlanet(
          camera,
          viewPosition.x,
          viewPosition.z,
          telescope?.viewHeight ?? heightAt(viewPosition.x, viewPosition.z) + 2.35,
          (telescope?.yaw ?? 0) + Math.sin(elapsed * 0.72) * 0.34,
          (telescope?.pitch ?? 0.26) + Math.sin(elapsed * 0.55) * 0.12
        );
        return;
      }

      if (elapsed < 13.0) {
        showOceanDemoRegion(camera, heightAt, onWalk, elapsed);
        return;
      }

      if (elapsed < 14.4) {
        showDiamondDemoRegion(camera, heightAt, onWalk, elapsed);
        return;
      }

      if (elapsed < 16.0) {
        showFloatingMountainsDemoRegion(camera, heightAt, onWalk, elapsed, floatingMountains);
        return;
      }

      const shiftedElapsed = elapsed - 5.4;

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

      if (shiftedElapsed < 17.6) {
        const domePosition = dome?.position ?? { x: -360, z: 260 };
        const approach = dome?.approachPosition ?? { x: -415, z: 282 };
        const entrance = dome?.entrancePosition ?? { x: -390, z: 270 };
        onWalk?.(new THREE.Vector3(approach.x, 0, approach.z), 0);
        lookAtPlanetPoint(
          camera,
          approach.x,
          approach.z,
          heightAt(approach.x, approach.z) + 18,
          domePosition.x,
          domePosition.z,
          heightAt(domePosition.x, domePosition.z) + 34
        );
        if (shiftedElapsed > 16.9) {
          lookAtPlanetPoint(
            camera,
            entrance.x,
            entrance.z,
            heightAt(entrance.x, entrance.z) + 4.2,
            domePosition.x,
            domePosition.z,
            heightAt(domePosition.x, domePosition.z) + 10
          );
        }
        return;
      }

      if (shiftedElapsed < 18.8) {
        const device = paramotor ?? { position: { x: 74, z: 34 }, approachPosition: { x: 66, z: 42 }, takeoffYaw: -0.4 };
        const beat = shiftedElapsed - 17.6;
        const heading = headingFromYaw(device.takeoffYaw);
        const side = { x: heading.z, z: -heading.x };
        const flightDistance = 12 + beat * 36;
        const x =
          beat < 0.44
            ? device.approachPosition.x + side.x * Math.sin(elapsed * 0.9) * 0.6
            : device.position.x + heading.x * flightDistance + side.x * Math.sin(elapsed * 0.7) * 2.2;
        const z =
          beat < 0.44
            ? device.approachPosition.z + side.z * Math.sin(elapsed * 0.9) * 0.6
            : device.position.z + heading.z * flightDistance + side.z * Math.sin(elapsed * 0.7) * 2.2;
        const targetX = device.position.x + heading.x * (beat < 0.44 ? 0 : 24);
        const targetZ = device.position.z + heading.z * (beat < 0.44 ? 0 : 24);
        onWalk?.(new THREE.Vector3(x, 0, z), 0);
        lookAtPlanetPoint(
          camera,
          x,
          z,
          heightAt(x, z) + (beat < 0.44 ? 4.4 : 8 + beat * 12),
          targetX,
          targetZ,
          heightAt(targetX, targetZ) + (beat < 0.44 ? 3.6 : 10)
        );
        return;
      }

      if (shiftedElapsed < 20.4) {
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

      if (shiftedElapsed < 21.4) {
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

      if (shiftedElapsed < 21.8) {
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
