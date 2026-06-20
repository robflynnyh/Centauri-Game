import * as THREE from "three";
import { createCollisionWorld, type CollisionObstacle } from "./collision";
import { createAlienWaterCreatures, createRareFlyingBeetles } from "./creatures";
import { createPrDemoController } from "./demo";
import { createFootstepTrail } from "./footsteps";
import { populateNature } from "./nature";
import {
  normalizeLocalVector,
  normalizePlanetCoords,
  PLANET_ASSUMED_WALK_SPEED,
  PLANET_CIRCUMFERENCE,
  PLANET_RADIUS,
  PLANET_TARGET_CIRCUMNAVIGATION_SECONDS,
  pointOnPlanet,
  setCameraOnPlanet,
  surfaceDistanceBetweenLocal,
} from "./planet";
import { createPixelRenderPipeline } from "./pixel-renderer";
import { createSkySystem } from "./sky";
import { createTerrainSystem, heightAt, makeHorizonLandforms } from "./terrain";
import "./style.css";

declare global {
  interface Window {
    __centauriDebug?: {
      obstacles: CollisionObstacle[];
      getPlayer: () => { x: number; y: number; z: number; worldX: number; worldY: number; worldZ: number };
      getPlanetState: () => {
        radius: number;
        circumference: number;
        targetCircumnavigationSeconds: number;
        assumedWalkSpeed: number;
        radialDistance: number;
      };
      getViewState: () => { yaw: number; pitch: number; mouseLookActive: boolean };
      getMovementState: () => { grounded: boolean; crouching: boolean; cameraHeight: number };
      getTerrainState: () => {
        centerX: number;
        centerZ: number;
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
        cellSize: number;
        chunkSize: number;
        chunkCount: number;
      };
      getNatureState: () => {
        centerX: number;
        centerZ: number;
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
        chunkSize: number;
        chunkCount: number;
        complexDetailRadius: number;
        complexFadeRadius: number;
        nearestBiomePatchDistance: number;
        fullDetailBiomePatches: number;
        generatedBiomePatches: number;
        generatedObjects: number;
        generatedObstacles: number;
        generatedReactiveFlora: number;
      };
      getBeetleState: () => { total: number; visible: number };
      setPlayer: (x: number, z: number) => void;
      attemptMove: (x: number, z: number) => { x: number; z: number };
      isBlockedAt: (x: number, z: number) => boolean;
      terrainHeightAt: (x: number, z: number) => number;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

const params = new URLSearchParams(window.location.search);
const isDemo = params.get("demo") === "pr";
const isBeetleDebug = params.get("debug") === "beetle";
const enableCollisionDebug = params.get("test") === "collision";
const standHeight = 1.65;
const crouchHeight = 0.96;
const walkSpeed = PLANET_ASSUMED_WALK_SPEED;
const crouchSpeed = 2.9;
const acceleration = 19;
const braking = 24;
const gravity = 18;
const jumpImpulse = 7.2;
const mouseLookSensitivity = 0.0024;
const initialPlayerLocalPosition = isBeetleDebug
  ? new THREE.Vector3(4.8, 0, 14.2)
  : new THREE.Vector3(0, 0, 24);

app.innerHTML = `
  <div class="hud">
    <section class="hud__title">
      <h1>Centauri Field Note 001</h1>
      <p>Unknown planet. Thin air. Singing mineral flora, glassy spring water. WASD to walk, Space to jump, Ctrl/Shift/C to crouch. Click the planet view once to lock mouse-look, click again or press Esc to free the cursor. Add <code>?demo=pr</code> for the deterministic PR flythrough.</p>
    </section>
    <div class="hud__badge">${isDemo ? "PR demo mode" : isBeetleDebug ? "beetle debug" : "exploration mode"}</div>
    <div class="hud__look" aria-live="polite"></div>
  </div>
`;

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Centauri exploration view");
app.appendChild(renderer.domElement);
const pixelRenderer = createPixelRenderPipeline(renderer, window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 5200);

const clock = new THREE.Clock();
const keys = new Set<string>();
const player = {
  yaw: 0,
  pitch: -0.12,
  localPosition: initialPlayerLocalPosition.clone(),
  position: pointOnPlanet(
    initialPlayerLocalPosition.x,
    initialPlayerLocalPosition.z,
    heightAt(initialPlayerLocalPosition.x, initialPlayerLocalPosition.z) + standHeight
  ),
  velocity: new THREE.Vector3(),
  verticalVelocity: 0,
  verticalOffset: 0,
  cameraHeight: standHeight,
  grounded: true,
  jumpQueued: false,
};
let mouseLookActive = false;
const lookStatus = document.querySelector<HTMLDivElement>(".hud__look");

const collisionWorld = createCollisionWorld(normalizeLocalVector);
const sky = createSkySystem(scene, camera, isDemo);
const terrain = createTerrainSystem();

scene.add(terrain.group);
scene.add(makeHorizonLandforms());

const { updateFloraReactivity, updateNatureChunks, getNatureState } = populateNature(
  scene,
  heightAt,
  collisionWorld.addObstacle,
  collisionWorld.replaceDynamicObstacles
);
const waterCreatures = createAlienWaterCreatures(scene, heightAt);
const flyingBeetles = createRareFlyingBeetles(scene, heightAt);
const footsteps = createFootstepTrail(scene, heightAt, collisionWorld.isBlockedAt);
const demoFloraFocus = new THREE.Vector3(9, 0, 18);
const prDemo = createPrDemoController(camera, heightAt, collisionWorld.resolveMove, (position, delta) => {
  demoFloraFocus.copy(position);
  if (delta > 0) footsteps.walk(position, delta);
});

if (enableCollisionDebug) {
  window.__centauriDebug = {
    obstacles: collisionWorld.obstacles,
    getPlayer: () => ({
      x: player.localPosition.x,
      y: player.position.length() - PLANET_RADIUS,
      z: player.localPosition.z,
      worldX: player.position.x,
      worldY: player.position.y,
      worldZ: player.position.z,
    }),
    getPlanetState: () => ({
      radius: PLANET_RADIUS,
      circumference: PLANET_CIRCUMFERENCE,
      targetCircumnavigationSeconds: PLANET_TARGET_CIRCUMNAVIGATION_SECONDS,
      assumedWalkSpeed: PLANET_ASSUMED_WALK_SPEED,
      radialDistance: player.position.length(),
    }),
    getViewState: () => ({
      yaw: player.yaw,
      pitch: player.pitch,
      mouseLookActive,
    }),
    getMovementState: () => ({
      grounded: player.grounded,
      crouching: isCrouchPressed(),
      cameraHeight: player.cameraHeight,
    }),
    getTerrainState: terrain.getTerrainState,
    getNatureState,
    getBeetleState: () => ({
      total: flyingBeetles.beetleGroup.children.length,
      visible: flyingBeetles.beetleGroup.children.filter((child) => child.visible).length,
    }),
    setPlayer: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      player.localPosition.set(normalized.x, 0, normalized.z);
      player.velocity.set(0, 0, 0);
      player.verticalVelocity = 0;
      player.verticalOffset = 0;
      player.cameraHeight = standHeight;
      player.grounded = true;
      updatePlayerWorldPosition();
      terrain.update(player.localPosition.x, player.localPosition.z);
      updateNatureChunks(player.localPosition.x, player.localPosition.z);
    },
    attemptMove: (x: number, z: number) => {
      collisionWorld.resolveMove(player.localPosition, new THREE.Vector3(x, 0, z));
      updatePlayerWorldPosition();
      terrain.update(player.localPosition.x, player.localPosition.z);
      updateNatureChunks(player.localPosition.x, player.localPosition.z);
      return { x: player.localPosition.x, z: player.localPosition.z };
    },
    isBlockedAt: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      return collisionWorld.isBlockedAt(normalized.x, normalized.z);
    },
    terrainHeightAt: heightAt,
  };
}

const audio = new AudioContext();
let audioStarted = false;

function startAudio(): void {
  if (audioStarted) return;
  audioStarted = true;
  const master = audio.createGain();
  master.gain.value = 0.035;
  master.connect(audio.destination);

  [55, 82.5, 110, 165].forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.75 : 0.22;
    oscillator.connect(gain).connect(master);
    oscillator.start();
  });
}

function updateLookStatus(): void {
  if (!lookStatus) return;
  lookStatus.textContent = isDemo ? "" : mouseLookActive ? "mouse locked" : "click to lock";
}

updateLookStatus();

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) player.jumpQueued = true;
  }
  void audio.resume();
  startAudio();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
renderer.domElement.addEventListener("click", () => {
  startAudio();
  if (isDemo) return;
  renderer.domElement.focus();
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
    return;
  }
  const pointerLockRequest = renderer.domElement.requestPointerLock();
  if (pointerLockRequest) {
    pointerLockRequest.catch(() => updateLookStatus());
  }
});
document.addEventListener("pointerlockchange", () => {
  mouseLookActive = document.pointerLockElement === renderer.domElement;
  updateLookStatus();
});
document.addEventListener("mousemove", (event) => {
  if (!mouseLookActive || isDemo) return;
  player.yaw -= event.movementX * mouseLookSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * mouseLookSensitivity, -1.1, 0.6);
});

function isCrouchPressed(): boolean {
  return keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyC");
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function playerSurfaceAltitude(): number {
  return heightAt(player.localPosition.x, player.localPosition.z) + player.cameraHeight + player.verticalOffset;
}

function updatePlayerWorldPosition(): void {
  normalizeLocalVector(player.localPosition);
  player.position.copy(pointOnPlanet(player.localPosition.x, player.localPosition.z, playerSurfaceAltitude()));
}

function updateExploration(delta: number): void {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const wish = new THREE.Vector3();

  if (keys.has("KeyW")) wish.add(forward.clone().multiplyScalar(-1));
  if (keys.has("KeyS")) wish.add(forward);
  if (keys.has("KeyA")) wish.add(right.clone().multiplyScalar(-1));
  if (keys.has("KeyD")) wish.add(right);

  if (wish.lengthSq() > 0) wish.normalize();
  const crouching = isCrouchPressed();
  const targetSpeed = crouching ? crouchSpeed : walkSpeed;
  const targetVelocity = wish.multiplyScalar(targetSpeed);
  const horizontalRate = targetVelocity.lengthSq() > 0 ? acceleration : braking;
  const maxVelocityDelta = horizontalRate * delta;
  player.velocity.x = moveToward(player.velocity.x, targetVelocity.x, maxVelocityDelta);
  player.velocity.z = moveToward(player.velocity.z, targetVelocity.z, maxVelocityDelta);

  if (player.jumpQueued && player.grounded && !crouching) {
    player.verticalVelocity = jumpImpulse;
    player.grounded = false;
  }
  player.jumpQueued = false;

  if (!player.grounded) {
    player.verticalVelocity -= gravity * delta;
    player.verticalOffset += player.verticalVelocity * delta;
    if (player.verticalOffset <= 0) {
      player.verticalOffset = 0;
      player.verticalVelocity = 0;
      player.grounded = true;
    }
  }

  const beforeLocal = { x: player.localPosition.x, z: player.localPosition.z };
  collisionWorld.resolveMove(player.localPosition, player.velocity.clone().multiplyScalar(delta));
  const actualHorizontalSpeed = surfaceDistanceBetweenLocal(beforeLocal, player.localPosition) / Math.max(delta, 0.001);
  if (actualHorizontalSpeed < 0.02) {
    player.velocity.x = 0;
    player.velocity.z = 0;
  }

  const targetCameraHeight = crouching ? crouchHeight : standHeight;
  player.cameraHeight = THREE.MathUtils.lerp(player.cameraHeight, targetCameraHeight, 1 - Math.exp(-delta * 12));
  const walkingOnGround = player.grounded && actualHorizontalSpeed > 0.25;
  if (walkingOnGround) {
    footsteps.walk(player.localPosition, delta);
  }

  updatePlayerWorldPosition();
  setCameraOnPlanet(camera, player.localPosition.x, player.localPosition.z, playerSurfaceAltitude(), player.yaw, player.pitch);
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (isDemo) prDemo.update(elapsed, delta);
  else updateExploration(delta);

  footsteps.update(delta);
  waterCreatures.update(elapsed);
  const floraFocus = isDemo ? demoFloraFocus : player.localPosition;
  flyingBeetles.update(elapsed, floraFocus);
  sky.update(elapsed);
  terrain.update(floraFocus.x, floraFocus.z);
  updateNatureChunks(floraFocus.x, floraFocus.z);
  updateFloraReactivity(floraFocus, delta, elapsed);

  pixelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  pixelRenderer.resize(window.innerWidth, window.innerHeight);
});

animate();
