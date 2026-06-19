import * as THREE from "three";

export type PixelRenderPipeline = {
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

// One low-resolution scene pixel becomes a 4x4 screen block after the nearest-filter upscale.
const pixelRenderScale = 4;

export function createPixelRenderPipeline(renderer: THREE.WebGLRenderer, width: number, height: number): PixelRenderPipeline {
  let outputWidth = 1;
  let outputHeight = 1;

  const lowResolutionScene = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  lowResolutionScene.texture.name = "centauri-low-resolution-scene";
  lowResolutionScene.texture.generateMipmaps = false;

  const screenScene = new THREE.Scene();
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: lowResolutionScene.texture,
    toneMapped: false,
  });
  const screenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMaterial);
  screenQuad.frustumCulled = false;
  screenScene.add(screenQuad);

  const resize = (nextWidth: number, nextHeight: number): void => {
    outputWidth = Math.max(1, Math.floor(nextWidth));
    outputHeight = Math.max(1, Math.floor(nextHeight));

    const lowWidth = Math.max(1, Math.round(outputWidth / pixelRenderScale));
    const lowHeight = Math.max(1, Math.round(outputHeight / pixelRenderScale));
    lowResolutionScene.setSize(lowWidth, lowHeight);
    renderer.setSize(outputWidth, outputHeight);
  };

  const render = (scene: THREE.Scene, camera: THREE.Camera): void => {
    renderer.setRenderTarget(lowResolutionScene);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, outputWidth, outputHeight);
    renderer.clear();
    renderer.render(screenScene, screenCamera);
  };

  const dispose = (): void => {
    lowResolutionScene.dispose();
    screenQuad.geometry.dispose();
    screenMaterial.dispose();
  };

  resize(width, height);

  return { render, resize, dispose };
}
