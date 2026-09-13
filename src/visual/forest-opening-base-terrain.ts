import type { ForestCameraState } from "../runtime/forest-camera";
import type { ForestMaterialChunk } from "../world/forest-chunk-stream";

const colors = ["", "#191f1d", "#3f3d28", "#26342f", "#1f2725", "#463724", "#50574d", "#235258", "#495b3d", "#b36229", "#535046"];

/** Immediately available collision-faithful surface while optional texture code loads. */
export function drawForestOpeningBaseTerrain(
  context: CanvasRenderingContext2D,
  chunks: readonly ForestMaterialChunk[],
  camera: ForestCameraState,
): void {
  for (const chunk of chunks) for (let row = 0; row < 16; row += 1) {
    const y = chunk.chunkY * 16 + row - Math.round(camera.y);
    if (y < 0 || y >= camera.height) continue;
    let left = 0;
    while (left < 16) {
      const material = chunk.materials[row * 16 + left]!;
      let right = left + 1;
      while (right < 16 && chunk.materials[row * 16 + right] === material) right += 1;
      if (material !== 0) {
        context.fillStyle = colors[material]!;
        context.fillRect(chunk.chunkX * 16 + left - Math.round(camera.x), y, right - left, 1);
      }
      left = right;
    }
  }
}
