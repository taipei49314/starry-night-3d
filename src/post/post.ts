// M9 post-processing chain (§4.9, §6):
//   scene -> sceneRT (HalfFloat, samples = q.msaa, depth, no DepthTexture)
//   -> TexturePass into an EffectComposer with its own NON-multisampled HalfFloat targets (§8 risk 6)
//   -> UnrealBloomPass (threshold 1.0, radius 0.6, strength = f.bloom; runs at q.bloomScale)
//   -> Painterly Lens ShaderPass -> OutputPass (NeutralToneMapping at f.exposure, sRGB). ACES is forbidden.
// All sizes are drawing-buffer pixels: Math.round(css * pixelRatio).
import {
  HalfFloatType, NeutralToneMapping, SRGBColorSpace, Vector2, WebGLRenderTarget,
  type PerspectiveCamera, type Scene, type ShaderMaterial, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { PostChain, PostFrame, QualitySettings, SharedUniforms } from '../contracts';
import { createPainterlyLens, setLensQuality, type LensOptions } from './painterlyLens';

export const BLOOM_THRESHOLD = 1.0;
export const BLOOM_RADIUS = 0.6;

/** PostChain plus handles for harnesses, the debug overlay and acceptance checks. */
export interface PostInternals extends PostChain {
  readonly composer: EffectComposer;
  readonly sceneRT: WebGLRenderTarget;
  readonly bloom: UnrealBloomPass;
  readonly lens: ShaderMaterial;
  /** Current drawing-buffer size [w, h]. */
  readonly bufferSize: readonly [number, number];
  /** Rebuild lens defines with new options (e.g. toe compensation off); harness use. */
  setLensOptions(opts: LensOptions): void;
  dispose(): void;
}

export function createPost(renderer: WebGLRenderer, u: SharedUniforms, q: QualitySettings): PostInternals {
  let quality = q;
  let lensOpts: LensOptions = {};
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const db = renderer.getDrawingBufferSize(new Vector2());
  let bufW = Math.max(1, Math.round(db.x));
  let bufH = Math.max(1, Math.round(db.y));

  // Scene target: multisampled per tier, resolved by three after renderer.render().
  const sceneRT = new WebGLRenderTarget(bufW, bufH, {
    type: HalfFloatType, samples: q.msaa, depthBuffer: true, stencilBuffer: false,
  });
  sceneRT.texture.name = 'post.sceneRT';

  // Composer targets: never multisampled (renderTarget2 is a clone of this one).
  const composerRT = new WebGLRenderTarget(bufW, bufH, {
    type: HalfFloatType, samples: 0, depthBuffer: false, stencilBuffer: false,
  });
  composerRT.texture.name = 'post.composer';
  const composer = new EffectComposer(renderer, composerRT);
  composer.setPixelRatio(1); // every size handed to the composer is already in drawing-buffer px

  const texturePass = new TexturePass(sceneRT.texture);

  const bloomRes = (w: number, h: number) =>
    // the stock pass halves internally: hand it 2x the wanted top-mip size
    [Math.max(2, Math.round(w * quality.bloomScale * 2)), Math.max(2, Math.round(h * quality.bloomScale * 2))] as const;
  const [bw0, bh0] = bloomRes(bufW, bufH);
  const bloom = new UnrealBloomPass(new Vector2(bw0, bh0), 0, BLOOM_RADIUS, BLOOM_THRESHOLD);
  const stockBloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w: number, h: number) => {
    const [bw, bh] = bloomRes(w, h);
    stockBloomSetSize(bw, bh);
  };

  const lens = createPainterlyLens(u, q, lensOpts);
  const lensPass = new ShaderPass(lens);
  // ShaderPass only adopts a material by `instanceof ShaderMaterial`; with two three copies in a dev server
  // (late dependency optimisation) it would silently clone the uniforms. Pin the material explicitly.
  lensPass.material = lens;
  lensPass.uniforms = lens.uniforms;
  const outputPass = new OutputPass();

  composer.addPass(texturePass);
  composer.addPass(bloom);
  composer.addPass(lensPass);
  composer.addPass(outputPass);

  const lu = lens.uniforms;
  const applySize = () => {
    sceneRT.setSize(bufW, bufH);
    composer.setSize(bufW, bufH); // resizes rt1/rt2 and every pass (bloom through the wrapper)
    lu.uLensRes.value.set(bufW, bufH);
  };
  applySize();

  const chain: PostInternals = {
    composer, sceneRT, bloom, lens,
    get bufferSize() { return [bufW, bufH] as const; },

    render(scene: Scene, camera: PerspectiveCamera, f: PostFrame): void {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      bloom.strength = f.bloom;
      bloom.enabled = f.bloom > 0;
      renderer.toneMappingExposure = f.exposure;
      lu.uLensMatte.value = f.matte;
      lu.uLensAlign.value = f.align;
      lu.uLensSmear.value = f.smear;
      lu.uLensFade.value = f.fade;
      lu.uLensExposure.value = f.exposure;
      const r = f.canvasRectPx;
      lu.uCanvasRect.value.set(r[0], r[1], r[2], r[3]);

      composer.render(0);
    },

    setSize(cssW: number, cssH: number, pixelRatio: number): void {
      const w = Math.max(1, Math.round(cssW * pixelRatio));
      const h = Math.max(1, Math.round(cssH * pixelRatio));
      if (w === bufW && h === bufH) return;
      bufW = w;
      bufH = h;
      applySize();
    },

    setQuality(nq: QualitySettings): void {
      const bloomChanged = nq.bloomScale !== quality.bloomScale;
      quality = nq;
      setLensQuality(lens, nq, lensOpts);
      if (sceneRT.samples !== nq.msaa) {
        sceneRT.samples = nq.msaa;
        sceneRT.dispose(); // three re-creates the framebuffers with the new sample count on next use
      }
      if (bloomChanged) bloom.setSize(bufW, bufH);
    },

    setLensOptions(opts: LensOptions): void {
      lensOpts = { ...opts };
      setLensQuality(lens, quality, lensOpts);
    },

    dispose(): void {
      sceneRT.dispose();
      composer.dispose();
      texturePass.dispose();
      bloom.dispose();
      lensPass.dispose();
      outputPass.dispose();
    },
  };
  return chain;
}
