/**
 * Builds an sRGB color string from an OKLCH triple, matching the CSS
 * `oklch()` values used verbatim in the Miravelt design tokens.
 *
 * `lightness` is 0-1, `chroma` is unitless, `hue` is in degrees.
 */
export function oklch(lightness: number, chroma: number, hue: number, alpha = 1): string {
  const hueRad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRad);
  const b = chroma * Math.sin(hueRad);

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${toSrgbByte(r)}, ${toSrgbByte(g)}, ${toSrgbByte(bl)}, ${Number(clampedAlpha.toFixed(3))})`;
}

function toSrgbByte(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
}
