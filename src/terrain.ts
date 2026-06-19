import * as THREE from "three";

export function heightAt(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const island = Math.max(0, 1 - Math.pow(d / 106, 2.28));
  const ridges = Math.sin(x * 0.18) * Math.cos(z * 0.16) * 1.45;
  const alienPulse = Math.sin((x + z) * 0.07) * 0.85 + Math.sin(Math.hypot(x, z) * 0.28) * 0.7;
  const northShoulder = Math.max(0, 1 - Math.abs(z + 55) / 24) * (1 - Math.min(Math.abs(x) / 106, 1)) * 3.1;
  const westShelf = Math.max(0, 1 - Math.abs(x + 64) / 26) * (1 - Math.min(Math.abs(z) / 96, 1)) * 1.8;
  return island * (ridges + alienPulse + 8.5) - 3.2 + northShoulder + westShelf + mountainHeightAt(x, z);
}

function mountainHeightAt(x: number, z: number): number {
  const northBelt = Math.max(0, 1 - Math.abs(z + 72) / 28);
  const northTaper = 1 - Math.min(Math.abs(x) / 116, 1);
  const northCrests = Math.pow(northBelt, 1.8) * Math.pow(Math.max(0, northTaper), 0.75);
  const serration = 0.64 + Math.abs(Math.sin(x * 0.105 + Math.sin(z * 0.045) * 1.8)) * 0.56;

  const sideMasses =
    mound(x, z, -78, -42, 18, 24, 7.8) +
    mound(x, z, 82, -54, 20, 28, 9.4) +
    mound(x, z, 74, 34, 18, 22, 6.5);

  return northCrests * serration * 14.5 + sideMasses;
}

function mound(x: number, z: number, centerX: number, centerZ: number, radiusX: number, radiusZ: number, height: number): number {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  return Math.max(0, 1 - dx * dx - dz * dz) * height;
}

export function makeTerrain(): THREE.Mesh {
  const size = 220;
  const segments = 80;
  const cellSize = size / segments;
  const halfSize = size / 2;
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const terrainPalette = [
    new THREE.Color(0x9b63c4),
    new THREE.Color(0x6e78df),
    new THREE.Color(0x52b8bb),
    new THREE.Color(0xb6c95b),
    new THREE.Color(0xec7fb2),
    new THREE.Color(0xffb15e),
  ];

  for (let zIndex = 0; zIndex < segments; zIndex += 1) {
    for (let xIndex = 0; xIndex < segments; xIndex += 1) {
      const x0 = -halfSize + xIndex * cellSize;
      const x1 = x0 + cellSize;
      const z0 = -halfSize + zIndex * cellSize;
      const z1 = z0 + cellSize;
      const y00 = heightAt(x0, z0);
      const y10 = heightAt(x1, z0);
      const y01 = heightAt(x0, z1);
      const y11 = heightAt(x1, z1);
      const centerX = (x0 + x1) * 0.5;
      const centerZ = (z0 + z1) * 0.5;
      const centerY = (y00 + y10 + y01 + y11) * 0.25;

      const altitude = THREE.MathUtils.clamp((centerY + 2) / 14, 0, 1);
      const mineral = (Math.sin(centerX * 0.15) + Math.cos(centerZ * 0.12) + 2) / 4;
      const pixelFleck = (Math.sin(centerX * 1.45 + centerZ * 2.1) + 1) * 0.5;
      const palettePosition = altitude * 0.64 + mineral * 0.28 + pixelFleck * 0.08;
      const band = THREE.MathUtils.clamp(Math.floor(palettePosition * terrainPalette.length), 0, terrainPalette.length - 1);
      const colour = terrainPalette[band];
      const vertexIndex = positions.length / 3;

      positions.push(x0, y00, z0, x1, y10, z0, x0, y01, z1, x1, y11, z1);

      for (let i = 0; i < 4; i += 1) {
        colours.push(colour.r, colour.g, colour.b);
      }

      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

export function makeHorizonLandforms(): THREE.Group {
  const group = new THREE.Group();
  const crestMaterial = new THREE.MeshBasicMaterial({ color: 0x4e2d88, side: THREE.DoubleSide });
  const butteMaterial = new THREE.MeshBasicMaterial({ color: 0xd25598, side: THREE.DoubleSide });

  addCrestStones(group, crestMaterial);
  addSideButtes(group, butteMaterial);
  return group;
}

function addCrestStones(group: THREE.Group, material: THREE.Material): void {
  const placements = [
    { x: -58, z: -74, height: 2.4, radius: 1.8, lean: -0.35 },
    { x: -34, z: -80, height: 3.3, radius: 2.2, lean: 0.22 },
    { x: -8, z: -73, height: 2.8, radius: 1.9, lean: -0.16 },
    { x: 21, z: -78, height: 3.7, radius: 2.4, lean: 0.31 },
    { x: 52, z: -70, height: 2.6, radius: 1.8, lean: -0.24 },
  ];

  placements.forEach(({ x, z, height, radius, lean }) => {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    crest.position.set(x, heightAt(x, z) + height * 0.5 - 0.08, z);
    crest.rotation.set(lean * 0.25, x * 0.01, lean);
    crest.scale.x = 1.2;
    crest.scale.z = 0.7;
    group.add(crest);
  });
}

function addSideButtes(group: THREE.Group, material: THREE.Material): void {
  const placements = [
    { x: -86, z: -48, height: 13, radius: 7, lean: -0.28 },
    { x: -72, z: 64, height: 10, radius: 6, lean: 0.22 },
    { x: 78, z: -62, height: 15, radius: 8, lean: 0.34 },
    { x: 92, z: 28, height: 11, radius: 6, lean: -0.18 },
  ];

  placements.forEach(({ x, z, height, radius, lean }) => {
    const butte = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    butte.position.set(x, heightAt(x, z) + height * 0.5 - 0.8, z);
    butte.rotation.set(lean * 0.25, x * 0.01, lean);
    butte.scale.x = 1.4;
    butte.scale.z = 0.72;
    group.add(butte);
  });
}
