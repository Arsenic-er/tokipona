import { describe, expect, it } from "vitest";
import generated from "../generated/content-runtime.v0.1.json";
import { readRuntimeForestSpatialManifest } from "../content/runtime-forest-spatial-manifest";
import { generateForestRegion } from "./forest-region-generator";
import { ForestChunkStream, FOREST_MATERIAL } from "./forest-chunk-stream";
import { ForestGrayboxRuntime } from "./forest-graybox-runtime";

const manifest = readRuntimeForestSpatialManifest(generated);
const region = generateForestRegion(manifest, "opening.surface.compatibility");

describe("opening surface geology", () => {
  it("retains bounded jump timing on save/load and clears it at checkpoints", () => {
    const options = { manifest, region, openingSurface: true };
    const source = new ForestGrayboxRuntime(options);
    source.advanceTicks(120);
    const save = source.save();
    expect(save.jumpGrace?.coyote).toBe(0.1);
    const loaded = ForestGrayboxRuntime.fromSave(options, save);
    expect(loaded.save()).toEqual(save);
    source.advanceTicks(4, { jump: true });
    loaded.advanceTicks(4, { jump: true });
    expect(loaded.snapshot()).toEqual(source.snapshot());
    loaded.resetToCheckpoint();
    expect(loaded.save().jumpGrace).toBeUndefined();
    for (const invalid of [null, { coyote: -1, buffer: 0 }, { coyote: 0, buffer: 1 }, { coyote: NaN, buffer: 0 }]) {
      expect(() => ForestGrayboxRuntime.fromSave(options, { ...save, jumpGrace: invalid } as never)).toThrow(/save state/);
    }
  });
  it("queries zoomed/panned material without mutating the saved simulation camera", () => {
    const runtime = new ForestGrayboxRuntime({ manifest, region, openingSurface: true });
    const before = runtime.save();
    const chunks = runtime.visibleMaterialChunks({ x: 100, y: 200, width: 853, height: 480 });
    expect(chunks.some(({ chunkX }) => chunkX === 59)).toBe(true);
    expect(chunks.some(({ chunkY }) => chunkY === 42)).toBe(true);
    expect(runtime.save()).toEqual(before);
    expect(runtime.visibleMaterialChunks({ x: 100, y: 200, width: 853, height: 480 })).toBe(chunks);
  });
  it("opens the arrival to sky while keeping existing contact heights", () => {
    const legacy = new ForestChunkStream(manifest, region);
    const terrain = new ForestChunkStream(manifest, region, { openingSurface: true });
    for (const x of [512, 700, 1100, 1664, 1840, 2144, 2400]) {
      const y = terrain.openingSurfaceY(x)!;
      expect(terrain.materialAt(x, y - 100)).toBe(FOREST_MATERIAL.air);
      expect(terrain.isSolid({ x, y: y - 14, width: 1, height: 14 })).toBe(false);
      expect(terrain.isSolid({ x, y, width: 1, height: 1 })).toBe(true);
      expect(legacy.isSolid({ x, y, width: 1, height: 1 })).toBe(true);
    }
  });

  it("keeps sealed gates and later districts out of the new opening geology", () => {
    const legacy = new ForestChunkStream(manifest, region);
    const terrain = new ForestChunkStream(manifest, region, { openingSurface: true });
    for (const [x, y] of [[3360, 176], [5312, 1400], [6560, 900], [9240, 2180]]) {
      expect(terrain.materialAt(x!, y!)).toBe(legacy.materialAt(x!, y!));
    }
  });

  it("loads an old route save without resetting progress and saves a jump above the former ceiling", () => {
    const legacy = new ForestGrayboxRuntime({ manifest, region });
    legacy.advanceTicks(120);
    const oldSave = legacy.save();
    const options = { manifest, region, openingSurface: true };
    const surface = ForestGrayboxRuntime.fromSave(options, oldSave);
    expect(surface.save()).toEqual(oldSave);
    surface.advanceTicks(12, { jump: true });
    expect(surface.playerSnapshot().position.y).toBeLessThan(oldSave.player.y - 20);
    const airborneSave = surface.save();
    expect(ForestGrayboxRuntime.fromSave(options, airborneSave).save()).toEqual(airborneSave);
  });
});
