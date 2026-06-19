import * as THREE from "three";
import type { CollisionObstacle } from "./collision";

type HeightSampler = (x: number, z: number) => number;
type AddCollisionObstacle = (obstacle: CollisionObstacle) => void;

export function populateNature(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  addCollisionObstacle: AddCollisionObstacle
): { floraGroup: THREE.Group; natureGroup: THREE.Group } {
  const floraGroup = new THREE.Group();
  scene.add(floraGroup);

  const natureGroup = new THREE.Group();
  scene.add(natureGroup);

  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5c9e });
  const stalkMaterial = new THREE.MeshBasicMaterial({ color: 0x55c7ba });
  const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x3f2b92 });
  const canopyMaterial = new THREE.MeshBasicMaterial({ color: 0x8dff86 });
  const canopyAccentMaterial = new THREE.MeshBasicMaterial({ color: 0xffb84f });
  const reedMaterial = new THREE.MeshBasicMaterial({ color: 0xc5ff4f });
  const bloomMaterial = new THREE.MeshBasicMaterial({ color: 0xff58df });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x66edf0,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
  });
  const stoneMaterial = new THREE.MeshBasicMaterial({ color: 0x6b55d8 });

  const addFlora = (seed: number): void => {
    const angle = seed * 2.399963;
    const radius = 8 + ((seed * 17) % 43);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = heightAt(x, z);

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 2.6 + (seed % 5) * 0.35, 5), stalkMaterial);
    stalk.position.set(x, y + 1.2, z);
    stalk.rotation.z = Math.sin(seed) * 0.18;
    floraGroup.add(stalk);

    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + (seed % 4) * 0.12, 0), markerMaterial);
    cap.position.set(x, y + 2.8 + (seed % 3) * 0.18, z);
    cap.rotation.set(seed * 0.12, seed * 0.2, seed * 0.07);
    floraGroup.add(cap);
  };

  const addAlienTree = (x: number, z: number, scale: number, lean: number): void => {
    const y = heightAt(x, z);
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.rotation.y = x * 0.11 + z * 0.07;
    tree.scale.setScalar(scale);

    const trunkLeanX = Math.sin(lean) * 0.08;
    const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 3.7, 6), trunkMaterial);
    lowerTrunk.position.set(trunkLeanX, 1.78, 0);
    lowerTrunk.rotation.z = lean * 0.07;
    tree.add(lowerTrunk);

    const upperTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.35, 5), trunkMaterial);
    upperTrunk.position.set(trunkLeanX * 1.6, 3.92, 0);
    upperTrunk.rotation.z = lean * 0.05;
    tree.add(upperTrunk);

    const lowerCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 0), canopyAccentMaterial);
    lowerCrown.position.set(trunkLeanX * 1.5, 3.88, 0);
    lowerCrown.scale.set(1.28, 0.48, 1.22);
    lowerCrown.rotation.set(0.12, lean, 0.04);
    tree.add(lowerCrown);

    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), canopyMaterial);
    crown.position.set(trunkLeanX * 1.8, 4.38, 0);
    crown.scale.set(1.5, 0.76, 1.48);
    crown.rotation.set(0.16, lean, -0.04);
    tree.add(crown);

    const collar = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), canopyAccentMaterial);
    collar.position.set(trunkLeanX * 1.5, 4.05, 0);
    collar.scale.set(0.9, 0.5, 0.9);
    collar.rotation.set(0.12, lean, -0.06);
    tree.add(collar);

    for (let i = 0; i < 5; i += 1) {
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + i * 0.012, 0), bloomMaterial);
      const angle = i * 1.34 + lean;
      bead.position.set(trunkLeanX + Math.cos(angle) * 0.68, 3.66 - i * 0.2, Math.sin(angle) * 0.68);
      tree.add(bead);
    }

    natureGroup.add(tree);
    addCollisionObstacle({ kind: "tree", x, z, radius: 1.15 * scale });
  };

  const addGroundSprout = (seed: number): void => {
    const angle = seed * 2.13;
    const radius = 5 + ((seed * 29) % 49);
    const x = Math.cos(angle) * radius + Math.sin(seed * 0.7) * 2.4;
    const z = Math.sin(angle) * radius + Math.cos(seed * 0.41) * 2.4;
    const y = heightAt(x, z);
    const sprout = new THREE.Group();
    sprout.position.set(x, y + 0.08, z);
    sprout.rotation.y = angle;

    const bladeCount = 3 + (seed % 4);
    for (let i = 0; i < bladeCount; i += 1) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8 + (seed % 5) * 0.09, 4), reedMaterial);
      const bladeAngle = (i / bladeCount) * Math.PI * 2;
      blade.position.set(Math.cos(bladeAngle) * 0.18, 0.36, Math.sin(bladeAngle) * 0.18);
      blade.rotation.set(0.22 + i * 0.06, 0, bladeAngle);
      sprout.add(blade);
    }

    if (seed % 3 === 0) {
      const bloom = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + (seed % 4) * 0.035, 0), bloomMaterial);
      bloom.position.y = 0.88;
      bloom.rotation.set(seed * 0.18, seed * 0.33, seed * 0.12);
      sprout.add(bloom);
    }

    natureGroup.add(sprout);
  };

  for (let i = 1; i <= 74; i += 1) {
    addFlora(i);
  }

  treePlacements.forEach(({ x, z, scale, lean }) => addAlienTree(x, z, scale, lean));

  for (let i = 1; i <= 120; i += 1) {
    addGroundSprout(i);
  }

  addPool(natureGroup, heightAt, waterMaterial, stoneMaterial, 5.5, 7.5, 3.4, 0.1);
  addPool(natureGroup, heightAt, waterMaterial, stoneMaterial, -18, -3, 2.5, 0.45);
  addPool(natureGroup, heightAt, waterMaterial, stoneMaterial, 21, -15, 2.2, 0.8);
  addStream(natureGroup, heightAt, waterMaterial);
  addRocks(scene, heightAt, stoneMaterial, addCollisionObstacle);

  return { floraGroup, natureGroup };
}

const treePlacements = [
  { x: -7, z: 11, scale: 0.86, lean: -0.8 },
  { x: 9, z: 7, scale: 1.05, lean: 0.45 },
  { x: 15, z: -5, scale: 0.92, lean: 0.9 },
  { x: -17, z: -10, scale: 1.16, lean: -0.35 },
  { x: 23, z: 15, scale: 0.82, lean: 0.2 },
  { x: -25, z: 16, scale: 0.94, lean: -1.0 },
  { x: 2, z: -21, scale: 1.08, lean: 0.72 },
  { x: 32, z: -18, scale: 0.78, lean: -0.62 },
  { x: -33, z: -2, scale: 0.88, lean: 0.58 },
];

function makePoolGeometry(
  heightAt: HeightSampler,
  x: number,
  z: number,
  radius: number,
  rotation: number,
  scaleX: number,
  scaleZ: number
): THREE.BufferGeometry {
  const segments = 22;
  const positions: number[] = [x, heightAt(x, z) + 0.045, z];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * scaleX;
    const localZ = Math.sin(angle) * radius * scaleZ;
    const worldX = x + Math.cos(rotation) * localX - Math.sin(rotation) * localZ;
    const worldZ = z + Math.sin(rotation) * localX + Math.cos(rotation) * localZ;
    positions.push(worldX, heightAt(worldX, worldZ) + 0.045, worldZ);
  }

  for (let i = 1; i <= segments; i += 1) {
    indices.push(0, i, i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addPool(
  natureGroup: THREE.Group,
  heightAt: HeightSampler,
  waterMaterial: THREE.MeshBasicMaterial,
  stoneMaterial: THREE.MeshBasicMaterial,
  x: number,
  z: number,
  radius: number,
  colourShift: number
): void {
  const pool = new THREE.Group();

  const water = new THREE.Mesh(makePoolGeometry(heightAt, x, z, radius, colourShift, 1.45, 0.78), waterMaterial.clone());
  const waterMat = water.material as THREE.MeshBasicMaterial;
  waterMat.color.offsetHSL(colourShift * 0.018, -0.05, -0.02);
  pool.add(water);

  const innerGlow = new THREE.Mesh(
    makePoolGeometry(heightAt, x, z, radius * 0.56, colourShift, 1.3, 0.68),
    new THREE.MeshBasicMaterial({ color: 0xbaffff, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
  );
  pool.add(innerGlow);

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * 1.28;
    const localZ = Math.sin(angle) * radius * 0.72;
    const worldX = x + Math.cos(colourShift) * localX - Math.sin(colourShift) * localZ;
    const worldZ = z + Math.sin(colourShift) * localX + Math.cos(colourShift) * localZ;
    const rim = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 4) * 0.06, 0), stoneMaterial);
    rim.position.set(worldX, heightAt(worldX, worldZ) + 0.16, worldZ);
    rim.rotation.set(i * 0.2, i * 0.3, i * 0.17);
    pool.add(rim);
  }

  natureGroup.add(pool);
}

function addStream(natureGroup: THREE.Group, heightAt: HeightSampler, waterMaterial: THREE.MeshBasicMaterial): void {
  const streamPoints = [
    new THREE.Vector3(-12, 0, 7),
    new THREE.Vector3(-6, 0, 8),
    new THREE.Vector3(0, 0, 6),
    new THREE.Vector3(5.5, 0, 7.5),
    new THREE.Vector3(11, 0, 4),
  ];
  const stream = new THREE.Mesh(makeStreamGeometry(heightAt, streamPoints), waterMaterial);
  stream.renderOrder = 1;
  natureGroup.add(stream);
}

function makeStreamGeometry(heightAt: HeightSampler, points: THREE.Vector3[]): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const samples = 72;
  const halfWidth = 0.34;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const leftX = point.x + side.x;
    const leftZ = point.z + side.z;
    const rightX = point.x - side.x;
    const rightZ = point.z - side.z;
    positions.push(leftX, heightAt(leftX, leftZ) + 0.055, leftZ);
    positions.push(rightX, heightAt(rightX, rightZ) + 0.055, rightZ);
  }

  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRocks(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  stoneMaterial: THREE.MeshBasicMaterial,
  addCollisionObstacle: AddCollisionObstacle
): void {
  const rockPlacements = Array.from({ length: 34 }, (_, i) => {
    const angle = i * 1.71;
    const radius = 10 + ((i * 23) % 50);
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      size: 0.9 + (i % 5) * 0.28,
      rotation: new THREE.Euler(i * 0.2, i * 0.4, i * 0.1),
    };
  });

  rockPlacements.forEach(({ x, z, size, rotation }) => {
    const y = heightAt(x, z);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stoneMaterial);
    stone.position.set(x, y + 0.7, z);
    stone.rotation.copy(rotation);
    scene.add(stone);
    addCollisionObstacle({ kind: "rock", x, z, radius: size * 0.72 });
  });
}
