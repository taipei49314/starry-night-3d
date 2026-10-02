import { PALETTE, type PaletteKey } from '../contracts';

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function srgbHexToLinear(hex: number): [number, number, number] {
  return [toLinear(((hex >> 16) & 255) / 255), toLinear(((hex >> 8) & 255) / 255), toLinear((hex & 255) / 255)];
}

export function linearToSrgbHex(r: number, g: number, b: number): number {
  const q = (c: number) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, Math.min(1, c))) * 255)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

/** Colour as stored in a stroke record (a2.x / a2.y): the sRGB hex as a float, exact below 2^24. */
export function packSrgb(hex: number): number {
  return hex & 0xffffff;
}

/** Mix two sRGB hex colours in linear light. */
export function mixHex(a: number, b: number, t: number): number {
  const A = srgbHexToLinear(a);
  const B = srgbHexToLinear(b);
  return linearToSrgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Scale an sRGB hex colour's linear intensity (0.85 = 15 % darker). */
export function shadeHex(hex: number, k: number): number {
  const A = srgbHexToLinear(hex);
  return linearToSrgbHex(A[0] * k, A[1] * k, A[2] * k);
}

/** Pick along a multi-stop sRGB ramp, t in [0, 1]. */
export function rampHex(stops: readonly number[], t: number): number {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mixHex(stops[i], stops[i + 1], x - i);
}

export const PAL_LINEAR = Object.fromEntries(
  (Object.keys(PALETTE) as PaletteKey[]).map((k) => [k, srgbHexToLinear(PALETTE[k])]),
) as Record<PaletteKey, [number, number, number]>;
