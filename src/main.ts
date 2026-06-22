import * as THREE from "three";
import { createCollisionWorld, type CollisionObstacle } from "./collision";
import { createAlienWaterCreatures, createMountainBirds, createRareFlyingBeetles, type BirdDebugState } from "./creatures";
import { createPrDemoController } from "./demo";
import { createFieldNotesHud, createFieldNotesState, type FieldNotesSnapshot } from "./field-notes";
import { createFootstepTrail } from "./footsteps";
import { createTempleLandmark } from "./landmarks";
import { createMistSystem, type MistDebugState } from "./mist";
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
import { createSleepController, type SleepDebugState, type SleepUpdateInput } from "./sleep";
import { createSkySystem, type SkyDebugState } from "./sky";
import { createTerrainSystem, heightAt, makeHorizonLandforms } from "./terrain";
import { createOceanSystem, getOceanDebugSpawn, getOceanDebugState, oceanStateAt, type OceanDebugState, type OceanState } from "./water";
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
        generatedSeaweedPatches: number;
        generatedSeaweedBlades: number;
        nearestSeaweedDistance: number;
        nearestSeaweedFreezeAmount: number;
        seaweedSamples: {
          x: number;
          z: number;
          bladeCount: number;
          nearestBiomeEdgeDistance: number;
          flatness: number;
          staticBend: number;
        }[];
      };
      getVisionState: () => {
        isolationAmount: number;
        targetIsolationAmount: number;
        nearestBiomePatchDistance: number;
      };
      setIsolationOverride: (amount: number | null) => void;
      getTempleState: () => {
        x: number;
        z: number;
        approachX: number;
        approachZ: number;
        noteX: number;
        noteZ: number;
        noteRadius: number;
        influenceRadius: number;
        fullInfluenceRadius: number;
      };
      getFieldNotesState: () => FieldNotesSnapshot;
      getCreatureState: () => {
        total: number;
        activeHops: number;
        scaredHops: number;
        nearestObstacleClearance: number;
        maxDistanceFromWater: number;
        minActiveHopDistance: number;
        minScaredHopDistance: number;
        creatures: {
          x: number;
          z: number;
          anchorX: number;
          anchorZ: number;
          distanceFromWater: number;
          activeHopKind: "scared" | "return" | null;
          hopDistance: number;
        }[];
      };
      getBeetleState: () => { total: number; visible: number; nearestObstacleClearance: number };
      getMistState: () => MistDebugState;
      getBirdState: () => BirdDebugState;
      getOceanState: () => OceanState;
      getOceanStateAt: (x: number, z: number) => OceanState;
      getOceanDebugState: () => OceanDebugState;
      getSleepState: () => SleepDebugState;
      setSleepAmount: (amount: number) => SleepDebugState;
      advanceSleep: (delta: number, input?: Partial<SleepUpdateInput>) => SleepDebugState;
      getSkyState: () => SkyDebugState;
      setSkyElapsed: (elapsed: number) => SkyDebugState;
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
const enableTempleDebug = params.get("debug") === "temple";
const isBeetleDebug = params.get("debug") === "beetle";
const isBirdDebug = params.get("debug") === "birds";
const enableOceanDebug = params.get("debug") === "ocean";
const enableCollisionDebug = params.get("test") === "collision";
const enableSleepDebug = params.get("test") === "sleep";
const enableIsolationDebug = params.get("debug") === "isolation" || params.get("test") === "isolation";
const enableDebugTools =
  enableCollisionDebug || enableTempleDebug || isBeetleDebug || isBirdDebug || enableOceanDebug || enableSleepDebug || enableIsolationDebug;
const standHeight = 1.65;
const crouchHeight = 0.96;
const walkSpeed = PLANET_ASSUMED_WALK_SPEED;
const crouchSpeed = 2.9;
const acceleration = 19;
const braking = 24;
const gravity = 18;
const jumpImpulse = 7.2;
const mouseLookSensitivity = 0.0024;
const hudBadgeText = isDemo
  ? "PR demo mode"
  : enableTempleDebug
    ? "temple debug"
      : isBeetleDebug
        ? "beetle debug"
        : isBirdDebug
          ? "birds debug"
          : enableOceanDebug
            ? "ocean debug"
            : enableSleepDebug
              ? "sleep debug"
              : enableIsolationDebug
                ? "isolation debug"
                : "exploration mode";

function readInitialSleepAmount(): number {
  const fromQuery = params.get("sleepAmount");
  if (!fromQuery) return 1;
  const value = Number(fromQuery);
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1;
}

const sleep = createSleepController({
  drainSeconds: enableSleepDebug ? 1.6 : isDemo ? 14 : 600,
  settleSeconds: enableSleepDebug ? 0.08 : isDemo ? 0.05 : 1.25,
  refillSeconds: enableSleepDebug ? 0.42 : isDemo ? 4 : 8,
  blackoutRecoverySeconds: enableSleepDebug ? 0.9 : 9,
  blackoutMinimumSeconds: enableSleepDebug ? 0.25 : 3.5,
  eyelidCloseSeconds: enableSleepDebug ? 0.18 : isDemo ? 2 : 1.05,
  eyelidOpenSeconds: enableSleepDebug ? 0.18 : 1.05,
  initialAmount: isDemo ? 0.35 : readInitialSleepAmount(),
});

app.innerHTML = `
  <div class="hud">
    <section class="hud__title">
      <h1 class="hud__note-heading"></h1>
      <p class="hud__note-body" aria-live="polite"></p>
    </section>
    <div class="hud__sleep" aria-label="Sleep meter">
      <div class="hud__sleep-row">
        <span>Sleep</span>
        <span class="hud__sleep-status">rested</span>
      </div>
      <div class="hud__sleep-track" aria-hidden="true">
        <div class="hud__sleep-fill"></div>
      </div>
    </div>
    <div class="hud__badge">${hudBadgeText}</div>
    <div class="hud__look" aria-live="polite"></div>
  </div>
  <div class="eyelids" aria-hidden="true" data-phase="open">
    <div class="eyelid eyelid--top"></div>
    <div class="eyelid eyelid--bottom"></div>
  </div>
  <div class="blackout" aria-hidden="true">
    <span class="blackout__message">resting in the dark</span>
  </div>
  <div class="underwater" aria-hidden="true"></div>
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
const temple = createTempleLandmark(scene, heightAt);
const fieldNotes = createFieldNotesState();
const fieldNotesHeading = document.querySelector<HTMLElement>(".hud__note-heading");
const fieldNotesBody = document.querySelector<HTMLElement>(".hud__note-body");
if (!fieldNotesHeading || !fieldNotesBody) {
  throw new Error("Missing field note HUD");
}
const fieldNotesHud = createFieldNotesHud(fieldNotesHeading, fieldNotesBody, fieldNotes);
const mountainBirds = createMountainBirds(scene, heightAt);
const birdDebugAnchor = mountainBirds.getState().nearestAnchor;
const oceanDebugSpawn = getOceanDebugSpawn();
const initialPlayerLocalPosition = enableTempleDebug
  ? new THREE.Vector3(temple.approachPosition.x, 0, temple.approachPosition.z)
  : isBeetleDebug
    ? new THREE.Vector3(4.8, 0, 14.2)
    : isBirdDebug
      ? new THREE.Vector3(birdDebugAnchor.x + 22, 0, birdDebugAnchor.z + 8)
      : enableOceanDebug
        ? new THREE.Vector3(oceanDebugSpawn.x, 0, oceanDebugSpawn.z)
        : enableIsolationDebug
          ? new THREE.Vector3(-128, 0, -464)
          : new THREE.Vector3(0, 0, 24);
const initialPlayerYaw = isBirdDebug
  ? Math.atan2(initialPlayerLocalPosition.x - birdDebugAnchor.x, initialPlayerLocalPosition.z - birdDebugAnchor.z)
  : enableOceanDebug
    ? oceanDebugSpawn.yaw
    : 0;
const initialPlayerPitch = isBirdDebug ? 0.18 : enableOceanDebug ? -0.05 : -0.12;
const player = {
  yaw: initialPlayerYaw,
  pitch: initialPlayerPitch,
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
const sleepFill = document.querySelector<HTMLDivElement>(".hud__sleep-fill");
const sleepStatus = document.querySelector<HTMLSpanElement>(".hud__sleep-status");
const eyelidOverlay = document.querySelector<HTMLDivElement>(".eyelids");
const blackoutOverlay = document.querySelector<HTMLDivElement>(".blackout");
const underwaterOverlay = document.querySelector<HTMLDivElement>(".underwater");

const collisionWorld = createCollisionWorld(normalizeLocalVector);
const sky = createSkySystem(scene, camera, isDemo);
const terrain = createTerrainSystem();
const oceans = createOceanSystem();
const mist = createMistSystem(scene, heightAt, isDemo);

scene.add(terrain.group);
scene.add(oceans.group);
scene.add(makeHorizonLandforms());
collisionWorld.addObstacle(temple.collision);

const { updateFloraReactivity, updateNatureChunks, getNatureState } = populateNature(
  scene,
  heightAt,
  collisionWorld.addObstacle,
  collisionWorld.replaceDynamicObstacles,
  [temple.reservedZone]
);
const waterCreatures = createAlienWaterCreatures(scene, heightAt, collisionWorld.obstacles);
const flyingBeetles = createRareFlyingBeetles(scene, heightAt, collisionWorld.obstacles);
const footsteps = createFootstepTrail(scene, heightAt, collisionWorld.isBlockedAt, (x, z) => oceanStateAt(x, z, heightAt).isInOcean);
const demoFloraFocus = new THREE.Vector3(9, 0, 18);
const visionState = {
  isolationAmount: 0,
  targetIsolationAmount: 0,
  nearestBiomePatchDistance: 0,
};
let isolationOverrideAmount: number | null = null;
const prDemo = createPrDemoController(camera, heightAt, collisionWorld.resolveMove, (position, delta) => {
  demoFloraFocus.copy(position);
  if (delta > 0) footsteps.walk(position, delta);
}, temple);

terrain.update(player.localPosition.x, player.localPosition.z);
oceans.update(player.localPosition.x, player.localPosition.z);
updateNatureChunks(player.localPosition.x, player.localPosition.z);
updatePlayerWorldPosition();

if (enableDebugTools) {
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
    getVisionState: () => ({ ...visionState }),
    setIsolationOverride: (amount: number | null) => {
      if (amount === null || !Number.isFinite(amount)) {
        isolationOverrideAmount = null;
        return;
      }

      const clamped = THREE.MathUtils.clamp(amount, 0, 1);
      isolationOverrideAmount = clamped;
      visionState.targetIsolationAmount = clamped;
      visionState.isolationAmount = clamped;
    },
    getTempleState: () => ({
      x: temple.position.x,
      z: temple.position.z,
      approachX: temple.approachPosition.x,
      approachZ: temple.approachPosition.z,
      noteX: temple.noteSource.position.x,
      noteZ: temple.noteSource.position.z,
      noteRadius: temple.noteSource.radius,
      influenceRadius: temple.influenceRadius,
      fullInfluenceRadius: temple.fullInfluenceRadius,
    }),
    getFieldNotesState: fieldNotes.getSnapshot,
    getSkyState: sky.getDebugState,
    setSkyElapsed: (elapsed: number) => {
      sky.update(elapsed, player.localPosition, temple.getInfluence(player.localPosition, elapsed));
      return sky.getDebugState();
    },
    getCreatureState: waterCreatures.getState,
    getBeetleState: flyingBeetles.getState,
    getMistState: () => {
      mist.update(clock.elapsedTime, player.localPosition);
      return mist.getDebugState();
    },
    getBirdState: mountainBirds.getState,
    getOceanState: () => oceanStateAt(player.localPosition.x, player.localPosition.z, heightAt),
    getOceanStateAt: (x: number, z: number) => oceanStateAt(x, z, heightAt),
    getOceanDebugState: () => getOceanDebugState(heightAt),
    getSleepState: sleep.getState,
    setSleepAmount: (amount: number) => {
      const state = sleep.setAmount(amount);
      updateSleepHud(state);
      return state;
    },
    advanceSleep: (delta: number, input: Partial<SleepUpdateInput> = {}) => {
      const moving = input.moving ?? hasMovementInput();
      const movementAmount = input.movementAmount ?? (moving ? 1 : 0);
      const grounded = input.grounded ?? player.grounded;
      const state = sleep.update(delta, {
        wantsSleep: input.wantsSleep ?? isSleepPressed(),
        moving,
        grounded,
        movementAmount,
        crouching: input.crouching ?? isCrouchPressed(),
        airborne: input.airborne ?? !grounded,
      });
      updateSleepHud(state);
      return state;
    },
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
      oceans.update(player.localPosition.x, player.localPosition.z);
      updateNatureChunks(player.localPosition.x, player.localPosition.z);
      sky.update(clock.elapsedTime, player.localPosition);
    },
    attemptMove: (x: number, z: number) => {
      collisionWorld.resolveMove(player.localPosition, new THREE.Vector3(x, 0, z));
      updatePlayerWorldPosition();
      terrain.update(player.localPosition.x, player.localPosition.z);
      oceans.update(player.localPosition.x, player.localPosition.z);
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

function clearTransientInputState(): void {
  keys.clear();
  player.jumpQueued = false;
}

updateLookStatus();

function updateSleepHud(state: SleepDebugState): void {
  if (sleepFill) sleepFill.style.width = `${Math.round(state.normalized * 100)}%`;
  if (sleepStatus) sleepStatus.textContent = state.message;
  eyelidOverlay?.style.setProperty("--eyelid-cover", `${(state.eyelidAmount * 54).toFixed(2)}%`);
  eyelidOverlay?.classList.toggle("eyelids--active", state.eyelidAmount > 0);
  eyelidOverlay?.setAttribute("data-phase", state.eyelidPhase);
  blackoutOverlay?.classList.toggle("blackout--visible", state.blackout);
  blackoutOverlay?.setAttribute("aria-hidden", state.blackout ? "false" : "true");
}

function updateUnderwaterCue(): void {
  if (!underwaterOverlay) return;
  const oceanState = oceanStateAt(player.localPosition.x, player.localPosition.z, heightAt);
  const cameraAltitude = playerSurfaceAltitude();
  const belowSurface = oceanState.waterSurfaceHeight - cameraAltitude;
  const amount = oceanState.isInOcean ? THREE.MathUtils.smoothstep(belowSurface, 0.05, 2.2) : 0;
  underwaterOverlay.style.opacity = amount.toFixed(3);
  underwaterOverlay.setAttribute("aria-hidden", amount > 0.02 ? "false" : "true");
}

updateSleepHud(sleep.getState());

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") {
    event.preventDefault();
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) player.jumpQueued = true;
  }
  void audio.resume();
  startAudio();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", clearTransientInputState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") clearTransientInputState();
});
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

function isSleepPressed(): boolean {
  return keys.has("KeyR");
}

function hasMovementInput(): boolean {
  return keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD");
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function isolationTargetForDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 1;
  return THREE.MathUtils.smoothstep(distance, 70, 132);
}

function updateVisionState(delta: number): void {
  const natureState = getNatureState();
  const targetIsolationAmount = isolationOverrideAmount ?? isolationTargetForDistance(natureState.nearestBiomePatchDistance);
  const fade = 1 - Math.exp(-delta * 0.92);
  visionState.targetIsolationAmount = targetIsolationAmount;
  visionState.nearestBiomePatchDistance = natureState.nearestBiomePatchDistance;
  visionState.isolationAmount = THREE.MathUtils.lerp(visionState.isolationAmount, targetIsolationAmount, fade);
}

function playerSurfaceAltitude(): number {
  return heightAt(player.localPosition.x, player.localPosition.z) + player.cameraHeight + player.verticalOffset;
}

function updatePlayerWorldPosition(): void {
  normalizeLocalVector(player.localPosition);
  player.position.copy(pointOnPlanet(player.localPosition.x, player.localPosition.z, playerSurfaceAltitude()));
}

function restPlayerInPlace(delta: number, targetHeight: number): void {
  player.velocity.set(0, 0, 0);
  player.verticalVelocity = 0;
  player.verticalOffset = 0;
  player.grounded = true;
  player.jumpQueued = false;
  player.cameraHeight = THREE.MathUtils.lerp(player.cameraHeight, targetHeight, 1 - Math.exp(-delta * 3.2));
  updatePlayerWorldPosition();
  setCameraOnPlanet(camera, player.localPosition.x, player.localPosition.z, playerSurfaceAltitude(), player.yaw, player.pitch);
}

function updateExploration(delta: number): { horizontalSpeed: number } {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const wish = new THREE.Vector3();

  if (keys.has("KeyW")) wish.add(forward.clone().multiplyScalar(-1));
  if (keys.has("KeyS")) wish.add(forward);
  if (keys.has("KeyA")) wish.add(right.clone().multiplyScalar(-1));
  if (keys.has("KeyD")) wish.add(right);

  if (wish.lengthSq() > 0) wish.normalize();
  const crouching = isCrouchPressed();
  const oceanState = oceanStateAt(player.localPosition.x, player.localPosition.z, heightAt);
  const targetSpeed = (crouching ? crouchSpeed : walkSpeed) * oceanState.movementSpeedMultiplier;
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

  return { horizontalSpeed: actualHorizontalSpeed };
}

function updateFieldNoteDiscovery(focus: { x: number; z: number }, elapsed: number): void {
  const source = temple.noteSource;
  if (surfaceDistanceBetweenLocal(focus, source.position) > source.radius) return;
  if (fieldNotes.discover(source.noteId, elapsed)) {
    fieldNotesHud.refresh();
  }
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const sleepBefore = sleep.getState();
  const movementIntent = hasMovementInput();
  const wantsSleep = isDemo ? sleepBefore.amount < 1 : isSleepPressed();
  let explorationMotion = { horizontalSpeed: 0 };

  if (isDemo) prDemo.update(elapsed, delta);
  else if (sleepBefore.blackout) restPlayerInPlace(delta, 0.52);
  else if (sleepBefore.sleeping && isSleepPressed() && !movementIntent) restPlayerInPlace(delta, 0.72);
  else explorationMotion = updateExploration(delta);

  const movementAmount = isDemo ? 0 : THREE.MathUtils.clamp(explorationMotion.horizontalSpeed / walkSpeed, 0, 1);
  const moving = isDemo ? false : movementIntent || explorationMotion.horizontalSpeed > 0.15;
  const grounded = isDemo || player.grounded;
  const sleepState = enableSleepDebug
    ? sleep.getState()
    : sleep.update(delta, {
        wantsSleep,
        moving,
        grounded,
        movementAmount,
        crouching: !isDemo && isCrouchPressed(),
        airborne: !grounded,
      });
  updateSleepHud(sleepState);

  footsteps.update(delta);
  temple.update(elapsed);
  const floraFocus = isDemo ? demoFloraFocus : player.localPosition;
  waterCreatures.update(elapsed, delta, floraFocus);
  flyingBeetles.update(elapsed, floraFocus);
  mountainBirds.update(elapsed, floraFocus);
  const templeFocus = isDemo ? { x: demoFloraFocus.x, z: demoFloraFocus.z } : player.localPosition;
  updateFieldNoteDiscovery(templeFocus, elapsed);
  sky.update(elapsed, floraFocus, temple.getInfluence(templeFocus, elapsed));
  terrain.update(floraFocus.x, floraFocus.z);
  oceans.update(floraFocus.x, floraFocus.z);
  updateNatureChunks(floraFocus.x, floraFocus.z);
  updateFloraReactivity(floraFocus, delta, elapsed);
  updateVisionState(delta);
  mist.update(elapsed, floraFocus);
  if (!isDemo) updateUnderwaterCue();

  pixelRenderer.render(scene, camera, {
    elapsed,
    isolationAmount: visionState.isolationAmount,
  });
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  pixelRenderer.resize(window.innerWidth, window.innerHeight);
});

animate();
