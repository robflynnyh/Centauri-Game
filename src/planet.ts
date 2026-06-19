import * as THREE from "three";

export type LocalPlanetPoint = {
  x: number;
  z: number;
};

export type PlanetFrame = {
  up: THREE.Vector3;
  east: THREE.Vector3;
  localZ: THREE.Vector3;
};

// Normal walk speed is 6.4 world units per second. At that speed, a 25 minute
// equatorial walk covers 6.4 * 25 * 60 = 9600 units, giving this planet radius.
export const PLANET_ASSUMED_WALK_SPEED = 6.4;
export const PLANET_TARGET_CIRCUMNAVIGATION_SECONDS = 25 * 60;
export const PLANET_CIRCUMFERENCE = PLANET_ASSUMED_WALK_SPEED * PLANET_TARGET_CIRCUMNAVIGATION_SECONDS;
export const PLANET_RADIUS = PLANET_CIRCUMFERENCE / (Math.PI * 2);
export const PLANET_DETAIL_REPEATS = 40;
export const PLANET_DETAIL_PERIOD = PLANET_CIRCUMFERENCE / PLANET_DETAIL_REPEATS;

const fullTurn = Math.PI * 2;
const halfTurn = Math.PI;
const quarterTurn = Math.PI * 0.5;
const frameMatrix = new THREE.Matrix4();
const localRotationQuaternion = new THREE.Quaternion();

function wrapAngle(angle: number): number {
  return THREE.MathUtils.euclideanModulo(angle + halfTurn, fullTurn) - halfTurn;
}

function wrapDetailCoordinate(value: number): number {
  return THREE.MathUtils.euclideanModulo(value + PLANET_DETAIL_PERIOD * 0.5, PLANET_DETAIL_PERIOD) - PLANET_DETAIL_PERIOD * 0.5;
}

export function normalizePlanetCoords(x: number, z: number): LocalPlanetPoint {
  let longitude = x / PLANET_RADIUS;
  let latitude = z / PLANET_RADIUS;

  while (latitude > quarterTurn) {
    latitude = halfTurn - latitude;
    longitude += halfTurn;
  }

  while (latitude < -quarterTurn) {
    latitude = -halfTurn - latitude;
    longitude += halfTurn;
  }

  return {
    x: wrapAngle(longitude) * PLANET_RADIUS,
    z: latitude * PLANET_RADIUS,
  };
}

export function normalizeLocalVector(vector: THREE.Vector3): void {
  const normalized = normalizePlanetCoords(vector.x, vector.z);
  vector.x = normalized.x;
  vector.z = normalized.z;
}

export function detailCoordinatesAt(x: number, z: number): LocalPlanetPoint {
  const normalized = normalizePlanetCoords(x, z);
  return {
    x: wrapDetailCoordinate(normalized.x),
    z: wrapDetailCoordinate(normalized.z),
  };
}

export function planetFrameAt(x: number, z: number): PlanetFrame {
  const normalized = normalizePlanetCoords(x, z);
  const longitude = normalized.x / PLANET_RADIUS;
  const latitude = normalized.z / PLANET_RADIUS;
  const cosLatitude = Math.cos(latitude);
  const sinLatitude = Math.sin(latitude);
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);

  const up = new THREE.Vector3(cosLatitude * sinLongitude, cosLatitude * cosLongitude, sinLatitude).normalize();
  const east = new THREE.Vector3(cosLongitude, -sinLongitude, 0).normalize();
  const localZ = new THREE.Vector3(-sinLatitude * sinLongitude, -sinLatitude * cosLongitude, cosLatitude).normalize();

  return { up, east, localZ };
}

export function planetFrameQuaternion(x: number, z: number): THREE.Quaternion {
  const frame = planetFrameAt(x, z);
  frameMatrix.makeBasis(frame.east, frame.up, frame.localZ);
  return new THREE.Quaternion().setFromRotationMatrix(frameMatrix);
}

export function pointOnPlanet(x: number, z: number, altitude = 0): THREE.Vector3 {
  const frame = planetFrameAt(x, z);
  return frame.up.multiplyScalar(PLANET_RADIUS + altitude);
}

export function placeObjectOnPlanet(
  object: THREE.Object3D,
  x: number,
  z: number,
  altitude = 0,
  localRotation = new THREE.Euler()
): void {
  object.position.copy(pointOnPlanet(x, z, altitude));
  localRotationQuaternion.setFromEuler(localRotation);
  object.quaternion.copy(planetFrameQuaternion(x, z)).multiply(localRotationQuaternion);
}

export function setCameraOnPlanet(
  camera: THREE.Camera,
  x: number,
  z: number,
  altitude: number,
  yaw: number,
  pitch: number
): void {
  const frame = planetFrameAt(x, z);
  const localCameraRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));

  camera.position.copy(pointOnPlanet(x, z, altitude));
  camera.up.copy(frame.up);
  camera.quaternion.copy(planetFrameQuaternion(x, z)).multiply(localCameraRotation);
}

export function lookAtPlanetPoint(
  camera: THREE.Camera,
  x: number,
  z: number,
  altitude: number,
  targetX: number,
  targetZ: number,
  targetAltitude: number
): void {
  camera.position.copy(pointOnPlanet(x, z, altitude));
  camera.up.copy(planetFrameAt(x, z).up);
  camera.lookAt(pointOnPlanet(targetX, targetZ, targetAltitude));
}

export function surfaceDistanceBetweenLocal(a: LocalPlanetPoint, b: LocalPlanetPoint): number {
  return pointOnPlanet(a.x, a.z).normalize().angleTo(pointOnPlanet(b.x, b.z).normalize()) * PLANET_RADIUS;
}
