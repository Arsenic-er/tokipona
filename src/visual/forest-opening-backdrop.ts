import type { ForestCameraState } from "../runtime/forest-camera";


const hash = (n: number): number => {
  let value = Math.imul(n ^ 0x47a29, 0x45d9f3b);
  value ^= value >>> 16;
  return value >>> 0;
};

/** Authored silhouette vocabulary, sampled at native pixels. No screen-seeded noise. */
export function drawForestOpeningBackdrop(
  context: CanvasRenderingContext2D,
  camera: ForestCameraState,
  worldMinute: number,
): void {
  const daylight = Math.max(0, Math.min(1, (worldMinute - 360) / 180));
  const sky = daylight > 0.5 ? ["#818777", "#697d73", "#526b62"] : ["#777b6a", "#64766b", "#486158"];
  for (let y = 0; y < camera.height; y += 1) {
    const band = Math.min(2, Math.floor(y / 110));
    context.fillStyle = sky[band]!;
    context.fillRect(0, y, camera.width, 1);
  }

  // Broad distant ridges leave sky openings; tree groups are not a vertical wallpaper.
  context.fillStyle = "#435a53";
  for (let x = 0; x < camera.width; x += 1) {
    const worldX = x + camera.x * 0.1;
    const ridge = Math.round(164 + Math.sin(worldX / 96) * 18 + Math.sin(worldX / 213) * 24 - (camera.y - 320) * 0.1);
    context.fillRect(x, ridge, 1, Math.max(0, camera.height - ridge));
  }
  treeLayer(context, camera, 0.18, 108, "#3b514a", "#40564c", false);
  treeLayer(context, camera, 0.43, 236, "#2b3d36", "#31463b", true);

  // The opening is on the surface. Depth-dependent darkness enters gradually,
  // without painting an opaque ceiling across the character's route.
  if (camera.y > 620) {
    context.fillStyle = `rgba(12,23,24,${Math.min(0.65, (camera.y - 620) / 600)})`;
    context.fillRect(0, 0, camera.width, camera.height);
  }
}

function treeLayer(
  context: CanvasRenderingContext2D,
  camera: ForestCameraState,
  ratio: number,
  spacing: number,
  bark: string,
  leaves: string,
  near: boolean,
): void {
  const origin = camera.x * ratio;
  const first = Math.floor(origin / spacing) - 2;
  const last = Math.ceil((origin + camera.width) / spacing) + 1;
  for (let index = first; index <= last; index += 1) {
    const seed = hash(index + (near ? 901 : 131));
    const x = Math.round(index * spacing + seed % 71 - origin);
    const base = Math.round(286 + seed % 35 - (camera.y - 320) * ratio);
    const width = near ? 30 + seed % 23 : 6 + seed % 11;
    const height = near ? 360 + seed % 130 : 180 + seed % 75;
    const lean = (seed % 3 - 1) * (near ? 26 : 9);
    const top = base - height;
    context.fillStyle = bark;
    polygon(context, [
      [x - width, base], [x - width / 2, base - 27], [x - width / 3, top + 60],
      [x + lean, top], [x + lean + width / 2, top], [x + width / 2, base - 48],
      [x + width * 1.8, base],
    ]);
    for (const direction of [-1, 1]) {
      const branchY = top + height * (near ? 0.47 : 0.31);
      const reach = (near ? 94 : 32) + seed % 36;
      polygon(context, [
        [x, branchY + 38], [x + direction * reach * 0.63, branchY - 10],
        [x + direction * reach, branchY - 38], [x + direction * reach * 0.7, branchY + 2],
        [x + direction * width / 2, branchY + 61],
      ]);
      context.fillStyle = leaves;
      crown(context, x + direction * reach, branchY - 39, near ? 100 : 49, near ? 33 : 24, seed + direction);
      context.fillStyle = bark;
    }
    if (near) {
      context.fillStyle = "#35473b";
      for (let line = 0; line < 4; line += 1) {
        const lineX = x - width / 3 + line * 6;
        polygon(context, [[lineX, base - 25], [lineX + lean * 0.4, top + 45],
          [lineX + lean * 0.4 + 2, top + 54], [lineX + 2, base - 39]]);
      }
      context.fillStyle = bark;
      polygon(context, [[x - 8, base - 23], [x - 65, base + 3], [x - 82, base + 8], [x - 24, base + 2], [x + 12, base - 5]]);
    }
    context.fillStyle = leaves;
    crown(context, x + lean, top + 24, near ? 125 : 49, near ? 48 : 28, seed);
  }
}

function crown(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, seed: number): void {
  const points: number[][] = [];
  for (let step = 0; step <= 12; step += 1) {
    const t = step / 12;
    const bulge = Math.sin(t * Math.PI);
    points.push([x - width + t * width * 2, y - bulge * height - hash(seed + step) % 9]);
  }
  for (let step = 12; step >= 0; step -= 1) {
    const t = step / 12;
    points.push([x - width + t * width * 2, y + Math.sin(t * Math.PI) * height * 0.5 + hash(seed - step) % 7]);
  }
  polygon(context, points);
}

/** Scanline fill avoids antialiased vector edges in the native pixel canvas. */
function polygon(context: CanvasRenderingContext2D, points: readonly (readonly number[])[]): void {
  const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]!))));
  const bottom = Math.min(context.canvas.height, Math.ceil(Math.max(...points.map((point) => point[1]!))));
  for (let y = top; y < bottom; y += 1) {
    const intersections: number[] = [];
    for (let edge = 0; edge < points.length; edge += 1) {
      const a = points[edge]!;
      const b = points[(edge + 1) % points.length]!;
      if ((a[1]! <= y && b[1]! > y) || (b[1]! <= y && a[1]! > y)) {
        intersections.push(a[0]! + (y - a[1]!) / (b[1]! - a[1]!) * (b[0]! - a[0]!));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let pair = 0; pair + 1 < intersections.length; pair += 2) {
      const left = Math.max(0, Math.round(intersections[pair]!));
      const right = Math.min(context.canvas.width, Math.round(intersections[pair + 1]!));
      if (right > left) context.fillRect(left, y, right - left, 1);
    }
  }
}
