import { describe, expect, it, vi } from "vitest";
import { forestGroundCover, drawForestGroundCover } from "./forest-ground-cover";
import { FOREST_MATERIAL as M, type ForestMaterialChunk } from "../world/forest-chunk-stream";

function chunks(floor = 16, material: number = M.soil): ForestMaterialChunk[] {
  return Array.from({ length: 24 }, (_, index) => {
    const chunkX = index % 8, chunkY = Math.floor(index / 8);
    return { chunkX, chunkY, digest: `sha256:${index}`, materials: Uint8Array.from({ length: 256 }, (_, i) =>
      chunkY * 16 + Math.floor(i / 16) >= floor ? material : M.air) };
  });
}

describe("collision-anchored nonblocking ground cover", () => {
  it("places bases on actual soil including a chunk seam, and bounds height below the player", () => {
    const terrain = chunks();
    const cover = forestGroundCover(terrain);
    expect(cover.length).toBeGreaterThan(3);
    expect(cover.every(p => p.y === 16 && p.height >= 2 && p.height <= 7)).toBe(true);
    expect(forestGroundCover(terrain)).toBe(cover);
    expect(forestGroundCover(chunks(24)).map(p => p.y)).toEqual(cover.map(() => 24));
  });
  it("does not invent support in air, water, rock, missing neighbors or later districts", () => {
    for (const material of [M.air, M.water, M.stone]) expect(forestGroundCover(chunks(16, material))).toEqual([]);
    expect(forestGroundCover(chunks().filter(c => c.chunkY !== 0))).toEqual([]);
    expect(forestGroundCover(chunks().map(c => ({ ...c, chunkX: c.chunkX + 200 })))).toEqual([]);
  });
  it("does not grow through a low ceiling or change material bytes", () => {
    const terrain = chunks();
    terrain.filter(c => c.chunkY === 0).forEach(c => c.materials.fill(M.stone, 0, 240));
    const before = terrain.map(c => c.materials.slice());
    expect(forestGroundCover(terrain)).toEqual([]);
    expect(terrain.map(c => c.materials)).toEqual(before);
  });
  it("draws the same world plants at every zoom/pan with no clock-dependent detail", () => {
    const terrain = chunks();
    const context = { fillRect: vi.fn(), fillStyle: "" } as unknown as CanvasRenderingContext2D;
    const camera = { x: 0, y: 0, width: 853, height: 480, facing: "right" as const };
    drawForestGroundCover(context, terrain, camera);
    const first = vi.mocked(context.fillRect).mock.calls.map(args => [...args]);
    vi.mocked(context.fillRect).mockClear();
    drawForestGroundCover(context, terrain, { ...camera, x: 1, y: 1, width: 320, height: 180 });
    expect(vi.mocked(context.fillRect).mock.calls).toEqual(first.map(([x, y, w, h]) => [x! - 1, y! - 1, w, h]));
  });
});
