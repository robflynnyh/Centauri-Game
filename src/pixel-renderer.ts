import * as THREE from "three";

export type PixelRenderPipeline = {
  render: (scene: THREE.Scene, camera: THREE.Camera, options?: PixelRenderOptions) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

export type PixelRenderOptions = {
  elapsed?: number;
  isolationAmount?: number;
  prismAmount?: number;
};

// One low-resolution scene pixel becomes a 4x4 screen block after the nearest-filter upscale.
const pixelRenderScale = 4;

export function createPixelRenderPipeline(renderer: THREE.WebGLRenderer, width: number, height: number): PixelRenderPipeline {
  let outputWidth = 1;
  let outputHeight = 1;

  const screenUniforms = {
    sceneTexture: { value: null as THREE.Texture | null },
    lowResolution: { value: new THREE.Vector2(1, 1) },
    elapsed: { value: 0 },
    isolationAmount: { value: 0 },
    prismAmount: { value: 0 },
  };

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
  screenUniforms.sceneTexture.value = lowResolutionScene.texture;
  const screenMaterial = new THREE.ShaderMaterial({
    uniforms: screenUniforms,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D sceneTexture;
      uniform vec2 lowResolution;
      uniform float elapsed;
      uniform float isolationAmount;
      uniform float prismAmount;
      varying vec2 vUv;

      void main() {
        vec4 base = texture2D(sceneTexture, vUv);
        float amount = clamp(isolationAmount, 0.0, 1.0);
        float prism = clamp(prismAmount, 0.0, 1.0);

        if (amount <= 0.001 && prism <= 0.001) {
          gl_FragColor = base;
          return;
        }

        vec3 colour = base.rgb;
        vec2 texel = 1.0 / max(lowResolution, vec2(1.0));

        if (prism > 0.001) {
          vec2 centered = vUv * 2.0 - 1.0;
          float wave = sin(elapsed * 1.7 + centered.x * 7.0 - centered.y * 4.0);
          vec2 prismDirection = normalize(vec2(0.58 + sin(elapsed * 0.31) * 0.18, 0.36 + cos(elapsed * 0.27) * 0.14));
          vec2 prismOffset = prismDirection * texel * prism * (1.6 + wave * 0.55);
          vec3 split = vec3(
            texture2D(sceneTexture, vUv + prismOffset * 1.3).r,
            texture2D(sceneTexture, vUv - prismOffset * 0.2).g,
            texture2D(sceneTexture, vUv - prismOffset * 1.15).b
          );
          float shimmer = 0.5 + 0.5 * sin(elapsed * 2.6 + centered.x * 15.0 + centered.y * 9.0);
          vec3 spectralTint = vec3(
            0.5 + 0.5 * sin(elapsed * 0.53 + centered.y * 5.0),
            0.5 + 0.5 * sin(elapsed * 0.47 + 2.1 + centered.x * 4.0),
            0.5 + 0.5 * sin(elapsed * 0.51 + 4.2 - centered.y * 3.0)
          );
          float edge = smoothstep(0.12, 0.46, length(abs(split - base.rgb)));
          colour = mix(colour, split, prism * (0.24 + edge * 0.12));
          colour += spectralTint * prism * (0.035 + shimmer * 0.025 + edge * 0.03);
        }

        vec2 centered = vUv * 2.0 - 1.0;
        vec2 direction = normalize(vec2(
          sin(elapsed * 0.37) + centered.y * 0.18,
          cos(elapsed * 0.31) - centered.x * 0.14
        ));
        float breath = 0.5 + 0.5 * sin(elapsed * 1.05);
        vec2 offset = direction * texel * amount * (3.0 + breath * 2.7);

        vec3 ghostA = texture2D(sceneTexture, vUv + offset).rgb;
        vec3 ghostB = texture2D(sceneTexture, vUv - offset * 0.72).rgb;
        vec3 doubled = mix(ghostA, ghostB, 0.44);
        vec3 horizontalEdge = abs(
          texture2D(sceneTexture, vUv + vec2(texel.x, 0.0)).rgb -
          texture2D(sceneTexture, vUv - vec2(texel.x, 0.0)).rgb
        );
        vec3 verticalEdge = abs(
          texture2D(sceneTexture, vUv + vec2(0.0, texel.y)).rgb -
          texture2D(sceneTexture, vUv - vec2(0.0, texel.y)).rgb
        );
        float edgeSignal = smoothstep(0.05, 0.32, length(horizontalEdge + verticalEdge));

        vec3 chroma = vec3(
          texture2D(sceneTexture, vUv + offset * 0.55).r,
          base.g,
          texture2D(sceneTexture, vUv - offset * 0.45).b
        );

        float ghostStrength = amount * (0.2 + breath * 0.14 + edgeSignal * 0.12);
        float chromaStrength = amount * (0.34 + edgeSignal * 0.16);
        colour = mix(colour, chroma, chromaStrength);
        colour = mix(colour, doubled, ghostStrength);
        vec3 echoDifference = abs(doubled - base.rgb);
        colour += echoDifference * amount * (0.26 + breath * 0.18 + edgeSignal * 0.18);
        colour += echoDifference * vec3(0.38, 0.12, 0.52) * amount * (0.56 + breath * 0.34);

        vec3 phase = vec3(
          0.5 + 0.5 * sin(elapsed * 0.43 + 0.3),
          0.5 + 0.5 * sin(elapsed * 0.37 + 2.0),
          0.5 + 0.5 * sin(elapsed * 0.41 + 4.1)
        );
        colour = mix(colour, colour * (0.92 + phase * 0.18) + vec3(0.025, 0.0, 0.04), amount * 0.18);

        float edge = smoothstep(0.58, 1.34, length(centered));
        float edgePulse = 0.5 + 0.5 * sin(elapsed * 0.68 + length(centered) * 7.0);
        vec3 edgeTint = vec3(0.025, 0.075, 0.09) * edge * amount * (0.35 + edgePulse * 0.65);
        colour = colour * (1.0 - edge * amount * 0.08) + edgeTint;

        gl_FragColor = vec4(clamp(colour, 0.0, 1.0), base.a);
      }
    `,
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
    screenUniforms.lowResolution.value.set(lowWidth, lowHeight);
    renderer.setSize(outputWidth, outputHeight);
  };

  const render = (scene: THREE.Scene, camera: THREE.Camera, options: PixelRenderOptions = {}): void => {
    screenUniforms.elapsed.value = options.elapsed ?? 0;
    screenUniforms.isolationAmount.value = THREE.MathUtils.clamp(options.isolationAmount ?? 0, 0, 1);
    screenUniforms.prismAmount.value = THREE.MathUtils.clamp(options.prismAmount ?? 0, 0, 1);

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
