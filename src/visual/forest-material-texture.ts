import { FOREST_MATERIAL as M } from "../world/forest-chunk-stream";

type Rgb = readonly [number, number, number];
type Palette = readonly Rgb[];

// Original code-native textures, informed by Noita's official screenshots.
// Discrete pixel clusters, not resized concept art or extracted game textures.
const ROCK: Palette = [[28,30,37],[35,38,46],[43,47,56],[53,57,67],[64,69,79],[77,82,90],[94,97,102]];
const EARTH: Palette = [[47,40,28],[57,48,31],[67,56,35],[78,65,40],[88,74,46],[100,85,54],[113,97,62]];
const WET: Palette = [[32,33,28],[39,39,31],[47,45,34],[56,52,37],[64,60,42],[76,69,49],[88,80,58]];
const WOOD: Palette = [[39,29,23],[52,37,25],[66,47,29],[82,60,35],[98,74,45],[113,86,54],[130,103,68]];
const MOSS: Palette = [[45,51,31],[58,64,35],[69,75,40],[82,86,46],[95,97,55]];
const OTHER: Readonly<Record<number, Palette>> = {
  [M.protected_mass]: [[24,26,31],[29,32,39],[35,38,46]],
  [M.metal]: [[67,68,62],[86,85,73],[110,102,78]],
  [M.water]: [[31,69,76],[33,76,83],[36,82,88]],
  [M.vegetation]: MOSS,
  [M.ember]: [[142,61,27],[179,98,41],[211,136,57]],
  [M.ash]: [[58,54,49],[72,67,58],[83,80,70]],
};

function hash(x: number, y: number): number {
  let value = Math.imul(x ^ 0x91a7, 374761393) ^ Math.imul(y ^ 0x6a09, 668265263);
  // Avalanche both axes before using low bits. A single xor-shift preserved
  // coordinate correlations, producing a visible grid instead of mineral grit.
  value = Math.imul(value ^ value >>> 16, 2246822507);
  value = Math.imul(value ^ value >>> 13, 3266489909);
  return (value ^ value >>> 16) >>> 0;
}

/** Continuous field sampled on the native pixel grid; quantized by palettes. */
function field(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const dx = x - ix, dy = y - iy;
  const fx = dx * dx * (3 - 2 * dx), fy = dy * dy * (3 - 2 * dy);
  const value = (a: number, b: number) => (hash(a, b) & 255) / 255;
  return (value(ix, iy) * (1 - fx) + value(ix + 1, iy) * fx) * (1 - fy) +
    (value(ix, iy + 1) * (1 - fx) + value(ix + 1, iy + 1) * fx) * fy;
}

function shade(palette: Palette, index: number): Rgb {
  return palette[Math.max(0, Math.min(palette.length - 1, Math.floor(index)))]!;
}

/** Distance to actual exposed material, not a decorative second terrain mask. */
export interface ForestMaterialExposure {
  readonly top: number;
  readonly side: boolean;
  readonly bottom: boolean;
}

const INTERIOR: ForestMaterialExposure = { top: 0, side: false, bottom: false };

export function forestMaterialColor(
  material: number, x: number, y: number, exposure = INTERIOR,
): Rgb {
  const grain = hash(x, y);
  if (material === M.stone) {
    // Dark cool rock, with irregular 1–3 px mineral aggregates concentrated in
    // patches. No periodic horizontal bands and no full-surface white speckle.
    const mass = field(x / 23 + field(y / 31, 7) * 2, y / 19);
    const mineral = field(x / 2.7, y / 2.1);
    const patch = field(x / 9, y / 8);
    let index = mass < 0.36 ? 0 : mass > 0.7 ? 2 : 1;
    if (mineral > 0.56 && patch > 0.44) index += mineral > 0.73 ? 3 : 2;
    if (grain % 13 === 0 && index >= 3) index++;
    if (exposure.top === 1 && grain % 4 !== 0) index++;
    if (exposure.side && grain % 3 === 0) index++;
    if (exposure.bottom) index--;
    return shade(ROCK, index);
  }
  if (material === M.soil || material === M.wet_soil) {
    // Compact earth clods and sparse grit; wet earth keeps the same structure
    // but darkens. Neither becomes a gray stone face or a neon-green grass bar.
    const clod = field(x / 4.3, y / 3.1);
    const bank = field(x / 21, y / 15);
    let index = 1 + clod * 3 + bank;
    if (grain % 11 < 2) index++;
    if (grain % 17 === 0) index--;
    if (exposure.top > 0) {
      const growth = field(x / 13, y / 17);
      if (growth > 0.46 && exposure.top <= 1 + hash(Math.floor(x / 3), 9) % 3 && grain % 5 !== 0) {
        return shade(MOSS, 1 + clod * 2 - (exposure.top > 1 ? 1 : 0));
      }
      if (exposure.top === 1) index++;
    }
    if (exposure.bottom) index--;
    return shade(material === M.wet_soil ? WET : EARTH, index);
  }
  if (material === M.wood) {
    return woodColor(x, y);
  }
  const palette = OTHER[material] ?? OTHER[M.protected_mass]!;
  if (material === M.water) return shade(palette, Math.floor(y / 3) % 3);
  return shade(palette, grain % palette.length);
}

function woodColor(x: number, y: number): Rgb {
  // Long, interrupted fibres with slow meanders, not a generic rock noise.
  const warp = Math.floor(field(x / 15, y / 12) * 3);
  const fibreY = y + warp;
  const fibre = hash(Math.floor(x / 13), fibreY);
  const seam = ((fibreY % 4) + 4) % 4;
  let index = seam === 0 ? 1 : seam === 1 ? 4 : 3;
  if (fibre % 5 === 0) index--;
  if (hash(x, y) % 19 === 0) index++;
  return shade(WOOD, index);
}

export interface ForestMaterialRun {
  readonly x: number; readonly y: number; readonly width: number; readonly color: string;
}

const objectRuns = new Map<string, readonly ForestMaterialRun[]>();

/** Object-local texels move with a body. Every contact pixel remains visible:
 * the existing AABB solver is unchanged; this is not a polygon-physics claim. */
export function forestObjectMaterialRuns(
  kind: "stone" | "deadwood", width: number, height: number, variant: number,
): readonly ForestMaterialRun[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256) {
    throw new Error("forest object texture requires bounded integer dimensions");
  }
  const key = `${kind}:${width}:${height}:${variant}`;
  const cached = objectRuns.get(key);
  if (cached) return cached;
  const rgbAt = (x: number, y: number): Rgb => {
    const grain = hash(x + variant * 97, y + variant * 23);
    if (kind === "stone") {
      const facet = x + y * 0.55 < width * 0.85 ? 1 : 0;
      let index = 2 + facet + (grain % 5 === 0 ? 1 : 0);
      // Asymmetric faces and a short diagonal fissure; avoid the old equal
      // horizontal stripes that made both boulders look like masonry blocks.
      if (y > height * 0.66) index--;
      if (x > width * 0.72) index--;
      const crack = Math.floor(width * 0.35 + y * 0.28 + variant % 2);
      if (x === crack && y > height * 0.2 && y < height * 0.8) index -= 2;
      if (y === 0 || x === 0 || x === width - 1 || y === height - 1) index--;
      if ((x === 0 || x === width - 1) && (y < 2 || y >= height - 2)) index = 0;
      return shade(ROCK, index);
    }
    if (x >= width - Math.min(3, width)) {
      // Small end-grain section in the same native grid, not a bright white cap.
      return shade(WOOD, y === 0 || y === height - 1 ? 1 : (x + y) % 3 === 0 ? 3 : 5);
    }
    if (y === height - 1) return WOOD[1]!;
    if (y === 0) return shade(WOOD, grain % 4 === 0 ? 2 : 4);
    return woodColor(x + variant * 17, y);
  };
  const runs: ForestMaterialRun[] = [];
  const colorAt = (x: number, y: number) => `rgb(${rgbAt(x, y).join(",")})`;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const color = colorAt(x, y), start = x++;
      while (x < width && colorAt(x, y) === color) x++;
      runs.push(Object.freeze({ x: start, y, width: x - start, color }));
    }
  }
  const result = Object.freeze(runs);
  objectRuns.set(key, result);
  if (objectRuns.size > 32) objectRuns.delete(objectRuns.keys().next().value!);
  return result;
}
