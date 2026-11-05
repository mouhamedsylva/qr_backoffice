/**
 * Génération d'une palette (nuances 50 → 950) à partir d'une couleur de
 * marque, dans l'espace OKLCH (perceptuellement uniforme). La nuance 500,
 * utilisée pour les boutons, est assombrie si nécessaire pour garantir un
 * contraste WCAG AA (4,5:1) avec le texte blanc.
 */

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];
export type Palette = Record<Shade, string>;

/** Luminosité OKLCH visée pour chaque nuance. */
const LIGHTNESS: Record<Shade, number> = {
  50: 0.975, 100: 0.945, 200: 0.89, 300: 0.82, 400: 0.72, 500: 0.6,
  600: 0.52, 700: 0.45, 800: 0.38, 900: 0.32, 950: 0.23,
};

/** Saturation relative : plus faible aux extrêmes, pour des teintes naturelles. */
const CHROMA_FACTOR: Record<Shade, number> = {
  50: 0.12, 100: 0.25, 200: 0.45, 300: 0.7, 400: 0.9, 500: 1,
  600: 0.95, 700: 0.85, 800: 0.72, 900: 0.6, 950: 0.45,
};

const MAX_CHROMA = 0.25;
export const AA_CONTRAST = 4.5;

type Rgb = [number, number, number]; // composantes sRGB 0–1

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = m[1]!.length === 3 ? m[1]!.replace(/./g, (c) => c + c) : m[1]!;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as Rgb;
}

export function toHex([r, g, b]: Rgb): string {
  const c = (x: number) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB → OKLCH (L 0–1, C ≥ 0, H en degrés). */
export function rgbToOklch(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** OKLCH → sRGB, non borné (peut sortir de la gamme). */
function oklchToRgbRaw(L: number, C: number, H: number): Rgb {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -0.0001 && c <= 1.0001);

/** OKLCH → sRGB dans la gamme : la saturation est réduite si nécessaire. */
export function oklchToRgb(L: number, C: number, H: number): Rgb {
  let c = C;
  let rgb = oklchToRgbRaw(L, c, H);
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.005);
    rgb = oklchToRgbRaw(L, c, H);
  }
  return rgb;
}

/** Luminance relative WCAG. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Palette complète, ou null si la couleur est invalide. */
export function generatePalette(hex: string): Palette | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [, chroma, hue] = rgbToOklch(rgb);
  const c0 = Math.min(chroma, MAX_CHROMA);

  const palette = {} as Palette;
  for (const shade of SHADES) {
    palette[shade] = toHex(oklchToRgb(LIGHTNESS[shade], c0 * CHROMA_FACTOR[shade], hue));
  }
  // Boutons lisibles : assombrir la nuance 500 jusqu'au contraste AA.
  let l500 = LIGHTNESS[500];
  while (contrastRatio(palette[500], '#ffffff') < AA_CONTRAST && l500 > LIGHTNESS[600]) {
    l500 -= 0.01;
    palette[500] = toHex(oklchToRgb(l500, c0, hue));
  }
  return palette;
}
