import * as THREE from "three";
import type { CollisionObstacle } from "./collision";
import {
  normalizePlanetCoords,
  placeObjectOnPlanet,
  PLANET_ASSUMED_WALK_SPEED,
  surfaceDistanceBetweenLocal,
  type LocalPlanetPoint,
} from "./planet";

type HeightSampler = (x: number, z: number) => number;

type ObservatoryFoundationSupport = {
  x: number;
  z: number;
  width: number;
  depth: number;
  bottomY: number;
  topY: number;
};

export type LandmarkZone = LocalPlanetPoint & {
  radius: number;
};

export type TempleLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "temple-gate";
    position: LocalPlanetPoint;
    radius: number;
  };
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  influenceRadius: number;
  fullInfluenceRadius: number;
  getInfluence: (playerPosition: LocalPlanetPoint, elapsed: number) => number;
  update: (elapsed: number) => void;
};

export type GlassDomeLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  radius: number;
  interiorRadius: number;
  floorHeight: number;
  shellThickness: number;
  entranceHalfWidth: number;
  entranceSillTopHeight: number;
  visualEntranceGapHalfWidth: number;
  visualRingGapHalfWidth: number;
  baseCollarGapHalfWidth: number;
  entranceDirection: LocalPlanetPoint;
  entrancePosition: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "dome-chronoglass";
    position: LocalPlanetPoint;
    radius: number;
  };
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  contains: (playerPosition: LocalPlanetPoint) => boolean;
  entranceClearanceAt: (point: LocalPlanetPoint) => number;
  update: (elapsed: number, timeMultiplier: number) => void;
};

export type ObservatoryLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "observatory-sightline";
    position: LocalPlanetPoint;
    radius: number;
  };
  telescope: {
    usePosition: LocalPlanetPoint;
    viewPosition: LocalPlanetPoint;
    yaw: number;
    pitch: number;
    viewHeight: number;
    interactionRadius: number;
  };
  collision: CollisionObstacle;
  collisionSamples: {
    platform: LocalPlanetPoint[];
    blockers: Array<{ name: string; position: LocalPlanetPoint }>;
  };
  platformSurfaceHeightAt: (x: number, z: number) => number | null;
  reservedZone: LandmarkZone;
  update: (elapsed: number) => void;
};

export type TalkingStatueWakeState = {
  distanceToPlayer: number;
  wakeAmount: number;
  awake: boolean;
  mouthOpenAmount: number;
  glowOpacity: number;
  headBob: number;
};

export type TalkingStatueLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "talking-stone-statue";
    position: LocalPlanetPoint;
    radius: number;
  };
  collision: CollisionObstacle;
  reservedZone: LandmarkZone;
  wakeRadius: number;
  fullWakeRadius: number;
  update: (elapsed: number, playerPosition: LocalPlanetPoint) => TalkingStatueWakeState;
  getState: () => TalkingStatueWakeState;
};

export type RadioTelescopeDishState = {
  name: string;
  position: LocalPlanetPoint;
  yaw: number;
  pitch: number;
  baseRadius: number;
  terrainHeight: number;
};

export type RadioTelescopeTerrainFlatness = {
  centerHeight: number;
  minHeight: number;
  maxHeight: number;
  heightVariation: number;
  sampleRadius: number;
  samples: Array<{ x: number; z: number; height: number }>;
};

export type RadioTelescopeArrayLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  noteSource: {
    noteId: "radio-array-listening";
    position: LocalPlanetPoint;
    radius: number;
  };
  dishes: RadioTelescopeDishState[];
  collision: CollisionObstacle;
  collisionSamples: {
    bases: Array<{ name: string; position: LocalPlanetPoint; radius: number }>;
  };
  reservedZone: LandmarkZone;
  terrainFlatness: RadioTelescopeTerrainFlatness;
  update: (elapsed: number) => void;
};

export type CrashedShipLandmark = {
  group: THREE.Group;
  position: LocalPlanetPoint;
  approachPosition: LocalPlanetPoint;
  smokeSourcePosition: LocalPlanetPoint;
  noteSource: {
    noteId: "crashed-ship-log";
    position: LocalPlanetPoint;
    radius: number;
  };
  yaw: number;
  hullLength: number;
  hullWidth: number;
  tiltPitch: number;
  tiltRoll: number;
  buriedDepth: number;
  collision: CollisionObstacle;
  collisionSamples: {
    blocked: LocalPlanetPoint[];
    clear: LocalPlanetPoint[];
  };
  reservedZone: LandmarkZone;
  getSmokeState: () => CrashedShipSmokeState;
  update: (elapsed: number) => void;
};

export type CrashedShipSmokeState = {
  puffCount: number;
  sourcePosition: LocalPlanetPoint;
  samples: Array<{
    x: number;
    y: number;
    z: number;
    opacity: number;
    scale: number;
  }>;
};

const templeSeed = "centauri-field-note-001-temple";
const templeClearanceRadius = 24;
const templeCollisionRadius = 5.8;
const templeInfluenceRadius = 46;
const templeFullInfluenceRadius = 13;
const templeNoteRadius = 12.5;
const domeSeed = "centauri-field-note-003-glass-dome";
const domeRadius = (PLANET_ASSUMED_WALK_SPEED * 60) / (Math.PI * 2);
const domeShellThickness = 4.4;
const domeEntranceHalfWidth = 8.4;
const domeEntranceSillTopHeight = 0;
const domeClearanceRadius = domeRadius + 24;
const domeNoteRadius = 10;
const domeLowestLatitudeRingScale = Math.cos((3 / 5) * Math.PI * 0.5);
const observatorySeed = "centauri-field-note-observatory-telescope";
const observatoryClearanceRadius = 34;
const observatoryCollisionRadius = 4.8;
const observatoryNoteRadius = 12;
const telescopeInteractionRadius = 7.4;
const telescopeUseDistance = observatoryCollisionRadius + 1.7;
const telescopeViewDistance = observatoryCollisionRadius + 1.25;
const observatoryAnchorOffset = 0.04;
const observatoryDeckTopLocalY = 0.78;
const observatoryStepTopLocalY = 0.5;
const talkingStatueSeed = "centauri-talking-stone-statue";
const talkingStatueClearanceRadius = 26;
const talkingStatueCollisionRadius = 3.6;
const talkingStatueWakeRadius = 34;
const talkingStatueFullWakeRadius = 8.5;
const talkingStatueNoteRadius = 12.5;
const radioTelescopeArraySeed = "centauri-field-note-radio-telescope-array";
const radioTelescopeArrayClearanceRadius = 76;
const radioTelescopeArrayCollisionRadius = 52;
const radioTelescopeArrayNoteRadius = 13;
const radioTelescopeArrayAnchorOffset = 0.04;
const radioTelescopeFlatnessSampleRadius = 5.2;
const radioTelescopeDishLayouts = [
  { name: "west dish", localX: -24, localZ: -8, yawOffset: -0.95, pitch: 0.66, baseRadius: 3.8 },
  { name: "east dish", localX: 22, localZ: -13, yawOffset: 0.42, pitch: 0.9, baseRadius: 4.0 },
  { name: "rear dish", localX: 1, localZ: 23, yawOffset: 2.08, pitch: 0.48, baseRadius: 3.7 },
] as const;
const crashedShipSeed = "centauri-field-note-crashed-ship";
const crashedShipClearanceRadius = 42;
const crashedShipHullLength = 24;
const crashedShipHullWidth = 9.2;
const crashedShipCollisionHalfLength = 9.3;
const crashedShipCollisionRadius = 4.15;
const crashedShipNoteRadius = 11.5;
const crashedShipTiltPitch = -0.32;
const crashedShipTiltRoll = 0.22;
const crashedShipBuriedDepth = 1.15;

type RadioTelescopeDishBuildState = RadioTelescopeDishState & {
  localX: number;
  localZ: number;
  yawOffset: number;
  baseY: number;
};

type DomeDoorwayAperture = {
  shellGapAngle: number;
  visualGapHalfAngle: number;
  baseCollarGapHalfWidth: number;
  visualEntranceGapHalfWidth: number;
  visualRingGapHalfWidth: number;
};

export function createTempleLandmark(scene: THREE.Scene, heightAt: HeightSampler): TempleLandmark {
  const position = chooseTemplePosition(heightAt);
  const approachPosition = normalizePlanetCoords(position.x - 17, position.z + 19);
  const notePosition = normalizePlanetCoords(position.x - 8.2, position.z + 7.4);
  const group = makeTemple();
  const altitude = heightAt(position.x, position.z);
  const rotation = seededUnit(`${templeSeed}:rotation`) * Math.PI * 2;
  placeObjectOnPlanet(group, position.x, position.z, altitude + 0.04, new THREE.Euler(0, rotation, 0));
  scene.add(group);

  const noteMarker = makeTempleNoteMarker();
  placeObjectOnPlanet(noteMarker, notePosition.x, notePosition.z, heightAt(notePosition.x, notePosition.z) + 0.02, new THREE.Euler(0, rotation + 0.42, 0));
  scene.add(noteMarker);

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "temple-gate",
      position: notePosition,
      radius: templeNoteRadius,
    },
    collision: { kind: "temple", x: position.x, z: position.z, radius: templeCollisionRadius },
    reservedZone: { x: position.x, z: position.z, radius: templeClearanceRadius },
    influenceRadius: templeInfluenceRadius,
    fullInfluenceRadius: templeFullInfluenceRadius,
    getInfluence: (playerPosition, elapsed) => templeInfluenceAt(playerPosition, position, elapsed),
    update: (elapsed) => {
      const inner = group.userData.innerGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      const gateGlow = group.userData.gateGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!inner || !gateGlow) return;
      const pulse = Math.sin(elapsed * 1.7) * 0.5 + 0.5;
      inner.material.opacity = 0.2 + pulse * 0.16;
      gateGlow.material.opacity = 0.16 + pulse * 0.18;
      gateGlow.scale.setScalar(0.96 + pulse * 0.05);
    },
  };
}

export function createGlassDomeLandmark(scene: THREE.Scene, heightAt: HeightSampler, avoidZones: LandmarkZone[] = []): GlassDomeLandmark {
  const position = chooseDomePosition(heightAt, avoidZones);
  const entranceAngle = seededUnit(`${domeSeed}:entrance`) * Math.PI * 2;
  const entranceDirection = { x: Math.sin(entranceAngle), z: Math.cos(entranceAngle) };
  const entrancePosition = offsetLocal(position, entranceDirection, domeRadius);
  const approachPosition = offsetLocal(position, entranceDirection, domeRadius + 18);
  const notePosition = offsetLocal(position, entranceDirection, domeRadius - 8);
  const floorHeight = heightAt(position.x, position.z) + 0.08;
  const interiorRadius = domeRadius - domeShellThickness * 0.85;
  const doorwayAperture = getDomeDoorwayAperture(domeRadius, domeEntranceHalfWidth);
  const group = makeGlassDome(domeRadius, domeEntranceHalfWidth, entranceAngle);
  placeObjectOnPlanet(group, position.x, position.z, floorHeight);
  scene.add(group);

  const noteMarker = makeDomeNoteMarker();
  placeObjectOnPlanet(
    noteMarker,
    notePosition.x,
    notePosition.z,
    floorHeight + 0.04,
    new THREE.Euler(0, entranceAngle + Math.PI, 0)
  );
  scene.add(noteMarker);

  const entranceClearanceAt = (point: LocalPlanetPoint): number => {
    const dx = point.x - position.x;
    const dz = point.z - position.z;
    const alongEntrance = dx * entranceDirection.x + dz * entranceDirection.z;
    const crossEntrance = Math.abs(dx * entranceDirection.z - dz * entranceDirection.x);
    const frontBand = alongEntrance > domeRadius - domeShellThickness * 2.6 && alongEntrance < domeRadius + domeShellThickness * 2.8;
    return frontBand ? domeEntranceHalfWidth - crossEntrance : -Infinity;
  };
  const isInEntrance = (point: LocalPlanetPoint): boolean => entranceClearanceAt(point) > 0;
  const surfaceDistanceToCenter = (point: LocalPlanetPoint): number => surfaceDistanceBetweenLocal(point, position);
  const contains = (playerPosition: LocalPlanetPoint): boolean => surfaceDistanceToCenter(playerPosition) < interiorRadius;

  return {
    group,
    position,
    radius: domeRadius,
    interiorRadius,
    floorHeight,
    shellThickness: domeShellThickness,
    entranceHalfWidth: domeEntranceHalfWidth,
    entranceSillTopHeight: domeEntranceSillTopHeight,
    visualEntranceGapHalfWidth: doorwayAperture.visualEntranceGapHalfWidth,
    visualRingGapHalfWidth: doorwayAperture.visualRingGapHalfWidth,
    baseCollarGapHalfWidth: doorwayAperture.baseCollarGapHalfWidth,
    entranceDirection,
    entrancePosition,
    approachPosition,
    noteSource: {
      noteId: "dome-chronoglass",
      position: notePosition,
      radius: domeNoteRadius,
    },
    collision: {
      kind: "dome-shell",
      x: position.x,
      z: position.z,
      radius: domeRadius,
      blocksAt: (x, z, playerRadius) => {
        const point = { x, z };
        if (isInEntrance(point)) return false;
        return Math.abs(surfaceDistanceToCenter(point) - domeRadius) < domeShellThickness * 0.5 + playerRadius;
      },
    },
    reservedZone: { x: position.x, z: position.z, radius: domeClearanceRadius },
    contains,
    entranceClearanceAt,
    update: (elapsed, timeMultiplier) => {
      const glow = group.userData.innerGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      const glass = group.userData.glass as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!glow || !glass) return;
      const pulse = Math.sin(elapsed * THREE.MathUtils.lerp(0.55, 2.2, (timeMultiplier - 1) / 3)) * 0.5 + 0.5;
      glow.material.opacity = 0.1 + pulse * 0.13 + (timeMultiplier - 1) * 0.025;
      glass.material.opacity = 0.22 + pulse * 0.035;
    },
  };
}

export function createObservatoryLandmark(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[] = []
): ObservatoryLandmark {
  const position = chooseObservatoryPosition(heightAt, avoidZones);
  const yaw = seededUnit(`${observatorySeed}:yaw`) * Math.PI * 2 + 0.55;
  const sightline = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const behindSightline = { x: -sightline.x, z: -sightline.z };
  const sideSightline = { x: sightline.z, z: -sightline.x };
  const approachPosition = offsetLocal(position, behindSightline, 17);
  const usePosition = offsetLocal(position, behindSightline, telescopeUseDistance);
  const viewPosition = offsetLocal(position, behindSightline, telescopeViewDistance);
  const notePosition = offsetLocal(position, sideSightline, 5.6);
  const altitude = heightAt(position.x, position.z);
  const viewHeight = heightAt(viewPosition.x, viewPosition.z) + 2.65;
  const anchorAltitude = altitude + observatoryAnchorOffset;
  const foundationSupports = makeObservatoryFoundationSupports(position, yaw, anchorAltitude, heightAt);
  const group = makeObservatory(foundationSupports);
  placeObjectOnPlanet(group, position.x, position.z, anchorAltitude, new THREE.Euler(0, yaw, 0));
  scene.add(group);

  const noteMarker = makeObservatoryNoteMarker();
  placeObjectOnPlanet(
    noteMarker,
    notePosition.x,
    notePosition.z,
    heightAt(notePosition.x, notePosition.z) + 0.03,
    new THREE.Euler(0, yaw + Math.PI * 0.18, 0)
  );
  scene.add(noteMarker);

  const collisionSamples = makeObservatoryCollisionSamples(position, yaw);

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "observatory-sightline",
      position: notePosition,
      radius: observatoryNoteRadius,
    },
    telescope: {
      usePosition,
      viewPosition,
      yaw,
      pitch: 0.1,
      viewHeight,
      interactionRadius: telescopeInteractionRadius,
    },
    collision: createObservatoryCollision(position, yaw),
    collisionSamples,
    platformSurfaceHeightAt: (x, z) => observatoryPlatformSurfaceHeightAt(position, yaw, anchorAltitude, x, z),
    reservedZone: { x: position.x, z: position.z, radius: observatoryClearanceRadius },
    update: (elapsed) => {
      const lensGlow = group.userData.lensGlow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      const reticle = group.userData.reticle as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!lensGlow || !reticle) return;
      const pulse = Math.sin(elapsed * 1.1 + 0.6) * 0.5 + 0.5;
      lensGlow.material.opacity = 0.2 + pulse * 0.18;
      reticle.material.opacity = 0.34 + pulse * 0.22;
    },
  };
}

export function createTalkingStatueLandmark(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[] = []
): TalkingStatueLandmark {
  const position = chooseTalkingStatuePosition(heightAt, avoidZones);
  const yaw = seededUnit(`${talkingStatueSeed}:yaw`) * Math.PI * 2;
  const frontDirection = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const approachPosition = offsetLocal(position, frontDirection, 18);
  const altitude = heightAt(position.x, position.z);
  const group = makeTalkingStatue();
  let wakeState: TalkingStatueWakeState = {
    distanceToPlayer: Infinity,
    wakeAmount: 0,
    awake: false,
    mouthOpenAmount: 0,
    glowOpacity: 0,
    headBob: 0,
  };

  placeObjectOnPlanet(group, position.x, position.z, altitude + 0.03, new THREE.Euler(0, yaw, 0));
  scene.add(group);

  const update = (elapsed: number, playerPosition: LocalPlanetPoint): TalkingStatueWakeState => {
    const distanceToPlayer = surfaceDistanceBetweenLocal(playerPosition, position);
    const targetWake = 1 - THREE.MathUtils.smoothstep(distanceToPlayer, talkingStatueFullWakeRadius, talkingStatueWakeRadius);
    const wakeAmount = THREE.MathUtils.lerp(wakeState.wakeAmount, targetWake, 1 - Math.exp(-0.08));
    const talkPulse = Math.sin(elapsed * 5.1 + Math.sin(elapsed * 1.3) * 0.7) * 0.5 + 0.5;
    const mouthOpenAmount = wakeAmount * THREE.MathUtils.lerp(0.18, 1, talkPulse);
    const headBob = wakeAmount * Math.sin(elapsed * 1.45) * 0.09;
    const glowOpacity = wakeAmount * (0.18 + talkPulse * 0.28);

    const head = group.userData.head as THREE.Group | undefined;
    const mouth = group.userData.mouth as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    const lowerMouth = group.userData.lowerMouth as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    const leftEye = group.userData.leftEye as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    const rightEye = group.userData.rightEye as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    const glow = group.userData.glow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    const headBaseY = (group.userData.headBaseY as number | undefined) ?? 4.05;
    if (head) {
      head.position.y = headBaseY + headBob;
      head.rotation.x = -0.05 + wakeAmount * 0.08 + Math.sin(elapsed * 0.9) * wakeAmount * 0.018;
      head.rotation.z = Math.sin(elapsed * 0.7) * wakeAmount * 0.025;
    }
    if (mouth) {
      mouth.scale.y = 1 + mouthOpenAmount * 0.9;
      mouth.material.opacity = 0.48 + wakeAmount * 0.4;
    }
    if (lowerMouth) lowerMouth.position.y = -1.25 - mouthOpenAmount * 0.16;
    if (leftEye && rightEye) {
      const eyeScale = 0.54 + wakeAmount * (0.46 + Math.sin(elapsed * 3.7) * 0.08);
      leftEye.scale.y = eyeScale;
      rightEye.scale.y = eyeScale;
      leftEye.material.opacity = 0.22 + glowOpacity;
      rightEye.material.opacity = 0.22 + glowOpacity;
    }
    if (glow) {
      glow.material.opacity = glowOpacity;
      glow.scale.setScalar(1 + wakeAmount * 0.18 + talkPulse * wakeAmount * 0.08);
    }

    wakeState = {
      distanceToPlayer,
      wakeAmount,
      awake: wakeAmount > 0.35,
      mouthOpenAmount,
      glowOpacity,
      headBob,
    };
    return wakeState;
  };

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "talking-stone-statue",
      position,
      radius: talkingStatueNoteRadius,
    },
    collision: { kind: "talking-statue", x: position.x, z: position.z, radius: talkingStatueCollisionRadius },
    reservedZone: { x: position.x, z: position.z, radius: talkingStatueClearanceRadius },
    wakeRadius: talkingStatueWakeRadius,
    fullWakeRadius: talkingStatueFullWakeRadius,
    update,
    getState: () => wakeState,
  };
}

export function createRadioTelescopeArrayLandmark(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[] = []
): RadioTelescopeArrayLandmark {
  const yaw = seededUnit(`${radioTelescopeArraySeed}:yaw`) * Math.PI * 2;
  const position = chooseRadioTelescopeArrayPosition(heightAt, avoidZones, yaw);
  const terrainFlatness = measureRadioTelescopeArrayTerrain(position, yaw, heightAt);
  const anchorAltitude = terrainFlatness.centerHeight + radioTelescopeArrayAnchorOffset;
  const arrayFacing = { x: -Math.sin(yaw + 0.25), z: -Math.cos(yaw + 0.25) };
  const noteFacing = { x: -arrayFacing.z, z: arrayFacing.x };
  const approachPosition = offsetLocal(position, arrayFacing, 54);
  const notePosition = offsetLocal(position, noteFacing, 25);
  const dishes = radioTelescopeDishLayouts.map((layout): RadioTelescopeDishBuildState => {
    const dishPosition = radioArrayLocalToWorld(position, yaw, layout.localX, layout.localZ);
    const terrainHeight = heightAt(dishPosition.x, dishPosition.z);
    return {
      name: layout.name,
      localX: layout.localX,
      localZ: layout.localZ,
      yawOffset: layout.yawOffset,
      position: dishPosition,
      yaw: yaw + layout.yawOffset,
      pitch: layout.pitch,
      baseRadius: layout.baseRadius,
      terrainHeight,
      baseY: terrainHeight - anchorAltitude,
    };
  });

  const group = makeRadioTelescopeArray(dishes);
  placeObjectOnPlanet(group, position.x, position.z, anchorAltitude, new THREE.Euler(0, yaw, 0));
  scene.add(group);

  const noteMarker = makeRadioTelescopeNoteMarker();
  placeObjectOnPlanet(
    noteMarker,
    notePosition.x,
    notePosition.z,
    heightAt(notePosition.x, notePosition.z) + 0.04,
    new THREE.Euler(0, yaw - Math.PI * 0.28, 0)
  );
  scene.add(noteMarker);

  const collisionSamples = makeRadioTelescopeCollisionSamples(dishes);

  return {
    group,
    position,
    approachPosition,
    noteSource: {
      noteId: "radio-array-listening",
      position: notePosition,
      radius: radioTelescopeArrayNoteRadius,
    },
    dishes: dishes.map(({ name, position, yaw, pitch, baseRadius, terrainHeight }) => ({
      name,
      position,
      yaw,
      pitch,
      baseRadius,
      terrainHeight,
    })),
    collision: createRadioTelescopeArrayCollision(position, yaw),
    collisionSamples,
    reservedZone: { x: position.x, z: position.z, radius: radioTelescopeArrayClearanceRadius },
    terrainFlatness,
    update: (elapsed) => {
      const glows = group.userData.radioPulseGlows as
        | Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>
        | undefined;
      if (!glows) return;
      glows.forEach((glow, index) => {
        const pulse = Math.sin(elapsed * 0.9 + index * 1.7) * 0.5 + 0.5;
        glow.material.opacity = 0.12 + pulse * 0.18;
        glow.scale.setScalar(0.96 + pulse * 0.08);
      });
    },
  };
}

export function createCrashedShipLandmark(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[] = []
): CrashedShipLandmark {
  const position = chooseCrashedShipPosition(heightAt, avoidZones);
  const yaw = seededUnit(`${crashedShipSeed}:yaw`) * Math.PI * 2 - 0.45;
  const approachPosition = crashedShipLocalToWorld(position, yaw, -16, 19);
  const notePosition = crashedShipLocalToWorld(position, yaw, -8.4, 2.8);
  const smokeSourcePosition = crashedShipLocalToWorld(position, yaw, -5.2, -0.6);
  const altitude = heightAt(position.x, position.z);
  const shipMesh = makeCrashedShip(position, yaw, altitude, heightAt);
  const group = shipMesh.group;
  updateCrashedShipSmoke(shipMesh.smokePuffs, 0);
  placeObjectOnPlanet(
    group,
    position.x,
    position.z,
    altitude + 0.04,
    new THREE.Euler(crashedShipTiltPitch, yaw, crashedShipTiltRoll)
  );
  scene.add(group);

  const noteMarker = makeCrashedShipNoteMarker();
  placeObjectOnPlanet(
    noteMarker,
    notePosition.x,
    notePosition.z,
    heightAt(notePosition.x, notePosition.z) + 0.04,
    new THREE.Euler(0, yaw - Math.PI * 0.5, 0)
  );
  scene.add(noteMarker);

  return {
    group,
    position,
    approachPosition,
    smokeSourcePosition,
    noteSource: {
      noteId: "crashed-ship-log",
      position: notePosition,
      radius: crashedShipNoteRadius,
    },
    yaw,
    hullLength: crashedShipHullLength,
    hullWidth: crashedShipHullWidth,
    tiltPitch: crashedShipTiltPitch,
    tiltRoll: crashedShipTiltRoll,
    buriedDepth: crashedShipBuriedDepth,
    collision: createCrashedShipCollision(position, yaw),
    collisionSamples: {
      blocked: [
        crashedShipLocalToWorld(position, yaw, 0, 0),
        crashedShipLocalToWorld(position, yaw, -2.6, -5.8),
        crashedShipLocalToWorld(position, yaw, 2.4, 5.6),
      ],
      clear: [
        approachPosition,
        notePosition,
        crashedShipLocalToWorld(position, yaw, 9.5, -4.8),
        crashedShipLocalToWorld(position, yaw, -11.2, 9.8),
      ],
    },
    reservedZone: { x: position.x, z: position.z, radius: crashedShipClearanceRadius },
    getSmokeState: () => getCrashedShipSmokeState(shipMesh.smokePuffs, smokeSourcePosition),
    update: (elapsed) => updateCrashedShipSmoke(shipMesh.smokePuffs, elapsed),
  };
}

export function isInLandmarkZone(point: LocalPlanetPoint, zones: LandmarkZone[]): boolean {
  return zones.some((zone) => surfaceDistanceBetweenLocal(point, zone) < zone.radius);
}

function chooseTemplePosition(heightAt: HeightSampler): LocalPlanetPoint {
  const random = createSeededRandom(templeSeed);
  let fallback = normalizePlanetCoords(260, -240);

  for (let i = 0; i < 64; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 175 + random() * 125;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius + 260, Math.sin(angle) * radius - 240);
    if (!isValidTempleTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  if (!isValidTempleTerrain(fallback, heightAt)) {
    fallback = normalizePlanetCoords(306, -268);
  }
  return fallback;
}

function isValidTempleTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.8) return false;

  const samples = [
    heightAt(point.x + 5, point.z),
    heightAt(point.x - 5, point.z),
    heightAt(point.x, point.z + 5),
    heightAt(point.x, point.z - 5),
  ];
  return samples.every((height) => height > 0.25 && Math.abs(height - centerHeight) < 5.2);
}

function chooseDomePosition(heightAt: HeightSampler, avoidZones: LandmarkZone[]): LocalPlanetPoint {
  const random = createSeededRandom(domeSeed);
  let fallback = normalizePlanetCoords(-360, 260);

  for (let i = 0; i < 96; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 330 + random() * 260;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius - 120, Math.sin(angle) * radius + 110);
    if (!isValidDomeTerrain(candidate, heightAt)) continue;
    if (isInLandmarkZone(candidate, avoidZones.map((zone) => ({ ...zone, radius: zone.radius + domeClearanceRadius })))) continue;
    return candidate;
  }

  if (!isValidDomeTerrain(fallback, heightAt)) {
    fallback = normalizePlanetCoords(-420, 210);
  }
  return fallback;
}

function isValidDomeTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.9) return false;
  const samples = [
    heightAt(point.x + domeRadius * 0.55, point.z),
    heightAt(point.x - domeRadius * 0.55, point.z),
    heightAt(point.x, point.z + domeRadius * 0.55),
    heightAt(point.x, point.z - domeRadius * 0.55),
    heightAt(point.x + domeRadius * 0.36, point.z + domeRadius * 0.36),
    heightAt(point.x - domeRadius * 0.36, point.z - domeRadius * 0.36),
  ];
  return samples.every((height) => height > 0.15 && Math.abs(height - centerHeight) < 8.5);
}

function chooseObservatoryPosition(heightAt: HeightSampler, avoidZones: LandmarkZone[]): LocalPlanetPoint {
  const random = createSeededRandom(observatorySeed);
  const fallbackPositions = [
    normalizePlanetCoords(-430, 312),
    normalizePlanetCoords(-388, 246),
    normalizePlanetCoords(-510, 188),
  ];

  for (let i = 0; i < 96; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 210 + random() * 210;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius - 360, Math.sin(angle) * radius + 260);
    if (isInLandmarkZone(candidate, avoidZones)) continue;
    if (!isValidObservatoryTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  return fallbackPositions.find((point) => !isInLandmarkZone(point, avoidZones) && isValidObservatoryTerrain(point, heightAt)) ?? fallbackPositions[0];
}

function isValidObservatoryTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.9) return false;

  const samples = [
    heightAt(point.x + 6, point.z),
    heightAt(point.x - 6, point.z),
    heightAt(point.x, point.z + 6),
    heightAt(point.x, point.z - 6),
    heightAt(point.x + 11, point.z + 3),
    heightAt(point.x - 8, point.z - 8),
  ];
  return samples.every((height) => height > 0.25 && Math.abs(height - centerHeight) < 6.4);
}

function chooseCrashedShipPosition(heightAt: HeightSampler, avoidZones: LandmarkZone[]): LocalPlanetPoint {
  const random = createSeededRandom(crashedShipSeed);
  const inflatedAvoidZones = avoidZones.map((zone) => ({ ...zone, radius: zone.radius + crashedShipClearanceRadius }));
  const fallbackPositions = [
    normalizePlanetCoords(166, 386),
    normalizePlanetCoords(318, 132),
    normalizePlanetCoords(-214, -326),
  ];

  for (let i = 0; i < 128; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 250 + random() * 310;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius + 110, Math.sin(angle) * radius + 340);
    if (isInLandmarkZone(candidate, inflatedAvoidZones)) continue;
    if (!isValidCrashedShipTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  return fallbackPositions.find((point) => !isInLandmarkZone(point, inflatedAvoidZones) && isValidCrashedShipTerrain(point, heightAt)) ?? fallbackPositions[0];
}

function isValidCrashedShipTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.75) return false;

  const samples = [
    heightAt(point.x + 12, point.z),
    heightAt(point.x - 12, point.z),
    heightAt(point.x, point.z + 12),
    heightAt(point.x, point.z - 12),
    heightAt(point.x + 16, point.z - 7),
    heightAt(point.x - 11, point.z + 14),
  ];
  return samples.every((height) => height > 0.2 && Math.abs(height - centerHeight) < 7.2);
}

function chooseTalkingStatuePosition(heightAt: HeightSampler, avoidZones: LandmarkZone[]): LocalPlanetPoint {
  const random = createSeededRandom(talkingStatueSeed);
  const fallbackPositions = [
    normalizePlanetCoords(168, 346),
    normalizePlanetCoords(118, 398),
    normalizePlanetCoords(224, 304),
  ];

  for (let i = 0; i < 96; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 185 + random() * 240;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius + 120, Math.sin(angle) * radius + 250);
    if (isInLandmarkZone(candidate, avoidZones.map((zone) => ({ ...zone, radius: zone.radius + talkingStatueClearanceRadius })))) continue;
    if (!isValidTalkingStatueTerrain(candidate, heightAt)) continue;
    return candidate;
  }

  return fallbackPositions.find((point) => !isInLandmarkZone(point, avoidZones) && isValidTalkingStatueTerrain(point, heightAt)) ?? fallbackPositions[0];
}

function isValidTalkingStatueTerrain(point: LocalPlanetPoint, heightAt: HeightSampler): boolean {
  const centerHeight = heightAt(point.x, point.z);
  if (centerHeight < 0.75) return false;

  const samples = [
    heightAt(point.x + 5, point.z),
    heightAt(point.x - 5, point.z),
    heightAt(point.x, point.z + 5),
    heightAt(point.x, point.z - 5),
    heightAt(point.x + 8, point.z + 4),
    heightAt(point.x - 7, point.z - 5),
  ];
  return samples.every((height) => height > 0.2 && Math.abs(height - centerHeight) < 5.8);
}

function createCrashedShipCollision(position: LocalPlanetPoint, yaw: number): CollisionObstacle {
  return {
    kind: "crashed-ship",
    x: position.x,
    z: position.z,
    radius: crashedShipCollisionHalfLength + crashedShipCollisionRadius,
    blocksAt: (x, z, playerRadius) => {
      const local = crashedShipWorldToLocal(position, yaw, x, z);
      const closestZ = THREE.MathUtils.clamp(local.z, -crashedShipCollisionHalfLength, crashedShipCollisionHalfLength * 0.88);
      const dx = local.x;
      const dz = local.z - closestZ;
      const hullRadius = crashedShipCollisionRadius + playerRadius;
      return dx * dx + dz * dz < hullRadius * hullRadius;
    },
  };
}

function createObservatoryCollision(position: LocalPlanetPoint, yaw: number): CollisionObstacle {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const blockers = [
    { x: 0, z: 0, radius: 0.74 },
    { x: 0, z: -1.45, radius: 1.18 },
    { x: 0, z: -3.75, radius: 0.82 },
    { x: 0, z: 2.28, radius: 0.62 },
    { x: -1.35, z: 0.9, radius: 0.42 },
    { x: 1.28, z: 0.8, radius: 0.42 },
    { x: 0, z: -1.55, radius: 0.44 },
  ];

  return {
    kind: "observatory",
    x: position.x,
    z: position.z,
    radius: observatoryCollisionRadius,
    blocksAt: (x, z, playerRadius) => {
      const dx = x - position.x;
      const dz = z - position.z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      return blockers.some((blocker) => {
        const minDistance = blocker.radius + playerRadius;
        const blockerDx = localX - blocker.x;
        const blockerDz = localZ - blocker.z;
        return blockerDx * blockerDx + blockerDz * blockerDz < minDistance * minDistance;
      });
    },
  };
}

function makeObservatoryCollisionSamples(
  position: LocalPlanetPoint,
  yaw: number
): { platform: LocalPlanetPoint[]; blockers: Array<{ name: string; position: LocalPlanetPoint }> } {
  return {
    platform: [
      observatoryLocalToWorld(position, yaw, -3.05, -0.35),
      observatoryLocalToWorld(position, yaw, 3.1, 0.3),
      observatoryLocalToWorld(position, yaw, -1.95, 2.8),
      observatoryLocalToWorld(position, yaw, 2.25, 2.55),
    ],
    blockers: [
      { name: "central pier", position: observatoryLocalToWorld(position, yaw, 0, 0) },
      { name: "telescope tube", position: observatoryLocalToWorld(position, yaw, 0, -1.45) },
      { name: "front lens", position: observatoryLocalToWorld(position, yaw, 0, -3.75) },
      { name: "eyepiece", position: observatoryLocalToWorld(position, yaw, 0, 2.28) },
    ],
  };
}

function makeObservatoryFoundationSupports(
  position: LocalPlanetPoint,
  yaw: number,
  anchorAltitude: number,
  heightAt: HeightSampler
): ObservatoryFoundationSupport[] {
  const samples = [
    { x: -4.45, z: -2.85, width: 0.5, depth: 0.5, topY: 0.74 },
    { x: 4.45, z: -2.85, width: 0.5, depth: 0.5, topY: 0.74 },
    { x: -4.55, z: 2.45, width: 0.5, depth: 0.5, topY: 0.72 },
    { x: 4.55, z: 2.45, width: 0.5, depth: 0.5, topY: 0.72 },
    { x: -2.4, z: 4.16, width: 0.42, depth: 0.48, topY: 0.58 },
    { x: 2.4, z: 4.16, width: 0.42, depth: 0.48, topY: 0.58 },
    { x: 0, z: 4.92, width: 2.7, depth: 0.46, topY: 0.48 },
  ];

  return samples.map((sample) => {
    const world = observatoryLocalToWorld(position, yaw, sample.x, sample.z);
    const terrainY = heightAt(world.x, world.z) - anchorAltitude;
    const bottomY = Math.min(terrainY - 0.06, sample.topY - 0.24);
    return {
      ...sample,
      bottomY,
    };
  });
}

function observatoryLocalToWorld(position: LocalPlanetPoint, yaw: number, localX: number, localZ: number): LocalPlanetPoint {
  return normalizePlanetCoords(
    position.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    position.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
  );
}

function observatoryWorldToLocal(position: LocalPlanetPoint, yaw: number, x: number, z: number): { x: number; z: number } {
  const dx = x - position.x;
  const dz = z - position.z;
  return {
    x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
    z: dx * Math.sin(yaw) + dz * Math.cos(yaw),
  };
}

function observatoryPlatformSurfaceHeightAt(
  position: LocalPlanetPoint,
  yaw: number,
  anchorAltitude: number,
  x: number,
  z: number
): number | null {
  const local = observatoryWorldToLocal(position, yaw, x, z);
  const deckX = local.x / 5.05;
  const deckZ = local.z / 4.05;
  if (deckX * deckX + deckZ * deckZ <= 1) return anchorAltitude + observatoryDeckTopLocalY;

  const onSteps = Math.abs(local.x) <= 1.55 && local.z >= 3.75 && local.z <= 5.35;
  return onSteps ? anchorAltitude + observatoryStepTopLocalY : null;
}

function crashedShipLocalToWorld(position: LocalPlanetPoint, yaw: number, localX: number, localZ: number): LocalPlanetPoint {
  return normalizePlanetCoords(
    position.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    position.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
  );
}

function crashedShipWorldToLocal(position: LocalPlanetPoint, yaw: number, x: number, z: number): { x: number; z: number } {
  const dx = x - position.x;
  const dz = z - position.z;
  return {
    x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
    z: dx * Math.sin(yaw) + dz * Math.cos(yaw),
  };
}

function chooseRadioTelescopeArrayPosition(
  heightAt: HeightSampler,
  avoidZones: LandmarkZone[],
  yaw: number
): LocalPlanetPoint {
  const random = createSeededRandom(radioTelescopeArraySeed);
  const starterClearing = { ...normalizePlanetCoords(0, 24), radius: radioTelescopeArrayClearanceRadius + 96 };
  const expandedAvoidZones = [starterClearing, ...avoidZones].map((zone) => ({
    ...zone,
    radius: zone.radius + radioTelescopeArrayClearanceRadius + 18,
  }));
  const fallbackPositions = [
    normalizePlanetCoords(480, 226),
    normalizePlanetCoords(456, 262),
    normalizePlanetCoords(696, 70),
  ];

  for (let i = 0; i < 180; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 260 + random() * 340;
    const candidate = normalizePlanetCoords(Math.cos(angle) * radius + 410, Math.sin(angle) * radius + 260);
    if (isInLandmarkZone(candidate, expandedAvoidZones)) continue;
    if (!isValidRadioTelescopeArrayTerrain(candidate, yaw, heightAt)) continue;
    return candidate;
  }

  return (
    fallbackPositions.find(
      (point) => !isInLandmarkZone(point, expandedAvoidZones) && isValidRadioTelescopeArrayTerrain(point, yaw, heightAt)
    ) ?? fallbackPositions[0]
  );
}

function isValidRadioTelescopeArrayTerrain(point: LocalPlanetPoint, yaw: number, heightAt: HeightSampler): boolean {
  const flatness = measureRadioTelescopeArrayTerrain(point, yaw, heightAt);
  if (flatness.centerHeight < 0.85) return false;
  if (flatness.minHeight < 0.25) return false;
  return flatness.heightVariation < 2.8;
}

function measureRadioTelescopeArrayTerrain(
  position: LocalPlanetPoint,
  yaw: number,
  heightAt: HeightSampler
): RadioTelescopeTerrainFlatness {
  const localSamples: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];

  radioTelescopeDishLayouts.forEach((dish) => {
    localSamples.push(
      { x: dish.localX, z: dish.localZ },
      { x: dish.localX + radioTelescopeFlatnessSampleRadius, z: dish.localZ },
      { x: dish.localX - radioTelescopeFlatnessSampleRadius, z: dish.localZ },
      { x: dish.localX, z: dish.localZ + radioTelescopeFlatnessSampleRadius },
      { x: dish.localX, z: dish.localZ - radioTelescopeFlatnessSampleRadius },
      {
        x: dish.localX + radioTelescopeFlatnessSampleRadius * 0.78,
        z: dish.localZ + radioTelescopeFlatnessSampleRadius * 0.78,
      },
      {
        x: dish.localX - radioTelescopeFlatnessSampleRadius * 0.78,
        z: dish.localZ - radioTelescopeFlatnessSampleRadius * 0.78,
      }
    );
  });

  const samples = localSamples.map((sample) => {
    const world = radioArrayLocalToWorld(position, yaw, sample.x, sample.z);
    return { x: world.x, z: world.z, height: heightAt(world.x, world.z) };
  });
  const heights = samples.map((sample) => sample.height);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);

  return {
    centerHeight: heightAt(position.x, position.z),
    minHeight,
    maxHeight,
    heightVariation: maxHeight - minHeight,
    sampleRadius: radioTelescopeFlatnessSampleRadius,
    samples,
  };
}

function createRadioTelescopeArrayCollision(position: LocalPlanetPoint, yaw: number): CollisionObstacle {
  const blockers = radioTelescopeDishLayouts.map((dish) => ({
    x: dish.localX,
    z: dish.localZ,
    radius: dish.baseRadius,
  }));

  return {
    kind: "radio-telescope",
    x: position.x,
    z: position.z,
    radius: radioTelescopeArrayCollisionRadius,
    blocksAt: (x, z, playerRadius) => {
      const local = radioArrayWorldToLocal(position, yaw, x, z);
      return blockers.some((blocker) => {
        const minDistance = blocker.radius + playerRadius;
        const dx = local.x - blocker.x;
        const dz = local.z - blocker.z;
        return dx * dx + dz * dz < minDistance * minDistance;
      });
    },
  };
}

function makeRadioTelescopeCollisionSamples(
  dishes: RadioTelescopeDishState[]
): { bases: Array<{ name: string; position: LocalPlanetPoint; radius: number }> } {
  return {
    bases: dishes.map((dish) => ({ name: dish.name, position: dish.position, radius: dish.baseRadius })),
  };
}

function radioArrayLocalToWorld(position: LocalPlanetPoint, yaw: number, localX: number, localZ: number): LocalPlanetPoint {
  return normalizePlanetCoords(
    position.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    position.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
  );
}

function radioArrayWorldToLocal(position: LocalPlanetPoint, yaw: number, x: number, z: number): { x: number; z: number } {
  const dx = x - position.x;
  const dz = z - position.z;
  return {
    x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
    z: dx * Math.sin(yaw) + dz * Math.cos(yaw),
  };
}

function offsetLocal(origin: LocalPlanetPoint, direction: LocalPlanetPoint, distance: number): LocalPlanetPoint {
  const length = Math.hypot(direction.x, direction.z) || 1;
  return normalizePlanetCoords(origin.x + (direction.x / length) * distance, origin.z + (direction.z / length) * distance);
}

function templeInfluenceAt(playerPosition: LocalPlanetPoint, templePosition: LocalPlanetPoint, elapsed: number): number {
  const distance = surfaceDistanceBetweenLocal(playerPosition, templePosition);
  const proximity = 1 - THREE.MathUtils.smoothstep(distance, templeFullInfluenceRadius, templeInfluenceRadius);
  if (proximity <= 0) return 0;

  const slowPhase = Math.sin(elapsed * 0.72) * 0.5 + 0.5;
  const flicker = Math.sin(elapsed * 2.4 + Math.sin(elapsed * 0.41) * 2.2) * 0.5 + 0.5;
  const intermittent = THREE.MathUtils.smoothstep(slowPhase * 0.7 + flicker * 0.3, 0.42, 0.92);
  return proximity * THREE.MathUtils.lerp(0.18, 0.84, intermittent);
}

function makeTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-strange-temple-landmark";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x2d2369 });
  const shadowStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x201749 });
  const stepMaterial = new THREE.MeshBasicMaterial({ color: 0x6a4bd6 });
  const wornStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x8a65df });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x49d7c5 });
  const vineMaterial = new THREE.MeshBasicMaterial({ color: 0x69ff87 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lowerBase = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 8.2, 0.78, 8), shadowStoneMaterial);
  lowerBase.position.y = 0.36;
  lowerBase.rotation.y = Math.PI / 8;
  lowerBase.scale.z = 0.74;
  group.add(lowerBase);

  const middleBase = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 6.6, 0.86, 8), baseMaterial);
  middleBase.position.y = 1.08;
  middleBase.rotation.y = Math.PI / 8;
  middleBase.scale.z = 0.68;
  group.add(middleBase);

  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 5.0, 0.74, 6), stepMaterial);
  upperBase.position.y = 1.78;
  upperBase.rotation.y = Math.PI / 6;
  upperBase.scale.z = 0.64;
  group.add(upperBase);

  addPrism(group, [
    [-3.95, 1.72],
    [-2.38, 1.92],
    [-2.66, 6.25],
    [-3.58, 6.78],
  ], 1.08, baseMaterial, -1.08);
  addPrism(group, [
    [2.32, 1.9],
    [3.88, 1.68],
    [3.54, 5.74],
    [2.72, 6.34],
  ], 1.08, baseMaterial, -1.08);
  addPrism(group, [
    [-2.82, 6.08],
    [0.95, 6.24],
    [2.26, 7.06],
    [-1.88, 7.34],
  ], 1, wornStoneMaterial, -1.08);
  addPrism(group, [
    [1.28, 5.9],
    [2.92, 5.58],
    [2.46, 6.5],
    [1.02, 6.86],
  ], 1.06, shadowStoneMaterial, -1.04);

  addGateSegment(group, 2.62, 0.58, -0.12, 0.06, Math.PI * 1.36, baseMaterial);
  addGateSegment(group, 3.24, 0.24, -0.03, 0.06, Math.PI * 1.18, wornStoneMaterial);

  const gateGlow = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.08, 5, 28, Math.PI * 1.42), glowMaterial.clone());
  gateGlow.position.set(0, 4.34, -1.52);
  gateGlow.rotation.z = -0.18;
  group.add(gateGlow);

  const innerGlow = new THREE.Mesh(new THREE.CircleGeometry(1.16, 10), glowMaterial);
  innerGlow.position.set(0, 4.22, -1.56);
  innerGlow.scale.set(1, 1.32, 1);
  group.add(innerGlow);

  addGlyphPanel(group, -3.15, 3.02, 0.5, 1.55, 0.08, faceMaterial, -0.47);
  addGlyphPanel(group, 3.04, 2.82, 0.5, 1.32, -0.08, faceMaterial, -0.47);
  addGlyphPanel(group, 0.0, 2.48, 1.64, 0.42, 0, faceMaterial, 3.18);

  addRuinedColumn(group, -4.15, -1.95, 2.7, -0.18, stepMaterial, faceMaterial);
  addRuinedColumn(group, 4.25, -1.68, 2.08, 0.24, wornStoneMaterial, faceMaterial);

  addBroadVine(group, -2.88, -0.52, 2.32, 4.9, 0.32, vineMaterial);
  addBroadVine(group, 1.9, -0.5, 2.18, 3.9, -0.28, vineMaterial);

  addSlab(group, -4.8, 2.1, 2.8, 0.44, 0.18, shadowStoneMaterial);
  addSlab(group, 4.85, 1.25, 2.1, -0.36, -0.16, wornStoneMaterial);
  addSlab(group, -0.2, 3.35, 2.4, 0.04, 0.08, baseMaterial);

  group.userData = { innerGlow, gateGlow };

  return group;
}

function makeGlassDome(radius: number, entranceHalfWidth: number, entranceAngle: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-glass-dome-landmark";

  const doorwayAperture = getDomeDoorwayAperture(radius, entranceHalfWidth);
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x92f7ff,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const ribMaterial = new THREE.MeshBasicMaterial({ color: 0xd8fbff });
  const shadowRibMaterial = new THREE.MeshBasicMaterial({ color: 0x4b6eb9 });
  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x273c78 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8fe9,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      28,
      8,
      doorwayAperture.shellGapAngle * 0.5,
      Math.PI * 2 - doorwayAperture.shellGapAngle,
      0,
      Math.PI * 0.5
    ),
    glassMaterial
  );
  glass.rotation.y = entranceAngle;
  glass.renderOrder = 1;
  group.add(glass);

  addDomeBaseCollar(group, radius, entranceAngle, doorwayAperture.visualGapHalfAngle, baseMaterial);

  for (let i = 0; i < 7; i += 1) {
    const angle =
      entranceAngle +
      doorwayAperture.visualGapHalfAngle * 1.08 +
      ((Math.PI * 2 - doorwayAperture.visualGapHalfAngle * 2.16) * i) / 6;
    addDomeRib(group, radius, angle, i % 2 === 0 ? ribMaterial : shadowRibMaterial);
  }

  for (let i = 1; i <= 3; i += 1) {
    const ringRadius = radius * Math.cos((i / 5) * Math.PI * 0.5);
    const y = radius * Math.sin((i / 5) * Math.PI * 0.5);
    addDomeLatitudeRing(group, ringRadius, y, entranceAngle, doorwayAperture.visualGapHalfAngle, i % 2 === 0 ? ribMaterial : shadowRibMaterial);
  }

  const arch = new THREE.Mesh(new THREE.TorusGeometry(entranceHalfWidth, 0.34, 5, 24, Math.PI), ribMaterial);
  arch.position.set(Math.sin(entranceAngle) * (radius - 0.35), 0.96, Math.cos(entranceAngle) * (radius - 0.35));
  arch.rotation.set(0, entranceAngle, 0);
  arch.renderOrder = 2;
  group.add(arch);

  const innerGlow = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.22, 12), glowMaterial);
  innerGlow.rotation.x = -Math.PI / 2;
  innerGlow.position.y = 0.1;
  group.add(innerGlow);

  group.userData = { glass, innerGlow };
  return group;
}

function getDomeDoorwayAperture(radius: number, entranceHalfWidth: number): DomeDoorwayAperture {
  const shellGapAngle = Math.asin(THREE.MathUtils.clamp(entranceHalfWidth / radius, 0.04, 0.4)) * 2.25;
  const visualGapHalfAngle = shellGapAngle * 0.95;
  return {
    shellGapAngle,
    visualGapHalfAngle,
    visualEntranceGapHalfWidth: Math.sin(visualGapHalfAngle) * radius,
    baseCollarGapHalfWidth: Math.sin(visualGapHalfAngle) * radius,
    visualRingGapHalfWidth: Math.sin(visualGapHalfAngle) * radius * domeLowestLatitudeRingScale,
  };
}

function addDomeBaseCollar(group: THREE.Group, radius: number, entranceAngle: number, gapHalfAngle: number, material: THREE.Material): void {
  const segmentCount = 56;
  const step = (Math.PI * 2) / segmentCount;

  for (let i = 0; i < segmentCount; i += 1) {
    const angle = i * step;
    const deltaFromEntrance = Math.atan2(Math.sin(angle - entranceAngle), Math.cos(angle - entranceAngle));
    if (Math.abs(deltaFromEntrance) < gapHalfAngle) continue;

    const segment = new THREE.Mesh(new THREE.BoxGeometry(radius * step * 0.92, 0.08, 2.6), material);
    segment.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    segment.rotation.y = angle;
    segment.renderOrder = 2;
    group.add(segment);
  }
}

function addDomeLatitudeRing(
  group: THREE.Group,
  ringRadius: number,
  y: number,
  entranceAngle: number,
  gapHalfAngle: number,
  material: THREE.Material
): void {
  const arc = Math.PI * 2 - gapHalfAngle * 2;
  const geometry = new THREE.TorusGeometry(ringRadius, 0.24, 5, 112, arc);
  geometry.rotateZ(Math.PI * 0.5 - entranceAngle + gapHalfAngle);
  const ring = new THREE.Mesh(geometry, material);
  ring.position.y = y;
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 2;
  group.add(ring);
}

function addDomeRib(group: THREE.Group, radius: number, angle: number, material: THREE.Material): void {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.5, 0.28, 5, 34, Math.PI), material);
  rib.scale.x = 2;
  rib.rotation.set(0, angle, Math.PI);
  rib.renderOrder = 2;
  group.add(rib);
}

function makeDomeNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "dome-field-note-glass-marker";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x27356f });
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x92f7ff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8fe9,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.28, 0.34, 6), baseMaterial);
  plinth.position.y = 0.17;
  group.add(plinth);

  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.82, 0), glassMaterial);
  shard.position.y = 1.26;
  shard.scale.set(0.72, 1.38, 0.72);
  shard.rotation.set(0.18, Math.PI / 4, -0.12);
  group.add(shard);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.04, 4, 18), glowMaterial);
  halo.position.y = 1.34;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  return group;
}

function makeTempleNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple-field-note-glyph-marker";

  const shardMaterial = new THREE.MeshBasicMaterial({ color: 0x49d7c5 });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x201749 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7bd4,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.05, 0.28, 5), darkMaterial);
  base.position.y = 0.14;
  base.rotation.y = Math.PI / 5;
  group.add(base);

  const shard = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 4), shardMaterial);
  shard.position.y = 1.08;
  shard.rotation.set(0.16, Math.PI / 4, -0.08);
  group.add(shard);

  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), glowMaterial);
  cross.position.set(0.02, 1.1, 0.32);
  cross.rotation.z = 0.72;
  group.add(cross);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 4, 16), glowMaterial.clone());
  halo.position.y = 1.55;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  return group;
}

function makeObservatory(foundationSupports: ObservatoryFoundationSupport[] = []): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-observatory-telescope-landmark";

  const platformMaterial = new THREE.MeshBasicMaterial({ color: 0x202b68 });
  const rimMaterial = new THREE.MeshBasicMaterial({ color: 0x59c1d6 });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x101632 });
  const skirtMaterial = new THREE.MeshBasicMaterial({ color: 0x172052 });
  const telescopeMaterial = new THREE.MeshBasicMaterial({ color: 0xe46bb9 });
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x8dffe0 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x82ffea,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  foundationSupports.forEach((support, index) => {
    const height = Math.max(0.18, support.topY - support.bottomY);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(support.width, height, support.depth),
      index % 2 === 0 ? skirtMaterial : darkMaterial
    );
    post.position.set(support.x, support.bottomY + height * 0.5, support.z);
    post.rotation.y = index % 2 === 0 ? 0.18 : -0.12;
    group.add(post);
  });

  const underside = new THREE.Mesh(new THREE.CylinderGeometry(5.18, 5.9, 0.46, 8), skirtMaterial);
  underside.position.y = 0.12;
  underside.rotation.y = Math.PI / 8;
  underside.scale.z = 0.78;
  group.add(underside);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6.4, 0.72, 8), platformMaterial);
  base.position.y = 0.36;
  base.rotation.y = Math.PI / 8;
  base.scale.z = 0.78;
  group.add(base);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.14, 4, 8), rimMaterial);
  rim.position.y = 0.86;
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.78;
  group.add(rim);

  const steps = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 1.4), darkMaterial);
  steps.position.set(0, 0.28, 4.55);
  steps.rotation.y = 0.04;
  group.add(steps);

  const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 2.55, 5), darkMaterial);
  pier.position.y = 2.0;
  group.add(pier);

  const cradle = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 1.0), rimMaterial);
  cradle.position.set(0, 3.28, -0.16);
  cradle.rotation.z = 0.05;
  group.add(cradle);

  addObservatoryLeg(group, -1.35, 0.9, 1.4, 0.42, darkMaterial);
  addObservatoryLeg(group, 1.28, 0.8, 1.28, -0.36, darkMaterial);
  addObservatoryLeg(group, 0.0, -1.55, 1.55, 0.02, darkMaterial);

  const tubeLength = 5.4;
  const tubeElevation = 0.28;
  const tubeGeometry = new THREE.CylinderGeometry(0.52, 0.66, tubeLength, 6);
  tubeGeometry.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeometry, telescopeMaterial);
  tube.position.set(0, 3.58, -1.35);
  tube.rotation.x = tubeElevation;
  group.add(tube);

  const apertureY = tube.position.y + Math.sin(tubeElevation) * (tubeLength * 0.5);
  const apertureZ = tube.position.z - Math.cos(tubeElevation) * (tubeLength * 0.5);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.58, 6), lensMaterial);
  lens.position.set(0, apertureY, apertureZ - 0.04);
  lens.rotation.x = Math.PI / 2 + tubeElevation;
  group.add(lens);

  const lensGlow = new THREE.Mesh(new THREE.CircleGeometry(0.98, 8), glowMaterial.clone());
  lensGlow.position.copy(lens.position);
  lensGlow.position.z -= 0.05;
  lensGlow.rotation.copy(lens.rotation);
  group.add(lensGlow);

  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.0, 5), darkMaterial);
  eyepiece.geometry.rotateX(Math.PI / 2);
  eyepiece.position.set(0, tube.position.y - Math.sin(tubeElevation) * 2.95, tube.position.z + Math.cos(tubeElevation) * 2.95);
  eyepiece.rotation.x = tubeElevation;
  group.add(eyepiece);

  const reticle = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 4, 16), glowMaterial.clone());
  reticle.position.set(0, apertureY + 0.03, apertureZ - 0.08);
  reticle.rotation.x = Math.PI / 2 + tubeElevation;
  group.add(reticle);

  const sightFin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.88, 3), rimMaterial);
  sightFin.position.set(0, 4.12, -1.2);
  sightFin.rotation.set(0.36, Math.PI, 0);
  group.add(sightFin);

  group.userData = { lensGlow, reticle };
  return group;
}

function addObservatoryLeg(group: THREE.Group, x: number, z: number, height: number, lean: number, material: THREE.Material): void {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, height, 0.26), material);
  leg.position.set(x, 0.8 + height * 0.5, z);
  leg.rotation.set(lean * 0.35, 0, lean);
  group.add(leg);
}

function makeObservatoryNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "observatory-field-note-star-marker";

  const plinthMaterial = new THREE.MeshBasicMaterial({ color: 0x101632 });
  const shardMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36a });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x82ffea,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 1.1, 0.28, 5), plinthMaterial);
  base.position.y = 0.14;
  group.add(base);

  const shard = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.6, 3), shardMaterial);
  shard.position.set(0, 1.02, 0.02);
  shard.rotation.set(0.14, Math.PI / 3, -0.18);
  group.add(shard);

  const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 0.1), glowMaterial);
  glyph.position.set(0.12, 1.14, 0.34);
  glyph.rotation.set(0.04, 0.1, -0.62);
  group.add(glyph);

  return group;
}

type CrashedShipTerrainOffsetSampler = (localX: number, localZ: number) => number;

type CrashedShipSmokePuff = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  radius: number;
  sway: number;
};

type CrashedShipMesh = {
  group: THREE.Group;
  smokePuffs: CrashedShipSmokePuff[];
};

function makeCrashedShip(
  position: LocalPlanetPoint,
  yaw: number,
  anchorAltitude: number,
  heightAt: HeightSampler
): CrashedShipMesh {
  const group = new THREE.Group();
  group.name = "single-crashed-spaceship-landmark";
  const smokePuffs: CrashedShipSmokePuff[] = [];

  const terrainOffsetAt: CrashedShipTerrainOffsetSampler = (localX, localZ) => {
    const world = crashedShipLocalToWorld(position, yaw, localX, localZ);
    return heightAt(world.x, world.z) - anchorAltitude;
  };

  const hullMaterial = new THREE.MeshBasicMaterial({ color: 0x74d9c5 });
  const hullShadeMaterial = new THREE.MeshBasicMaterial({ color: 0x4396b7 });
  const warmPanelMaterial = new THREE.MeshBasicMaterial({ color: 0xffd06f });
  const coralMaterial = new THREE.MeshBasicMaterial({ color: 0xff6f9f });
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x9bfff1,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x1c275f });
  const pipeMaterial = new THREE.MeshBasicMaterial({ color: 0xf6f07c });
  const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x9b63c4 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x8dffe0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  addCrashedShipGroundPatch(group, terrainOffsetAt, 0, -7.2, 7.2, 10.8, groundMaterial, -0.08);
  addCrashedShipGroundPatch(group, terrainOffsetAt, -4.2, -3.8, 3.4, 4.4, groundMaterial, 0.32);

  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hullMaterial);
  hull.position.set(0, terrainOffsetAt(0, 0) + 1.78 - crashedShipBuriedDepth * 0.22, 0);
  hull.scale.set(crashedShipHullWidth * 0.5, 2.56, crashedShipHullLength * 0.46);
  hull.rotation.set(0.02, 0, -0.04);
  group.add(hull);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.44, 12.6), hullShadeMaterial);
  belly.position.set(0.1, terrainOffsetAt(0, 1.6) + 0.88, 1.6);
  belly.rotation.z = 0.03;
  group.add(belly);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), glassMaterial);
  canopy.position.set(-0.35, terrainOffsetAt(-0.4, -3.0) + 3.8, -3.0);
  canopy.scale.set(2.15, 0.9, 2.72);
  canopy.rotation.set(0.05, 0.05, -0.08);
  canopy.renderOrder = 2;
  group.add(canopy);

  addShipWindow(group, -4.42, terrainOffsetAt(-4.4, -3.6) + 2.75, -3.6, glassMaterial);
  addShipWindow(group, -4.68, terrainOffsetAt(-4.7, -0.9) + 2.78, -0.9, glassMaterial);
  addShipWindow(group, -4.36, terrainOffsetAt(-4.4, 1.8) + 2.62, 1.8, glassMaterial);

  const sideBreach = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 3.8), darkMaterial);
  sideBreach.position.set(-4.72, terrainOffsetAt(-4.7, -0.6) + 2.12, -0.6);
  sideBreach.rotation.set(0.04, 0.02, -0.12);
  group.add(sideBreach);
  addCrashedShipSmoke(group, smokePuffs, -5.18, terrainOffsetAt(-5.2, -0.6) + 2.62, -0.6);

  for (let i = 0; i < 4; i += 1) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1 + i * 0.018, 0.12 + i * 0.014, 3.05 - i * 0.18, 5), pipeMaterial);
    pipe.geometry.rotateX(Math.PI / 2);
    pipe.position.set(-4.84, terrainOffsetAt(-4.8, -0.8 + i * 0.42) + 1.58 + i * 0.32, -0.8 + i * 0.42);
    pipe.rotation.set(0.08, 0.16, -0.2 + i * 0.07);
    group.add(pipe);
  }

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.38, 2.25), coralMaterial);
  leftWing.position.set(-6.15, terrainOffsetAt(-6.2, 2.2) + 1.44, 2.2);
  leftWing.rotation.set(0.03, -0.16, -0.12);
  group.add(leftWing);

  const rightWingRoot = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.36, 1.85), coralMaterial);
  rightWingRoot.position.set(5.0, terrainOffsetAt(5, 2.8) + 1.36, 2.8);
  rightWingRoot.rotation.set(-0.08, 0.28, 0.42);
  group.add(rightWingRoot);

  addCrashedShipDebrisPanel(group, terrainOffsetAt, 8.6, 6.8, 4.4, 1.55, 0.34, coralMaterial, -0.52);
  addCrashedShipDebrisPanel(group, terrainOffsetAt, -8.9, -5.7, 3.2, 1.18, 0.22, hullShadeMaterial, 0.36);
  addCrashedShipDebrisPanel(group, terrainOffsetAt, 5.7, -7.8, 2.6, 1.0, 0.2, warmPanelMaterial, 0.12);
  addCrashedShipDebrisPanel(group, terrainOffsetAt, -10.8, 8.4, 2.8, 1.08, 0.22, hullMaterial, -0.18);

  const tailMaterial = new THREE.MeshBasicMaterial({ color: 0x31407e });
  for (const engineX of [-1.72, 1.72]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.36, 1.55, 7), tailMaterial);
    engine.geometry.rotateX(Math.PI / 2);
    engine.position.set(engineX, terrainOffsetAt(engineX, 10.25) + 2.05, 10.25);
    engine.rotation.z = engineX < 0 ? -0.08 : 0.08;
    group.add(engine);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.84, 8), glowMaterial.clone());
    glow.position.set(engineX, terrainOffsetAt(engineX, 11.08) + 2.05, 11.1);
    glow.rotation.x = Math.PI;
    group.add(glow);
  }

  const upperFin = new THREE.Mesh(new THREE.ConeGeometry(1.12, 3.4, 4), coralMaterial);
  upperFin.position.set(0.2, terrainOffsetAt(0.2, 7.0) + 4.25, 7.0);
  upperFin.rotation.set(0.24, Math.PI * 0.25, 0.16);
  upperFin.scale.set(0.74, 1, 1.34);
  group.add(upperFin);

  const crackedBand = new THREE.Mesh(new THREE.TorusGeometry(3.62, 0.11, 5, 18), warmPanelMaterial);
  crackedBand.position.set(0, terrainOffsetAt(0, -8.15) + 1.88, -8.15);
  crackedBand.rotation.set(Math.PI / 2, 0.08, 0.14);
  crackedBand.scale.y = 0.7;
  group.add(crackedBand);

  return { group, smokePuffs };
}

function addCrashedShipGroundPatch(
  group: THREE.Group,
  terrainOffsetAt: CrashedShipTerrainOffsetSampler,
  x: number,
  z: number,
  width: number,
  depth: number,
  material: THREE.Material,
  rotation: number
): void {
  const patch = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 8), material);
  patch.position.set(x, terrainOffsetAt(x, z) + 0.03, z);
  patch.scale.set(width * 0.5, 1, depth * 0.5);
  patch.rotation.y = rotation;
  group.add(patch);
}

function addCrashedShipDebrisPanel(
  group: THREE.Group,
  terrainOffsetAt: CrashedShipTerrainOffsetSampler,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  material: THREE.Material,
  rotation: number
): void {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  panel.position.set(x, terrainOffsetAt(x, z) + height * 0.5 + 0.04, z);
  panel.rotation.set(0.06, rotation, (Math.sin(x + z) * 0.5 + 0.5) * 0.18 - 0.09);
  group.add(panel);
}

function addShipWindow(group: THREE.Group, x: number, y: number, z: number, material: THREE.Material): void {
  const window = new THREE.Mesh(new THREE.CircleGeometry(0.62, 7), material);
  window.position.set(x, y, z);
  window.rotation.y = -Math.PI / 2;
  window.scale.set(1, 0.74, 1);
  window.renderOrder = 3;
  group.add(window);
}

function addCrashedShipSmoke(
  group: THREE.Group,
  smokePuffs: CrashedShipSmokePuff[],
  sourceX: number,
  sourceY: number,
  sourceZ: number
): void {
  const smokeGeometry = new THREE.IcosahedronGeometry(1, 0);
  const smokeColours = [0xbfd7ff, 0xcdb8ff, 0xd8ecec];

  for (let i = 0; i < 7; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: smokeColours[i % smokeColours.length],
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(smokeGeometry, material);
    puff.renderOrder = 4;
    const phase = (i * 0.173 + seededUnit(`${crashedShipSeed}:smoke:${i}`) * 0.11) % 1;
    const baseX = sourceX - 0.05 + (i % 3) * 0.08;
    const baseZ = sourceZ + (i - 3) * 0.06;
    const radius = 0.42 + (i % 4) * 0.08;
    smokePuffs.push({
      mesh: puff,
      baseX,
      baseY: sourceY + i * 0.08,
      baseZ,
      phase,
      radius,
      sway: 0.28 + seededUnit(`${crashedShipSeed}:smoke-sway:${i}`) * 0.5,
    });
    group.add(puff);
  }
}

function updateCrashedShipSmoke(smokePuffs: CrashedShipSmokePuff[], elapsed: number): void {
  smokePuffs.forEach((puff, index) => {
    const cycle = (elapsed * 0.12 + puff.phase) % 1;
    const fadeIn = THREE.MathUtils.smoothstep(cycle, 0, 0.18);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(cycle, 0.62, 1);
    const visibility = fadeIn * fadeOut;
    const rise = cycle * 4.8;
    const sideSway = Math.sin(elapsed * 0.74 + index * 1.72) * puff.sway * (0.22 + cycle * 0.9);
    const forwardSway = Math.cos(elapsed * 0.51 + index * 0.93) * (0.08 + cycle * 0.42);
    const scale = puff.radius * (0.9 + cycle * 1.45);

    puff.mesh.position.set(puff.baseX + sideSway, puff.baseY + rise, puff.baseZ + forwardSway);
    puff.mesh.scale.set(scale * 1.35, scale * 0.82, scale * 1.08);
    puff.mesh.rotation.set(cycle * Math.PI * 0.36, elapsed * 0.16 + index, Math.sin(elapsed * 0.3 + index) * 0.18);
    puff.mesh.material.opacity = visibility * (0.18 + (1 - cycle) * 0.18);
  });
}

function getCrashedShipSmokeState(smokePuffs: CrashedShipSmokePuff[], sourcePosition: LocalPlanetPoint): CrashedShipSmokeState {
  return {
    puffCount: smokePuffs.length,
    sourcePosition,
    samples: smokePuffs.map((puff) => ({
      x: puff.mesh.position.x,
      y: puff.mesh.position.y,
      z: puff.mesh.position.z,
      opacity: puff.mesh.material.opacity,
      scale: puff.mesh.scale.x,
    })),
  };
}

function makeCrashedShipNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "crashed-ship-field-note-marker";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x1c275f });
  const plateMaterial = new THREE.MeshBasicMaterial({ color: 0xffd06f });
  const glyphMaterial = new THREE.MeshBasicMaterial({
    color: 0x8dffe0,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.14, 0.3, 6), baseMaterial);
  base.position.y = 0.15;
  group.add(base);

  const recorder = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.68, 0.42), plateMaterial);
  recorder.position.set(0, 0.76, 0);
  recorder.rotation.set(0.12, 0.28, -0.08);
  group.add(recorder);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.22, 5), glyphMaterial);
  antenna.position.set(0.38, 1.42, 0.02);
  antenna.rotation.z = -0.18;
  group.add(antenna);

  const signal = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 4, 18, Math.PI * 1.35), glyphMaterial.clone());
  signal.position.set(0.48, 1.78, 0.02);
  signal.rotation.set(Math.PI * 0.5, 0, -0.45);
  group.add(signal);

  return group;
}

function makeTalkingStatue(): THREE.Group {
  const group = new THREE.Group();
  group.name = "single-talking-stone-statue-landmark";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x354058 });
  const darkStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x20283d });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x6e7893 });
  const warmStoneMaterial = new THREE.MeshBasicMaterial({ color: 0x9c8fc1 });
  const browMaterial = new THREE.MeshBasicMaterial({ color: 0x161b2c });
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: 0x82ffea,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mouthMaterial = new THREE.MeshBasicMaterial({
    color: 0xff77c8,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fffee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.4, 0.62, 7), baseMaterial);
  plinth.position.y = 0.31;
  plinth.scale.z = 0.82;
  group.add(plinth);

  const lowerBust = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.65, 1.2, 7), darkStoneMaterial);
  lowerBust.position.y = 1.08;
  lowerBust.scale.z = 0.68;
  group.add(lowerBust);

  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.72, 1.35), baseMaterial);
  shoulder.position.set(0, 1.58, -0.04);
  shoulder.rotation.y = 0.03;
  group.add(shoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.32, 1.48, 6), faceMaterial);
  neck.position.y = 2.16;
  neck.scale.z = 0.62;
  group.add(neck);

  const head = new THREE.Group();
  const headBaseY = 4.05;
  head.position.y = headBaseY;
  group.add(head);

  const skull = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.34, 4.7, 7), faceMaterial);
  skull.scale.z = 0.62;
  skull.rotation.y = Math.PI / 7;
  head.add(skull);

  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.54, 1.12), warmStoneMaterial);
  crown.position.set(0, 2.12, 0.02);
  crown.rotation.z = -0.03;
  head.add(crown);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.62, 1.02), darkStoneMaterial);
  jaw.position.set(0, -2.05, 0.03);
  jaw.rotation.z = 0.02;
  head.add(jaw);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.38, 0.42), browMaterial);
  brow.position.set(0, 0.88, 0.72);
  brow.rotation.x = -0.08;
  head.add(brow);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.38, 0.54), warmStoneMaterial);
  nose.position.set(0.02, -0.02, 0.84);
  nose.rotation.x = -0.08;
  head.add(nose);

  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.38), darkStoneMaterial);
  noseBridge.position.set(0.02, 0.56, 0.87);
  head.add(noseBridge);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.16, 0.09), mouthMaterial);
  mouth.position.set(0, -1.1, 0.82);
  head.add(mouth);

  const lowerMouth = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.18, 0.12), browMaterial);
  lowerMouth.position.set(0, -1.25, 0.8);
  head.add(lowerMouth);

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.08), eyeMaterial.clone());
  leftEye.position.set(-0.48, 0.62, 0.86);
  head.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.08), eyeMaterial.clone());
  rightEye.position.set(0.48, 0.62, 0.86);
  head.add(rightEye);

  const leftCheek = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.65, 0.36), darkStoneMaterial);
  leftCheek.position.set(-1.03, -0.52, 0.47);
  leftCheek.rotation.z = -0.08;
  head.add(leftCheek);

  const rightCheek = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.65, 0.36), darkStoneMaterial);
  rightCheek.position.set(1.03, -0.52, 0.47);
  rightCheek.rotation.z = 0.08;
  head.add(rightCheek);

  const glow = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.045, 4, 18), glowMaterial);
  glow.position.set(0, -0.2, 0.98);
  glow.scale.y = 1.55;
  glow.rotation.x = Math.PI / 2;
  head.add(glow);

  const sideGlyphMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36a });
  [-1, 1].forEach((side) => {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.12), sideGlyphMaterial);
    glyph.position.set(side * 1.5, 0.18, 0.18);
    glyph.rotation.set(0.05, side * 0.22, side * 0.2);
    head.add(glyph);
  });

  group.userData = { head, headBaseY, mouth, lowerMouth, leftEye, rightEye, glow };
  return group;
}

function makeRadioTelescopeArray(dishes: RadioTelescopeDishBuildState[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "massive-radio-telescope-array-landmark";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x16234f });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x0e1433 });
  const supportMaterial = new THREE.MeshBasicMaterial({ color: 0x4bc7c9 });
  const dishMaterial = new THREE.MeshBasicMaterial({ color: 0xc9f0e8, side: THREE.DoubleSide });
  const dishBackMaterial = new THREE.MeshBasicMaterial({ color: 0x7d68d6 });
  const feedMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf71 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x87fff0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glows: Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>> = [];

  dishes.forEach((dish, index) => {
    addRadioTelescopeDish(group, dish, index, {
      baseMaterial,
      darkMaterial,
      supportMaterial,
      dishMaterial,
      dishBackMaterial,
      feedMaterial,
      glowMaterial,
      glows,
    });
  });

  addRadioBeam(
    group,
    new THREE.Vector3(dishes[0].localX, dishes[0].baseY + 0.58, dishes[0].localZ),
    new THREE.Vector3(dishes[1].localX, dishes[1].baseY + 0.58, dishes[1].localZ),
    0.18,
    supportMaterial
  );
  addRadioBeam(
    group,
    new THREE.Vector3(dishes[1].localX, dishes[1].baseY + 0.58, dishes[1].localZ),
    new THREE.Vector3(dishes[2].localX, dishes[2].baseY + 0.58, dishes[2].localZ),
    0.18,
    supportMaterial
  );
  addRadioBeam(
    group,
    new THREE.Vector3(dishes[2].localX, dishes[2].baseY + 0.58, dishes[2].localZ),
    new THREE.Vector3(dishes[0].localX, dishes[0].baseY + 0.58, dishes[0].localZ),
    0.18,
    supportMaterial
  );

  group.userData = { radioPulseGlows: glows };
  return group;
}

function addRadioTelescopeDish(
  group: THREE.Group,
  dish: RadioTelescopeDishBuildState,
  index: number,
  materials: {
    baseMaterial: THREE.Material;
    darkMaterial: THREE.Material;
    supportMaterial: THREE.Material;
    dishMaterial: THREE.Material;
    dishBackMaterial: THREE.Material;
    feedMaterial: THREE.Material;
    glowMaterial: THREE.MeshBasicMaterial;
    glows: Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>;
  }
): void {
  const baseY = dish.baseY;
  const dishRadius = index === 1 ? 7.8 : 7.15;
  const dishDepth = index === 1 ? 2.55 : 2.25;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(dish.baseRadius * 0.92, dish.baseRadius * 1.12, 0.62, 8), materials.baseMaterial);
  base.position.set(dish.localX, baseY + 0.31, dish.localZ);
  base.rotation.y = Math.PI / 8 + index * 0.13;
  group.add(base);

  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(dish.baseRadius * 0.92, 0.12, 4, 8), materials.supportMaterial);
  baseRim.position.set(dish.localX, baseY + 0.66, dish.localZ);
  baseRim.rotation.x = Math.PI / 2;
  group.add(baseRim);

  const mastHeight = 6.4 + index * 0.35;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, mastHeight, 5), materials.darkMaterial);
  mast.position.set(dish.localX, baseY + 0.62 + mastHeight * 0.5, dish.localZ);
  mast.rotation.y = index * 0.22;
  group.add(mast);

  const legTop = new THREE.Vector3(dish.localX, baseY + 5.45, dish.localZ);
  [
    [-2.7, -2.15],
    [2.7, -1.9],
    [-2.35, 2.3],
    [2.42, 2.12],
  ].forEach(([x, z], legIndex) => {
    addRadioBeam(
      group,
      new THREE.Vector3(dish.localX + x, baseY + 0.66, dish.localZ + z),
      legTop,
      legIndex % 2 === 0 ? 0.13 : 0.16,
      materials.supportMaterial
    );
  });

  const mount = new THREE.Group();
  mount.position.set(dish.localX, baseY + mastHeight + 0.18, dish.localZ);
  mount.rotation.y = dish.yawOffset;
  group.add(mount);

  const cradle = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.58, 0.9), materials.supportMaterial);
  cradle.position.set(0, 0.28, 0);
  cradle.rotation.z = index === 1 ? -0.04 : 0.04;
  mount.add(cradle);

  const leftYoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.9, 0.52), materials.darkMaterial);
  leftYoke.position.set(-2.62, 1.4, 0.08);
  leftYoke.rotation.z = 0.05;
  mount.add(leftYoke);

  const rightYoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.9, 0.52), materials.darkMaterial);
  rightYoke.position.set(2.62, 1.4, 0.08);
  rightYoke.rotation.z = -0.05;
  mount.add(rightYoke);

  const dishAssembly = new THREE.Group();
  dishAssembly.position.set(0, 2.2, 0.24);
  dishAssembly.rotation.x = -dish.pitch;
  mount.add(dishAssembly);

  const backPlate = new THREE.Mesh(new THREE.CylinderGeometry(dishRadius * 0.42, dishRadius * 0.5, 0.36, 8), materials.dishBackMaterial);
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -dishDepth - 0.15;
  dishAssembly.add(backPlate);

  const bowl = new THREE.Mesh(makeParabolicDishGeometry(dishRadius, dishDepth, 5, 20), materials.dishMaterial);
  bowl.rotation.z = Math.PI / 20;
  dishAssembly.add(bowl);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(dishRadius, 0.18, 4, 20), materials.supportMaterial);
  rim.position.z = 0.02;
  dishAssembly.add(rim);

  const feedPoint = new THREE.Vector3(0, 0, dishRadius * 0.86);
  const feed = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), materials.feedMaterial);
  feed.position.copy(feedPoint);
  feed.rotation.y = Math.PI / 4;
  dishAssembly.add(feed);

  [Math.PI * 0.16, Math.PI * 0.84, Math.PI * 1.5].forEach((angle) => {
    addRadioBeam(
      dishAssembly,
      new THREE.Vector3(Math.cos(angle) * dishRadius * 0.82, Math.sin(angle) * dishRadius * 0.82, 0),
      feedPoint,
      0.055,
      materials.darkMaterial
    );
  });

  addRadioBeam(mount, new THREE.Vector3(0, 1.2, -0.1), new THREE.Vector3(0, 2.2, -dishDepth - 0.2), 0.18, materials.darkMaterial);

  const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(dishRadius * 0.42, 0.045, 4, 18), materials.glowMaterial.clone());
  innerGlow.position.z = 0.08;
  dishAssembly.add(innerGlow);
  materials.glows.push(innerGlow);

  const outerGlow = new THREE.Mesh(new THREE.TorusGeometry(dishRadius * 0.72, 0.035, 4, 20), materials.glowMaterial.clone());
  outerGlow.position.z = 0.11;
  outerGlow.rotation.z = Math.PI / 7;
  dishAssembly.add(outerGlow);
  materials.glows.push(outerGlow);
}

function makeRadioTelescopeNoteMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = "radio-array-field-note-signal-marker";

  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x16234f });
  const signalMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf71 });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x87fff0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.2, 0.3, 6), baseMaterial);
  base.position.y = 0.15;
  group.add(base);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.45, 5), baseMaterial);
  mast.position.y = 0.98;
  group.add(mast);

  const miniDish = new THREE.Mesh(makeParabolicDishGeometry(0.62, 0.28, 3, 10), signalMaterial);
  miniDish.position.set(0, 1.48, 0.12);
  miniDish.rotation.set(-0.62, 0.2, 0.05);
  group.add(miniDish);

  const signal = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 4, 18, Math.PI * 1.35), glowMaterial);
  signal.position.set(0, 1.56, 0.32);
  signal.rotation.set(0.86, 0, -0.42);
  group.add(signal);

  return group;
}

function makeParabolicDishGeometry(radius: number, depth: number, radialSegments: number, angularSegments: number): THREE.BufferGeometry {
  const positions: number[] = [0, 0, -depth];
  const indices: number[] = [];

  for (let radial = 1; radial <= radialSegments; radial += 1) {
    const amount = radial / radialSegments;
    const ringRadius = radius * amount;
    const z = -depth + depth * amount * amount;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, z);
    }
  }

  for (let segment = 0; segment < angularSegments; segment += 1) {
    const current = 1 + segment;
    const next = 1 + ((segment + 1) % angularSegments);
    indices.push(0, current, next);
  }

  for (let radial = 1; radial < radialSegments; radial += 1) {
    const innerStart = 1 + (radial - 1) * angularSegments;
    const outerStart = innerStart + angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const innerA = innerStart + segment;
      const innerB = innerStart + ((segment + 1) % angularSegments);
      const outerA = outerStart + segment;
      const outerB = outerStart + ((segment + 1) % angularSegments);
      indices.push(innerA, outerA, innerB, innerB, outerA, outerB);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRadioBeam(
  group: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) return;

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 4), material);
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  group.add(beam);
}

function addGateSegment(
  group: THREE.Group,
  radius: number,
  tubeRadius: number,
  rotation: number,
  lean: number,
  arc: number,
  material: THREE.Material
): void {
  const segment = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 6, 18, arc), material);
  segment.position.set(0, 4.52, -1.0);
  segment.rotation.set(lean, 0, rotation);
  group.add(segment);
}

function addPrism(group: THREE.Group, points: Array<[number, number]>, depth: number, material: THREE.Material, z = 0): void {
  const halfDepth = depth * 0.5;
  const positions: number[] = [];
  points.forEach(([x, y]) => positions.push(x, y, z + halfDepth));
  points.forEach(([x, y]) => positions.push(x, y, z - halfDepth));

  const indices: number[] = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    indices.push(0, i, i + 1);
    indices.push(points.length, points.length + i + 1, points.length + i);
  }

  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    indices.push(i, next, points.length + next);
    indices.push(i, points.length + next, points.length + i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, material));
}

function addRuinedColumn(
  group: THREE.Group,
  x: number,
  z: number,
  height: number,
  lean: number,
  material: THREE.Material,
  glyphMaterial: THREE.Material
): void {
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, height, 5), material);
  column.position.set(x, 1.2 + height * 0.5, z);
  column.rotation.set(lean * 0.2, 0.14, lean);
  group.add(column);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.46, 0.92), material);
  cap.position.set(x + Math.sin(lean) * 0.32, 1.44 + height, z);
  cap.rotation.set(lean * 0.14, 0.24, lean * 0.45);
  group.add(cap);

  const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.5), glyphMaterial);
  glyph.position.set(x, 1.65 + height * 0.38, z + 0.54);
  glyph.rotation.y = 0.08;
  group.add(glyph);
}

function addSlab(
  group: THREE.Group,
  x: number,
  z: number,
  size: number,
  rotation: number,
  tilt: number,
  material: THREE.Material
): void {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 0.42, size * 0.58), material);
  slab.position.set(x, 0.55, z);
  slab.rotation.set(tilt, rotation, tilt * 0.35);
  group.add(slab);
}

function addGlyphPanel(
  group: THREE.Group,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  material: THREE.Material,
  z: number
): void {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.2), material);
  panel.position.set(x, y, z);
  panel.rotation.y = rotation;
  group.add(panel);
}

function addBroadVine(group: THREE.Group, x: number, z: number, y: number, height: number, lean: number, material: THREE.Material): void {
  const vine = new THREE.Mesh(new THREE.BoxGeometry(0.42, height, 0.24), material);
  vine.position.set(x, y + height * 0.5, z);
  vine.rotation.set(0.1, 0, lean);
  group.add(vine);

  const wrap = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.38, 0.24), material);
  wrap.position.set(x + Math.sign(lean || 1) * 0.42, y + height * 0.62, z + 0.04);
  wrap.rotation.set(0.08, 0, -lean * 0.7);
  group.add(wrap);
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}

function seededUnit(seed: string): number {
  return createSeededRandom(seed)();
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
