// Quality tiers (§7.3): GPU-string detection and tier ordering. No storage, no DOM beyond the GL context.
import type { WebGLRenderer } from 'three';
import { QUALITY_PRESETS, type QualitySettings, type Tier } from '../contracts';

/** Tiers from best to worst. Automatic changes only ever move right (never raise a tier automatically). */
export const TIER_ORDER: readonly Tier[] = ['high', 'medium', 'low'];

/** The next lower tier, or null when already at 'low'. */
export function lowerTier(t: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(t);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

/** A fresh copy of a tier preset (callers may mutate it; the presets stay frozen in practice). */
export function qualityForTier(t: Tier): QualitySettings {
  return { ...QUALITY_PRESETS[t] };
}

/** Validates a URL/HUD tier string ('high' | 'medium' | 'low'); anything else returns null. */
export function parseTier(s: string | null | undefined): Tier | null {
  return s === 'high' || s === 'medium' || s === 'low' ? s : null;
}

// §7.3 tier detection regexes. Microsoft Basic Render Driver (WARP, a CPU rasteriser like SwiftShader/llvmpipe) is
// added to the Low list.
const LOW_RE = /Intel|UHD|Iris|Mesa|SwiftShader|llvmpipe|Basic Render/i;
const MEDIUM_RE = /Apple|Adreno|Mali|Radeon(?!.*RX)/i;

/** Pure classifier of a GPU renderer string (§7.3): Low, then Medium, otherwise High. */
export function tierFromRendererString(s: string): Tier {
  if (LOW_RE.test(s)) return 'low';
  if (MEDIUM_RE.test(s)) return 'medium';
  return 'high';
}

/**
 * The best available GPU description: WEBGL_debug_renderer_info's UNMASKED_RENDERER_WEBGL when exposed, else the
 * plain RENDERER string (Firefox returns a sanitised real name there; Safari returns 'WebKit WebGL').
 */
export function rendererString(renderer: WebGLRenderer): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return typeof s === 'string' ? s : '';
  } catch {
    return '';
  }
}

/** §7.3 tier detection from the GPU string. The 90-frame benchmark refines it later (DynamicResolution). */
export function detectTier(renderer: WebGLRenderer): Tier {
  return tierFromRendererString(rendererString(renderer));
}
