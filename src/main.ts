import * as THREE from "three";
import { createCollisionWorld, type CollisionObstacle } from "./collision";
import { createAlienWaterCreatures, createMountainBirds, createRareFlyingBeetles, type BirdDebugState } from "./creatures";
import { createPrDemoController } from "./demo";
import {
  createDiamondCrystalSystem,
  diamondBiomeStateAt,
  diamondGravityMultiplierAt,
  getDiamondBiomeDebugState,
  getDiamondDebugSpawn,
  type DiamondBiomeDebugState,
  type DiamondBiomeState,
} from "./diamond-biome";
import { createFieldNotesHud, createFieldNotesState, type FieldNoteId, type FieldNotesSnapshot } from "./field-notes";
import { createFootstepTrail } from "./footsteps";
import { createGlassDomeLandmark, createObservatoryLandmark, createTempleLandmark } from "./landmarks";
import { createMistSystem, type MistDebugState } from "./mist";
import { populateNature, type NaturePerfState } from "./nature";
import {
  normalizeLocalVector,
  normalizePlanetCoords,
  lookAtPlanetPoint,
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
import {
  createTerrainSystem,
  getMassiveMountainDebugState,
  heightAt,
  makeHorizonLandforms,
  massiveMountainReservedZones,
  terrainDownhillDirectionAt,
  terrainSlipperinessAt,
  terrainSlopeAt,
  type TerrainPerfState,
} from "./terrain";
import {
  createOceanSystem,
  getOceanDebugSpawn,
  getOceanDebugState,
  oceanStateAt,
  type OceanDebugState,
  type OceanPerfState,
  type OceanState,
} from "./water";
import "./style.css";

type ObservatoryDebugState = {
  x: number;
  z: number;
  approachX: number;
  approachZ: number;
  noteX: number;
  noteZ: number;
  noteRadius: number;
  telescopeUseX: number;
  telescopeUseZ: number;
  telescopeViewX: number;
  telescopeViewZ: number;
  telescopeInteractionRadius: number;
  telescopeYaw: number;
  telescopePitch: number;
  telescopeBaseYaw: number;
  telescopeBasePitch: number;
  telescopeActive: boolean;
  observatoryVisible: boolean;
  platformSamples: Array<{ x: number; z: number }>;
  platformSurfaceSamples: Array<{ x: number; z: number; terrainY: number; surfaceY: number }>;
  blockerSamples: Array<{ name: string; x: number; z: number }>;
  cameraFov: number;
  nearby: boolean;
  obstacleCount: number;
};

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
      getViewState: () => { yaw: number; pitch: number; mouseLookActive: boolean; telescopeActive: boolean; cameraFov: number };
      getMovementState: () => { grounded: boolean; crouching: boolean; cameraHeight: number; gravityMultiplier: number };
      getPerfState: () => {
        frameMs: number;
        fps: number;
        frameSamples: number;
        drawCalls: number;
        triangles: number;
        geometries: number;
        textures: number;
        sceneObjects: number;
        terrain: TerrainPerfState;
        nature: NaturePerfState;
        ocean: OceanPerfState;
      };
      getTimeState: () => {
        skyElapsed: number;
        domeTimeMultiplier: number;
        domeTargetTimeMultiplier: number;
        sleepTimeMultiplier: number;
        effectiveTimeMultiplier: number;
      };
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
        prismAmount: number;
        targetPrismAmount: number;
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
      getDomeState: () => {
        x: number;
        z: number;
        radius: number;
        interiorRadius: number;
        floorHeight: number;
        shellThickness: number;
        entranceHalfWidth: number;
        entranceSillTopHeight: number;
        visualEntranceGapHalfWidth: number;
        visualRingGapHalfWidth: number;
        baseCollarGapHalfWidth: number;
        entranceDirectionX: number;
        entranceDirectionZ: number;
        entranceX: number;
        entranceZ: number;
        approachX: number;
        approachZ: number;
        noteX: number;
        noteZ: number;
        noteRadius: number;
        inside: boolean;
        entranceClearance: number;
        groundingBandWidth: number;
        groundingFlatRadius: number;
        groundingOuterRadius: number;
        timeMultiplier: number;
        targetTimeMultiplier: number;
      };
      getObservatoryState: () => ObservatoryDebugState;
      enterTelescope: () => ObservatoryDebugState;
      exitTelescope: () => ObservatoryDebugState;
      panTelescope: (yawDelta: number, pitchDelta: number) => ObservatoryDebugState;
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
      getMassiveMountainState: () => {
        center: { x: number; z: number };
        base: { x: number; z: number; height: number };
        peak: { x: number; z: number; height: number };
        normalMountainPeakHeight: number;
        mountainRise: number;
        pathSamples: { x: number; z: number; progress: number; width: number; height: number }[];
        steepFaceSamples: { x: number; z: number; height: number; slope: number; slipperiness: number; downhillX: number; downhillZ: number }[];
        reservedZones: { x: number; z: number; radius: number }[];
      };
      getOceanState: () => OceanState;
      getOceanStateAt: (x: number, z: number) => OceanState;
      getOceanDebugState: () => OceanDebugState;
      getDiamondBiomeState: () => DiamondBiomeDebugState;
      getDiamondBiomeStateAt: (x: number, z: number) => DiamondBiomeState;
      gravityMultiplierAt: (x: number, z: number) => number;
      getSleepState: () => SleepDebugState;
      setSleepAmount: (amount: number) => SleepDebugState;
      advanceSleep: (delta: number, input?: Partial<SleepUpdateInput>) => SleepDebugState;
      advanceGameTime: (
        delta: number,
        input?: Partial<SleepUpdateInput>
      ) => {
        sleep: SleepDebugState;
        sky: SkyDebugState;
        time: {
          skyElapsed: number;
          domeTimeMultiplier: number;
          domeTargetTimeMultiplier: number;
          sleepTimeMultiplier: number;
          effectiveTimeMultiplier: number;
        };
      };
      getSkyState: () => SkyDebugState;
      setSkyElapsed: (elapsed: number) => SkyDebugState;
      setPlayer: (x: number, z: number) => void;
      attemptMove: (x: number, z: number) => { x: number; y: number; z: number };
      isBlockedAt: (x: number, z: number) => boolean;
      surfaceHeightAt: (x: number, z: number) => number;
      terrainSlopeAt: (x: number, z: number) => number;
      terrainSlipperinessAt: (x: number, z: number) => number;
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
const enableDomeDebug = params.get("debug") === "dome";
const enableObservatoryDebug = params.get("debug") === "observatory";
const enableTelescopeDebug = params.get("debug") === "telescope";
const isBeetleDebug = params.get("debug") === "beetle";
const isBirdDebug = params.get("debug") === "birds";
const enableMountainDebug = params.get("debug") === "mountain";
const enableOceanDebug = params.get("debug") === "ocean";
const diamondDebugRoute = params.get("debug");
const diamondDebugName =
  diamondDebugRoute === "diamond2" || diamondDebugRoute === "diamond3" ? diamondDebugRoute : "diamond";
const enableDiamondDebug =
  diamondDebugRoute === "diamond" ||
  diamondDebugRoute === "crystals" ||
  diamondDebugRoute === "diamond2" ||
  diamondDebugRoute === "diamond3";
const enableCollisionDebug = params.get("test") === "collision";
const enableSleepDebug = params.get("test") === "sleep";
const enableIsolationDebug = params.get("debug") === "isolation" || params.get("test") === "isolation";
const enablePerfDebug = params.get("debug") === "perf" || params.get("test") === "perf";
const enableDebugTools =
  enableCollisionDebug ||
  enableTempleDebug ||
  enableDomeDebug ||
  enableObservatoryDebug ||
  enableTelescopeDebug ||
  isBeetleDebug ||
  isBirdDebug ||
  enableMountainDebug ||
  enableOceanDebug ||
  enableDiamondDebug ||
  enableSleepDebug ||
  enableIsolationDebug ||
  enablePerfDebug;
const standHeight = 1.65;
const crouchHeight = 0.96;
const walkSpeed = PLANET_ASSUMED_WALK_SPEED;
const crouchSpeed = 2.9;
const acceleration = 19;
const braking = 24;
const gravity = 17.8;
const jumpImpulse = 7.2;
const mouseLookSensitivity = 0.0024;
const normalCameraFov = 68;
const telescopeCameraFov = 26;
const maxGroundedStepDistance = 0.9;
const maxGroundedStepRise = 0.82;
const hudBadgeText = isDemo
  ? "PR demo mode"
  : enableTempleDebug
    ? "temple debug"
    : enableDomeDebug
      ? "dome debug"
      : enableObservatoryDebug
        ? "observatory debug"
        : enableTelescopeDebug
          ? "telescope debug"
          : isBeetleDebug
            ? "beetle debug"
            : isBirdDebug
              ? "birds debug"
              : enableMountainDebug
                ? "mountain debug"
                : enableOceanDebug
                  ? "ocean debug"
                  : enableDiamondDebug
                    ? `${diamondDebugName} debug`
                    : enableSleepDebug
                      ? "sleep debug"
                      : enableIsolationDebug
                        ? "isolation debug"
                        : enablePerfDebug
                          ? "perf debug"
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
	  <div class="telescope-scope" aria-hidden="true">
	    <div class="telescope-scope__ring"></div>
	    <div class="telescope-scope__cross telescope-scope__cross--vertical"></div>
	    <div class="telescope-scope__cross telescope-scope__cross--horizontal"></div>
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
renderer.info.autoReset = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Centauri exploration view");
app.appendChild(renderer.domElement);
const pixelRenderer = createPixelRenderPipeline(renderer, window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(normalCameraFov, window.innerWidth / window.innerHeight, 0.1, 5200);

const clock = new THREE.Clock();
const keys = new Set<string>();
const temple = createTempleLandmark(scene, heightAt);
const dome = createGlassDomeLandmark(scene, heightAt, [temple.reservedZone, ...massiveMountainReservedZones]);
const observatory = createObservatoryLandmark(scene, heightAt, [temple.reservedZone, dome.reservedZone, ...massiveMountainReservedZones]);
const domeFloorColour = new THREE.Color(0x273c78);
const domeGroundingBandWidth = 16;
const domeGroundingFlatShoulder = 0.25;
const fieldNoteSources: Array<{ noteId: FieldNoteId; position: { x: number; z: number }; radius: number }> = [
  temple.noteSource,
  dome.noteSource,
  observatory.noteSource,
];
const fieldNotes = createFieldNotesState();
const fieldNotesHeading = document.querySelector<HTMLElement>(".hud__note-heading");
const fieldNotesBody = document.querySelector<HTMLElement>(".hud__note-body");
if (!fieldNotesHeading || !fieldNotesBody) {
  throw new Error("Missing field note HUD");
}
const fieldNotesHud = createFieldNotesHud(fieldNotesHeading, fieldNotesBody, fieldNotes);
const mountainBirds = createMountainBirds(scene, heightAt);
const birdDebugAnchor = mountainBirds.getState().nearestAnchor;
const mountainDebugState = getMassiveMountainDebugState();
const oceanDebugSpawn = getOceanDebugSpawn();
const diamondDebugSpawn = getDiamondDebugSpawn(diamondDebugName);

function getInitialPlayerLocalPosition(): THREE.Vector3 {
  if (enableTempleDebug) return new THREE.Vector3(temple.approachPosition.x, 0, temple.approachPosition.z);
  if (enableDomeDebug) return new THREE.Vector3(dome.approachPosition.x, 0, dome.approachPosition.z);
  if (enableTelescopeDebug) return new THREE.Vector3(observatory.telescope.usePosition.x, 0, observatory.telescope.usePosition.z);
  if (enableObservatoryDebug) return new THREE.Vector3(observatory.approachPosition.x, 0, observatory.approachPosition.z);
  if (isBeetleDebug) return new THREE.Vector3(4.8, 0, 14.2);
  if (isBirdDebug) return new THREE.Vector3(birdDebugAnchor.x + 22, 0, birdDebugAnchor.z + 8);
  if (enableMountainDebug) return new THREE.Vector3(mountainDebugState.base.x, 0, mountainDebugState.base.z);
  if (enableOceanDebug) return new THREE.Vector3(oceanDebugSpawn.x, 0, oceanDebugSpawn.z);
  if (enableDiamondDebug) return new THREE.Vector3(diamondDebugSpawn.x, 0, diamondDebugSpawn.z);
  if (enableIsolationDebug) return new THREE.Vector3(-128, 0, -464);
  return new THREE.Vector3(0, 0, 24);
}

const initialPlayerLocalPosition = getInitialPlayerLocalPosition();
const initialPlayerYaw = enableTelescopeDebug
  ? observatory.telescope.yaw
  : enableObservatoryDebug
    ? Math.atan2(
        initialPlayerLocalPosition.x - observatory.position.x,
        initialPlayerLocalPosition.z - observatory.position.z
      )
    : isBirdDebug
      ? Math.atan2(initialPlayerLocalPosition.x - birdDebugAnchor.x, initialPlayerLocalPosition.z - birdDebugAnchor.z)
      : enableDomeDebug
        ? Math.atan2(-dome.entranceDirection.x, -dome.entranceDirection.z)
        : enableMountainDebug
          ? Math.atan2(initialPlayerLocalPosition.x - mountainDebugState.center.x, initialPlayerLocalPosition.z - mountainDebugState.center.z)
          : enableOceanDebug
            ? oceanDebugSpawn.yaw
            : enableDiamondDebug
              ? diamondDebugSpawn.yaw
            : 0;
const initialPlayerPitch = enableTelescopeDebug
  ? observatory.telescope.pitch
  : enableDomeDebug
    ? -0.36
    : enableObservatoryDebug
      ? -0.08
      : isBirdDebug
        ? 0.18
        : enableMountainDebug
          ? 0.08
          : enableOceanDebug
            ? -0.05
            : enableDiamondDebug
              ? 0.2
              : -0.12;
const player = {
  yaw: initialPlayerYaw,
  pitch: initialPlayerPitch,
  localPosition: initialPlayerLocalPosition.clone(),
  position: pointOnPlanet(
    initialPlayerLocalPosition.x,
    initialPlayerLocalPosition.z,
    effectiveHeightAt(initialPlayerLocalPosition.x, initialPlayerLocalPosition.z) + standHeight
  ),
  velocity: new THREE.Vector3(),
  verticalVelocity: 0,
  verticalOffset: 0,
  cameraHeight: standHeight,
  grounded: true,
  jumpQueued: false,
};
let mouseLookActive = false;
const telescopeMode = {
  active: false,
  yaw: observatory.telescope.yaw,
  pitch: observatory.telescope.pitch,
  previousYaw: initialPlayerYaw,
  previousPitch: initialPlayerPitch,
  previousObservatoryVisible: observatory.group.visible,
};
const lookStatus = document.querySelector<HTMLDivElement>(".hud__look");
const sleepFill = document.querySelector<HTMLDivElement>(".hud__sleep-fill");
const sleepStatus = document.querySelector<HTMLSpanElement>(".hud__sleep-status");
const eyelidOverlay = document.querySelector<HTMLDivElement>(".eyelids");
const blackoutOverlay = document.querySelector<HTMLDivElement>(".blackout");
const telescopeScope = document.querySelector<HTMLDivElement>(".telescope-scope");
const underwaterOverlay = document.querySelector<HTMLDivElement>(".underwater");
if (telescopeMode.active) {
  observatory.group.visible = false;
  telescopeScope?.classList.add("telescope-scope--active");
  telescopeScope?.setAttribute("aria-hidden", "false");
}

const collisionWorld = createCollisionWorld(normalizeLocalVector);
const sky = createSkySystem(scene, camera, isDemo);
const terrain = createTerrainSystem(effectiveHeightAt, terrainColourOverride);
const oceans = createOceanSystem();
const diamondCrystals = createDiamondCrystalSystem(heightAt);
const mist = createMistSystem(scene, effectiveHeightAt, isDemo);

scene.add(terrain.group);
scene.add(oceans.group);
scene.add(diamondCrystals.group);
scene.add(makeHorizonLandforms());
collisionWorld.addObstacle(temple.collision);
collisionWorld.addObstacle(dome.collision);
collisionWorld.addObstacle(observatory.collision);

const { updateFloraReactivity, updateNatureChunks, getNatureState, getNaturePerfState } = populateNature(
  scene,
  effectiveHeightAt,
  collisionWorld.addObstacle,
  collisionWorld.replaceDynamicObstacles,
  [temple.reservedZone, dome.reservedZone, observatory.reservedZone, ...massiveMountainReservedZones]
);
const waterCreatures = createAlienWaterCreatures(scene, effectiveHeightAt, collisionWorld.obstacles);
const flyingBeetles = createRareFlyingBeetles(scene, effectiveHeightAt, collisionWorld.obstacles);
const footsteps = createFootstepTrail(scene, effectiveHeightAt, collisionWorld.isBlockedAt, (x, z) => oceanStateAt(x, z, heightAt).isInOcean);
const demoFloraFocus = new THREE.Vector3(9, 0, 18);
const telescopeFloraFocus = new THREE.Vector3();
const visionState = {
  isolationAmount: 0,
  targetIsolationAmount: 0,
  nearestBiomePatchDistance: 0,
  prismAmount: 0,
  targetPrismAmount: 0,
};
const perfState = {
  smoothedFrameMs: 0,
  frameSamples: 0,
};
let isolationOverrideAmount: number | null = enableDomeDebug ? 0 : null;
const prDemo = createPrDemoController(camera, effectiveHeightAt, resolvePlayerMove, (position, delta) => {
  demoFloraFocus.copy(position);
  if (delta > 0) footsteps.walk(position, delta);
}, temple, dome, observatory, mountainDebugState);
let skyElapsed = clock.elapsedTime;
let domeTimeMultiplier = 1;
let domeTargetTimeMultiplier = 1;
let sleepTimeMultiplier = 1;
let effectiveTimeMultiplier = 1;

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
	      yaw: telescopeMode.active ? telescopeMode.yaw : player.yaw,
	      pitch: telescopeMode.active ? telescopeMode.pitch : player.pitch,
	      mouseLookActive,
	      telescopeActive: telescopeMode.active,
	      cameraFov: camera.fov,
	    }),
    getMovementState: () => ({
      grounded: player.grounded,
      crouching: isCrouchPressed(),
      cameraHeight: player.cameraHeight,
      gravityMultiplier: diamondGravityMultiplierAt(player.localPosition.x, player.localPosition.z),
    }),
    getPerfState: () => {
      let sceneObjects = 0;
      scene.traverse(() => {
        sceneObjects += 1;
      });
      const frameMs = perfState.smoothedFrameMs;
      return {
        frameMs,
        fps: frameMs > 0 ? 1000 / frameMs : 0,
        frameSamples: perfState.frameSamples,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        sceneObjects,
        terrain: terrain.getTerrainPerfState(),
        nature: getNaturePerfState(),
        ocean: oceans.getOceanPerfState(),
      };
    },
    getTimeState: () => ({
      skyElapsed,
      domeTimeMultiplier,
      domeTargetTimeMultiplier,
      sleepTimeMultiplier,
      effectiveTimeMultiplier,
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
	    getDomeState: () => ({
      x: dome.position.x,
      z: dome.position.z,
      radius: dome.radius,
      interiorRadius: dome.interiorRadius,
      floorHeight: dome.floorHeight,
      shellThickness: dome.shellThickness,
      entranceHalfWidth: dome.entranceHalfWidth,
      entranceSillTopHeight: dome.entranceSillTopHeight,
      visualEntranceGapHalfWidth: dome.visualEntranceGapHalfWidth,
      visualRingGapHalfWidth: dome.visualRingGapHalfWidth,
      baseCollarGapHalfWidth: dome.baseCollarGapHalfWidth,
      entranceDirectionX: dome.entranceDirection.x,
      entranceDirectionZ: dome.entranceDirection.z,
      entranceX: dome.entrancePosition.x,
      entranceZ: dome.entrancePosition.z,
      approachX: dome.approachPosition.x,
      approachZ: dome.approachPosition.z,
      noteX: dome.noteSource.position.x,
      noteZ: dome.noteSource.position.z,
      noteRadius: dome.noteSource.radius,
      inside: dome.contains(player.localPosition),
      entranceClearance: dome.entranceClearanceAt(player.localPosition),
      groundingBandWidth: domeGroundingBandWidth,
      groundingFlatRadius: dome.radius + domeGroundingFlatShoulder,
      groundingOuterRadius: dome.radius + domeGroundingBandWidth,
      timeMultiplier: domeTimeMultiplier,
	      targetTimeMultiplier: domeTargetTimeMultiplier,
	    }),
	    getObservatoryState: getObservatoryDebugState,
	    enterTelescope: () => {
	      enterTelescopeMode(true);
	      return getObservatoryDebugState();
	    },
	    exitTelescope: () => {
	      exitTelescopeMode(false);
	      return getObservatoryDebugState();
	    },
	    panTelescope: (yawDelta, pitchDelta) => {
	      if (!telescopeMode.active) enterTelescopeMode(true);
	      setTelescopeLook(telescopeMode.yaw + yawDelta, telescopeMode.pitch + pitchDelta);
	      updateTelescopeCamera();
	      return getObservatoryDebugState();
	    },
	    getFieldNotesState: fieldNotes.getSnapshot,
    getSkyState: sky.getDebugState,
    setSkyElapsed: (elapsed: number) => {
      skyElapsed = elapsed;
      updateDomeTimeMultiplier(0, player.localPosition);
      sky.update(skyElapsed, player.localPosition, temple.getInfluence(player.localPosition, elapsed));
      return sky.getDebugState();
    },
    getCreatureState: waterCreatures.getState,
    getBeetleState: flyingBeetles.getState,
    getMistState: () => {
      mist.update(clock.elapsedTime, player.localPosition);
      return mist.getDebugState();
    },
    getBirdState: mountainBirds.getState,
    getMassiveMountainState: getMassiveMountainDebugState,
    getOceanState: () => oceanStateAt(player.localPosition.x, player.localPosition.z, heightAt),
    getOceanStateAt: (x: number, z: number) => oceanStateAt(x, z, heightAt),
    getOceanDebugState: () => getOceanDebugState(heightAt),
    getDiamondBiomeState: () => getDiamondBiomeDebugState(diamondCrystals.getRenderState(), player.localPosition),
    getDiamondBiomeStateAt: (x: number, z: number) => diamondBiomeStateAt(x, z),
    gravityMultiplierAt: (x: number, z: number) => diamondGravityMultiplierAt(x, z),
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
    advanceGameTime: (delta: number, input: Partial<SleepUpdateInput> = {}) => {
      const moving = input.moving ?? hasMovementInput();
      const movementAmount = input.movementAmount ?? (moving ? 1 : 0);
      const grounded = input.grounded ?? player.grounded;
      const wantsSleep = input.wantsSleep ?? isSleepPressed();
      const sleepState = sleep.update(delta, {
        wantsSleep,
        moving,
        grounded,
        movementAmount,
        crouching: input.crouching ?? isCrouchPressed(),
        airborne: input.airborne ?? !grounded,
      });
      updateSleepHud(sleepState);
      const activeDomeTimeMultiplier = updateDomeTimeMultiplier(delta, player.localPosition);
      sleepTimeMultiplier = getSleepTimeMultiplier(sleepState);
      effectiveTimeMultiplier = activeDomeTimeMultiplier * sleepTimeMultiplier;
      skyElapsed += delta * effectiveTimeMultiplier;
      sky.update(skyElapsed, player.localPosition, temple.getInfluence(player.localPosition, skyElapsed));
      dome.update(clock.elapsedTime, activeDomeTimeMultiplier);
      return { sleep: sleepState, sky: sky.getDebugState(), time: window.__centauriDebug!.getTimeState() };
    },
	    setPlayer: (x: number, z: number) => {
	      if (telescopeMode.active) exitTelescopeMode(false);
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
      diamondCrystals.update(player.localPosition.x, player.localPosition.z, clock.elapsedTime);
      updateNatureChunks(player.localPosition.x, player.localPosition.z);
      updateDomeTimeMultiplier(0, player.localPosition);
	      sky.update(skyElapsed, player.localPosition);
	      updateLookStatus();
	    },
	    attemptMove: (x: number, z: number) => {
	      if (telescopeMode.active) {
	        return { x: player.localPosition.x, y: player.position.length() - PLANET_RADIUS, z: player.localPosition.z };
	      }
	      resolvePlayerMove(player.localPosition, new THREE.Vector3(x, 0, z));
      updatePlayerWorldPosition();
      terrain.update(player.localPosition.x, player.localPosition.z);
      oceans.update(player.localPosition.x, player.localPosition.z);
      diamondCrystals.update(player.localPosition.x, player.localPosition.z, clock.elapsedTime);
      updateNatureChunks(player.localPosition.x, player.localPosition.z);
      updateLookStatus();
      return { x: player.localPosition.x, y: player.position.length() - PLANET_RADIUS, z: player.localPosition.z };
    },
    isBlockedAt: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      return collisionWorld.isBlockedAt(normalized.x, normalized.z);
    },
    surfaceHeightAt: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      return effectiveHeightAt(normalized.x, normalized.z);
    },
    terrainSlopeAt: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      return terrainSlopeAt(normalized.x, normalized.z);
    },
    terrainSlipperinessAt: (x: number, z: number) => {
      const normalized = normalizePlanetCoords(x, z);
      return terrainSlipperinessAt(normalized.x, normalized.z);
    },
    terrainHeightAt: effectiveHeightAt,
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
  if (isDemo) {
    lookStatus.textContent = "";
    return;
  }
  if (telescopeMode.active) {
    lookStatus.textContent = "telescope: E or Esc to exit";
    return;
  }
  if (isNearTelescope()) {
    lookStatus.textContent = "E telescope";
    return;
  }
  lookStatus.textContent = mouseLookActive ? "mouse locked" : "click to lock";
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
  void audio.resume();
  startAudio();
  if (event.code === "KeyE") {
    if (telescopeMode.active) {
      event.preventDefault();
      exitTelescopeMode(true);
      return;
    }
    if (isNearTelescope()) {
      event.preventDefault();
      enterTelescopeMode();
      return;
    }
  }
  if (event.code === "Escape" && telescopeMode.active) {
    event.preventDefault();
    exitTelescopeMode(true);
    return;
  }
  if (telescopeMode.active) {
    if (isMovementControlCode(event.code) || event.code === "Space" || event.code === "KeyR") {
      event.preventDefault();
    }
    return;
  }
  keys.add(event.code);
  if (event.code === "KeyR") {
    event.preventDefault();
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) player.jumpQueued = true;
  }
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
  if (telescopeMode.active) {
    if (document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock();
    } else {
      requestPointerLockForView();
    }
    return;
  }
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
    return;
  }
  requestPointerLockForView();
});
document.addEventListener("pointerlockchange", () => {
  mouseLookActive = document.pointerLockElement === renderer.domElement;
  if (telescopeMode.active && !mouseLookActive) {
    exitTelescopeMode(false);
  }
  updateLookStatus();
});
document.addEventListener("mousemove", (event) => {
  if (!mouseLookActive || isDemo) return;
  if (telescopeMode.active) {
    setTelescopeLook(
      telescopeMode.yaw - event.movementX * mouseLookSensitivity,
      telescopeMode.pitch - event.movementY * mouseLookSensitivity
    );
    return;
  }
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

function isMovementControlCode(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyS" ||
    code === "KeyA" ||
    code === "KeyD" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "KeyC"
  );
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

const movementForward = new THREE.Vector3();
const movementRight = new THREE.Vector3();
const movementWish = new THREE.Vector3();
const movementDelta = new THREE.Vector3();
const movementBeforeLocal = new THREE.Vector3();

function isolationTargetForDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 1;
  return THREE.MathUtils.smoothstep(distance, 70, 132);
}

function updateVisionState(delta: number, focus: { x: number; z: number }): void {
  const natureState = getNatureState();
  const targetIsolationAmount = isolationOverrideAmount ?? isolationTargetForDistance(natureState.nearestBiomePatchDistance);
  const targetPrismAmount = diamondBiomeStateAt(focus.x, focus.z).activeAmount;
  const fade = 1 - Math.exp(-delta * 0.92);
  const prismFade = 1 - Math.exp(-delta * 2.4);
  visionState.targetIsolationAmount = targetIsolationAmount;
  visionState.targetPrismAmount = targetPrismAmount;
  visionState.nearestBiomePatchDistance = natureState.nearestBiomePatchDistance;
  visionState.isolationAmount = THREE.MathUtils.lerp(visionState.isolationAmount, targetIsolationAmount, fade);
  visionState.prismAmount = THREE.MathUtils.lerp(visionState.prismAmount, targetPrismAmount, prismFade);
}

function updateDomeTimeMultiplier(delta: number, focus: { x: number; z: number }): number {
  domeTargetTimeMultiplier = dome.contains(focus) ? 4 : 1;
  if (delta <= 0) {
    domeTimeMultiplier = domeTargetTimeMultiplier;
    return domeTimeMultiplier;
  }
  domeTimeMultiplier = THREE.MathUtils.lerp(domeTimeMultiplier, domeTargetTimeMultiplier, 1 - Math.exp(-delta * 1.85));
  return domeTimeMultiplier;
}

function getSleepTimeMultiplier(state: SleepDebugState): number {
  return state.sleeping ? 8 : 1;
}

function effectiveHeightAt(x: number, z: number): number {
  const platformHeight = observatory.platformSurfaceHeightAt(x, z);
  if (platformHeight !== null) return platformHeight;
  const baseHeight = heightAt(x, z);
  if (dome.contains({ x, z })) return dome.floorHeight;

  const groundingAmount = Math.max(domeEntranceRampAmountAt(x, z), domeRimGroundingAmountAt(x, z));
  if (groundingAmount > 0) return THREE.MathUtils.lerp(baseHeight, dome.floorHeight, groundingAmount);
  return baseHeight;
}

function terrainColourOverride(x: number, z: number, _y: number): THREE.Color | null {
  return dome.contains({ x, z }) || Math.max(domeEntranceRampAmountAt(x, z), domeRimGroundingAmountAt(x, z)) > 0.35
    ? domeFloorColour
    : null;
}

function domeRimGroundingAmountAt(x: number, z: number): number {
  const distance = surfaceDistanceBetweenLocal({ x, z }, dome.position);
  if (distance <= dome.interiorRadius || distance >= dome.radius + domeGroundingBandWidth) return 0;
  if (distance <= dome.radius + domeGroundingFlatShoulder) return 1;
  return 1 - THREE.MathUtils.smoothstep(distance, dome.radius + domeGroundingFlatShoulder, dome.radius + domeGroundingBandWidth);
}

function domeEntranceRampAmountAt(x: number, z: number): number {
  const dx = x - dome.position.x;
  const dz = z - dome.position.z;
  const alongEntrance = dx * dome.entranceDirection.x + dz * dome.entranceDirection.z;
  const crossEntrance = Math.abs(dx * dome.entranceDirection.z - dz * dome.entranceDirection.x);
  const corridorHalfWidth = dome.entranceHalfWidth + 4.5;
  if (crossEntrance > corridorHalfWidth) return 0;

  const outerRamp = dome.radius + 18;
  const flatRamp = dome.radius + domeGroundingFlatShoulder;
  const alongAmount = alongEntrance <= flatRamp ? 1 : 1 - THREE.MathUtils.smoothstep(alongEntrance, flatRamp, outerRamp);
  const widthAmount = 1 - THREE.MathUtils.smoothstep(crossEntrance, dome.entranceHalfWidth, corridorHalfWidth);
  return THREE.MathUtils.clamp(alongAmount * widthAmount, 0, 1);
}

function playerSurfaceAltitude(): number {
  return effectiveHeightAt(player.localPosition.x, player.localPosition.z) + player.cameraHeight + player.verticalOffset;
}

function updatePlayerWorldPosition(): void {
  normalizeLocalVector(player.localPosition);
  player.position.copy(pointOnPlanet(player.localPosition.x, player.localPosition.z, playerSurfaceAltitude()));
}

function resolvePlayerMove(position: THREE.Vector3, movement: THREE.Vector3): void {
  if (movement.length() > 64) {
    collisionWorld.resolveMove(position, movement);
    return;
  }

  const stepCount = Math.max(1, Math.ceil(movement.length() / maxGroundedStepDistance));
  const step = movement.clone().multiplyScalar(1 / stepCount);
  for (let i = 0; i < stepCount; i += 1) {
    resolvePlayerMoveStep(position, movementWithTerrainSlip(position, step));
  }
}

function resolvePlayerMoveStep(position: THREE.Vector3, movement: THREE.Vector3): void {
  const candidate = position.clone();
  candidate.x += movement.x;
  normalizeLocalVector(candidate);
  if (canMoveAcrossTerrainStep(position, candidate)) {
    position.x = candidate.x;
    position.z = candidate.z;
  }

  candidate.copy(position);
  candidate.z += movement.z;
  normalizeLocalVector(candidate);
  if (canMoveAcrossTerrainStep(position, candidate)) {
    position.x = candidate.x;
    position.z = candidate.z;
  }
}

function canMoveAcrossTerrainStep(from: THREE.Vector3, to: THREE.Vector3): boolean {
  if (collisionWorld.isBlockedAt(to.x, to.z)) return false;
  const rise = effectiveHeightAt(to.x, to.z) - effectiveHeightAt(from.x, from.z);
  if (rise <= maxGroundedStepRise) return true;

  const distance = Math.max(Math.hypot(to.x - from.x, to.z - from.z), 0.001);
  const slope = rise / distance;
  const slipperiness = Math.max(terrainSlipperinessAt(from.x, from.z), terrainSlipperinessAt(to.x, to.z));
  return slope < 0.62 && slipperiness < 0.18;
}

function movementWithTerrainSlip(position: THREE.Vector3, movement: THREE.Vector3): THREE.Vector3 {
  const slipperiness = terrainSlipperinessAt(position.x, position.z);
  const movementLength = movement.length();
  if (slipperiness <= 0 || movementLength < 0.001) return movement;

  const downhill = terrainDownhillDirectionAt(position.x, position.z);
  const downhillVector = new THREE.Vector3(downhill.x, 0, downhill.z);
  if (downhillVector.lengthSq() <= 0.0001) return movement;

  const adjusted = movement.clone();
  const uphillDirection = downhillVector.clone().multiplyScalar(-1);
  const uphillAmount = Math.max(0, adjusted.dot(uphillDirection));
  if (uphillAmount > 0) {
    adjusted.add(downhillVector.clone().multiplyScalar(uphillAmount * slipperiness * 0.82));
  }

  const uphillRatio = uphillAmount / movementLength;
  const tractionLoss = movementLength * slipperiness * (0.06 + uphillRatio * 0.22);
  adjusted.add(downhillVector.multiplyScalar(tractionLoss));
  return adjusted;
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

function setCameraFov(fov: number): void {
  if (Math.abs(camera.fov - fov) < 0.01) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function isNearTelescope(focus: { x: number; z: number } = player.localPosition): boolean {
  return surfaceDistanceBetweenLocal(focus, observatory.telescope.usePosition) <= observatory.telescope.interactionRadius;
}

function enterTelescopeMode(force = false): boolean {
  if (telescopeMode.active) return true;
  if (!force && !isNearTelescope()) return false;

  telescopeMode.active = true;
  telescopeMode.previousYaw = player.yaw;
  telescopeMode.previousPitch = player.pitch;
  telescopeMode.previousObservatoryVisible = observatory.group.visible;
  telescopeMode.yaw = observatory.telescope.yaw;
  telescopeMode.pitch = observatory.telescope.pitch;
  observatory.group.visible = false;
  player.velocity.set(0, 0, 0);
  player.verticalVelocity = 0;
  player.verticalOffset = 0;
  player.grounded = true;
  clearTransientInputState();
  telescopeScope?.classList.add("telescope-scope--active");
  telescopeScope?.setAttribute("aria-hidden", "false");
  renderer.domElement.focus();
  requestPointerLockForView();
  updateTelescopeCamera();
  updateLookStatus();
  return true;
}

function exitTelescopeMode(releasePointerLock: boolean): void {
  if (!telescopeMode.active) return;
  telescopeMode.active = false;
  player.yaw = telescopeMode.previousYaw;
  player.pitch = telescopeMode.previousPitch;
  observatory.group.visible = telescopeMode.previousObservatoryVisible;
  clearTransientInputState();
  telescopeScope?.classList.remove("telescope-scope--active");
  telescopeScope?.setAttribute("aria-hidden", "true");
  setCameraFov(normalCameraFov);
  updatePlayerWorldPosition();
  if (releasePointerLock && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  updateLookStatus();
}

function requestPointerLockForView(): void {
  if (document.pointerLockElement === renderer.domElement) return;
  const pointerLockRequest = renderer.domElement.requestPointerLock();
  if (pointerLockRequest) {
    pointerLockRequest.catch(() => updateLookStatus());
  }
}

function shortestAngleDelta(from: number, to: number): number {
  const fullTurn = Math.PI * 2;
  return THREE.MathUtils.euclideanModulo(to - from + Math.PI, fullTurn) - Math.PI;
}

function setTelescopeLook(yaw: number, pitch: number): void {
  const yawLimit = 0.95;
  const yawDelta = THREE.MathUtils.clamp(shortestAngleDelta(observatory.telescope.yaw, yaw), -yawLimit, yawLimit);
  telescopeMode.yaw = observatory.telescope.yaw + yawDelta;
  telescopeMode.pitch = THREE.MathUtils.clamp(pitch, -0.08, 0.76);
}

function updateTelescopeCamera(): void {
  setCameraFov(telescopeCameraFov);
  setCameraOnPlanet(
    camera,
    observatory.telescope.viewPosition.x,
    observatory.telescope.viewPosition.z,
    observatory.telescope.viewHeight,
    telescopeMode.yaw,
    telescopeMode.pitch
  );
}

function updateTelescopeMode(): { horizontalSpeed: number } {
  player.velocity.set(0, 0, 0);
  player.verticalVelocity = 0;
  player.verticalOffset = 0;
  player.grounded = true;
  player.jumpQueued = false;
  player.cameraHeight = standHeight;
  updatePlayerWorldPosition();
  updateTelescopeCamera();
  return { horizontalSpeed: 0 };
}

function getObservatoryDebugState(): ObservatoryDebugState {
  return {
    x: observatory.position.x,
    z: observatory.position.z,
    approachX: observatory.approachPosition.x,
    approachZ: observatory.approachPosition.z,
    noteX: observatory.noteSource.position.x,
    noteZ: observatory.noteSource.position.z,
    noteRadius: observatory.noteSource.radius,
    telescopeUseX: observatory.telescope.usePosition.x,
    telescopeUseZ: observatory.telescope.usePosition.z,
    telescopeViewX: observatory.telescope.viewPosition.x,
    telescopeViewZ: observatory.telescope.viewPosition.z,
    telescopeInteractionRadius: observatory.telescope.interactionRadius,
    telescopeYaw: telescopeMode.yaw,
    telescopePitch: telescopeMode.pitch,
    telescopeBaseYaw: observatory.telescope.yaw,
    telescopeBasePitch: observatory.telescope.pitch,
    telescopeActive: telescopeMode.active,
    observatoryVisible: observatory.group.visible,
    platformSamples: observatory.collisionSamples.platform.map((sample) => ({ x: sample.x, z: sample.z })),
    platformSurfaceSamples: observatory.collisionSamples.platform.map((sample) => ({
      x: sample.x,
      z: sample.z,
      terrainY: heightAt(sample.x, sample.z),
      surfaceY: effectiveHeightAt(sample.x, sample.z),
    })),
    blockerSamples: observatory.collisionSamples.blockers.map((sample) => ({
      name: sample.name,
      x: sample.position.x,
      z: sample.position.z,
    })),
    cameraFov: camera.fov,
    nearby: isNearTelescope(),
    obstacleCount: collisionWorld.obstacles.filter((obstacle) => obstacle.kind === "observatory").length,
  };
}

function updateExploration(delta: number): { horizontalSpeed: number } {
  setCameraFov(normalCameraFov);
  const forward = movementForward.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = movementRight.set(forward.z, 0, -forward.x);
  const wish = movementWish.set(0, 0, 0);

  if (keys.has("KeyW")) wish.addScaledVector(forward, -1);
  if (keys.has("KeyS")) wish.add(forward);
  if (keys.has("KeyA")) wish.addScaledVector(right, -1);
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
    player.verticalVelocity -= gravity * diamondGravityMultiplierAt(player.localPosition.x, player.localPosition.z) * delta;
    player.verticalOffset += player.verticalVelocity * delta;
    if (player.verticalOffset <= 0) {
      player.verticalOffset = 0;
      player.verticalVelocity = 0;
      player.grounded = true;
    }
  }

  movementBeforeLocal.set(player.localPosition.x, 0, player.localPosition.z);
  resolvePlayerMove(player.localPosition, movementDelta.copy(player.velocity).multiplyScalar(delta));
  const actualHorizontalSpeed = surfaceDistanceBetweenLocal(movementBeforeLocal, player.localPosition) / Math.max(delta, 0.001);
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
  for (const source of fieldNoteSources) {
    if (surfaceDistanceBetweenLocal(focus, source.position) > source.radius) continue;
    if (fieldNotes.discover(source.noteId, elapsed)) {
      fieldNotesHud.refresh();
    }
  }
}

function recordFrameTiming(rawDelta: number): void {
  const frameMs = rawDelta * 1000;
  if (!Number.isFinite(frameMs) || frameMs <= 0) return;
  perfState.smoothedFrameMs = perfState.frameSamples === 0 ? frameMs : THREE.MathUtils.lerp(perfState.smoothedFrameMs, frameMs, 0.08);
  perfState.frameSamples += 1;
}

function animate(): void {
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);
  const elapsed = clock.elapsedTime;
  recordFrameTiming(rawDelta);
  const sleepBefore = sleep.getState();
  const movementIntent = !telescopeMode.active && hasMovementInput();
  const wantsSleep = telescopeMode.active ? false : isDemo ? sleepBefore.amount < 1 : isSleepPressed();
  let explorationMotion = { horizontalSpeed: 0 };

  if (isDemo) prDemo.update(elapsed, delta);
  else if (telescopeMode.active) explorationMotion = updateTelescopeMode();
  else if (sleepBefore.blackout) restPlayerInPlace(delta, 0.52);
  else if (sleepBefore.sleeping && isSleepPressed() && !movementIntent) restPlayerInPlace(delta, 0.72);
  else explorationMotion = updateExploration(delta);

  if (enableDomeDebug && !mouseLookActive && !movementIntent) {
    lookAtPlanetPoint(
      camera,
      dome.approachPosition.x,
      dome.approachPosition.z,
      effectiveHeightAt(dome.approachPosition.x, dome.approachPosition.z) + 18,
      dome.position.x,
      dome.position.z,
      dome.floorHeight + 34
    );
  }

  const movementAmount = isDemo || telescopeMode.active ? 0 : THREE.MathUtils.clamp(explorationMotion.horizontalSpeed / walkSpeed, 0, 1);
  const moving = isDemo || telescopeMode.active ? false : movementIntent || explorationMotion.horizontalSpeed > 0.15;
  const grounded = isDemo || telescopeMode.active || player.grounded;
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
  observatory.update(elapsed);
  if (telescopeMode.active) {
    telescopeFloraFocus.set(observatory.telescope.viewPosition.x, 0, observatory.telescope.viewPosition.z);
  }
  const floraFocus = isDemo ? demoFloraFocus : telescopeMode.active ? telescopeFloraFocus : player.localPosition;
  waterCreatures.update(elapsed, delta, floraFocus);
  flyingBeetles.update(elapsed, floraFocus);
  mountainBirds.update(elapsed, floraFocus);
  const templeFocus = isDemo ? { x: demoFloraFocus.x, z: demoFloraFocus.z } : player.localPosition;
  const activeDomeTimeMultiplier = updateDomeTimeMultiplier(delta, templeFocus);
  sleepTimeMultiplier = getSleepTimeMultiplier(sleepState);
  effectiveTimeMultiplier = activeDomeTimeMultiplier * sleepTimeMultiplier;
  skyElapsed += delta * effectiveTimeMultiplier;
  updateFieldNoteDiscovery(templeFocus, elapsed);
  dome.update(elapsed, activeDomeTimeMultiplier);
  sky.update(skyElapsed, floraFocus, temple.getInfluence(templeFocus, elapsed));
  terrain.update(floraFocus.x, floraFocus.z);
  oceans.update(floraFocus.x, floraFocus.z);
  diamondCrystals.update(floraFocus.x, floraFocus.z, elapsed);
  updateNatureChunks(floraFocus.x, floraFocus.z);
  updateFloraReactivity(floraFocus, delta, elapsed);
  updateVisionState(delta, floraFocus);
  mist.update(elapsed, floraFocus);
  updateLookStatus();
  if (!isDemo) updateUnderwaterCue();

  renderer.info.reset();
  pixelRenderer.render(scene, camera, {
    elapsed,
    isolationAmount: visionState.isolationAmount,
    prismAmount: visionState.prismAmount,
  });
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  pixelRenderer.resize(window.innerWidth, window.innerHeight);
});

animate();
