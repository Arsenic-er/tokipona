import { describe, expect, it } from 'vitest';
import generated from '../generated/content-runtime.v0.1.json';
import { readRuntimeForestOpeningManifest } from '../content/runtime-forest-opening-manifest';
import { readRuntimeForestSpatialManifest } from '../content/runtime-forest-spatial-manifest';
import { ForestOpeningCreek } from './forest-opening-creek';
import { ForestOpeningObstacle } from './forest-opening-obstacle';
import { ForestChunkStream, FOREST_MATERIAL } from './forest-chunk-stream';
import { generateForestRegion } from './forest-region-generator';
import { Material } from '../sim/materials';

const opening = readRuntimeForestOpeningManifest(generated);
const spatial = readRuntimeForestSpatialManifest(generated);
const bounds = opening.obstacle.materialPocketPx;
const count = (creek: ForestOpeningCreek, material: number) => creek.save().grid.material.filter(m => m === material).length;

describe('shared dynamic opening creek', () => {
  it('flows through excavated soil into the lower basin without manufacturing or deleting water', () => {
    const creek = new ForestOpeningCreek(bounds);
    for (let tick = 1; tick <= 120; tick++) creek.advance(tick);
    const before = creek.save();
    expect(count(creek, Material.Water)).toBe(400);
    expect(before.grid.material.some((m, i) => m === Material.Water && i % 128 >= 72)).toBe(false);
    expect(creek.dig()).toBe(true);
    expect(creek.dig()).toBe(false);
    expect(creek.save().excavatedSoil).toBe(96);
    for (let tick = 121; tick <= 360; tick++) {
      creek.advance(tick);
      if (tick % 20 === 0) expect(count(creek, Material.Water)).toBe(400);
    }
    expect(creek.save().grid.material.some((m, i) => m === Material.Water && i % 128 >= 72 && Math.floor(i / 128) >= 24)).toBe(true);
    expect(count(creek, Material.Soil) + creek.save().excavatedSoil).toBe(96);
  });

  it('resumes a moving stream exactly, including thermal phase and movement markers', () => {
    const source = new ForestOpeningCreek(bounds); source.dig();
    for (let tick = 1; tick <= 37; tick++) source.advance(tick);
    const restored = new ForestOpeningCreek(bounds, JSON.parse(JSON.stringify(source.save())));
    expect(restored.save()).toEqual(source.save());
    for (let tick = 38; tick <= 90; tick++) { source.advance(tick); restored.advance(tick); }
    expect(restored.save()).toEqual(source.save());
  });

  it('uses the exact same pixels for rendering chunks, point sampling and collisions', () => {
    const creek = new ForestOpeningCreek(bounds);
    const terrain = new ForestChunkStream(spatial, generateForestRegion(spatial, 'creek.shared'), {
      openingSurface: true, materialOverlay: creek,
    });
    const plug = { x: bounds.x + 66, y: bounds.y + 17, width: 1, height: 1 };
    expect(terrain.isSolid(plug)).toBe(true);
    expect(terrain.materialAt(plug.x, plug.y)).toBe(FOREST_MATERIAL.soil);
    creek.dig();
    expect(terrain.isSolid(plug)).toBe(false);
    for (let tick = 1; tick <= 60; tick++) creek.advance(tick);
    for (const chunk of terrain.visible(bounds, 0)) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const wx = chunk.chunkX * 16 + x, wy = chunk.chunkY * 16 + y;
      const material = chunk.materials[y * 16 + x];
      expect(terrain.materialAt(wx, wy)).toBe(material);
      expect(terrain.isSolid({ x: wx, y: wy, width: 1, height: 1 })).toBe(
        material !== FOREST_MATERIAL.air && material !== FOREST_MATERIAL.water);
    }
  });

  it('does not invalidate distant visible terrain or wildlife on water-only motion', () => {
    const creek = new ForestOpeningCreek(bounds);
    const terrain = new ForestChunkStream(spatial, generateForestRegion(spatial, 'creek.cache'), { materialOverlay: creek });
    creek.advance(2);
    expect(terrain.visibleRevision({ x: 0, y: 0, width: 640, height: 360 })).toBe(0);
    expect(terrain.visibleRevision(bounds)).toBeGreaterThan(0);
    expect(terrain.solidRevision).toBe(0);
    creek.dig(); expect(terrain.solidRevision).toBe(1);
  });

  it('rejects changed banks, missing water, mismatched timelines and invalid creek envelopes', () => {
    const source = new ForestOpeningCreek(bounds);
    for (const mutate of [
      (s: any) => { s.grid.material[63 * 128 + 50] = Material.Air; },
      (s: any) => { s.grid.material[14 * 128 + 24] = Material.Air; },
      (s: any) => { s.grid.width = 4096; },
      (s: any) => { s.excavatedSoil = 1; },
      (s: any) => { s.unexpected = true; },
    ]) {
      const save = JSON.parse(JSON.stringify(source.save())); mutate(save);
      expect(() => new ForestOpeningCreek(bounds, save)).toThrow();
    }
    const obstacle = ForestOpeningObstacle.fresh(opening, true);
    const save = JSON.parse(JSON.stringify(obstacle.save())); save.materialTick = 2;
    expect(() => ForestOpeningObstacle.fromSave(opening, save)).toThrow(/timeline/);
    expect(() => ForestOpeningObstacle.fromSave(opening, { ...obstacle.save(), creek: null })).toThrow();
  });

  it('preserves legacy obstacle saves byte-for-byte instead of reinterpreting old material IDs', () => {
    const legacy = ForestOpeningObstacle.fresh(opening);
    legacy.advanceTicks(79);
    const save = legacy.save();
    expect(ForestOpeningObstacle.fromSave(opening, save).save()).toEqual(save);
    expect(save.creek).toBeUndefined();
  });

  it('keeps the new tool action idempotent and preserves excavated soil after reset/reload', () => {
    const obstacle = ForestOpeningObstacle.fresh(opening, true);
    const context = { actorBounds: { x: bounds.x + 20, y: bounds.y, width: 12, height: 14 }, expectedRevision: 0 };
    expect(obstacle.applyInteraction('dig', { kind: 'enter_shallow_detour' }, context)).toMatchObject({ ok: true });
    obstacle.advanceTicks(63);
    const before = obstacle.save();
    expect(obstacle.applyInteraction('dig', { kind: 'enter_shallow_detour' }, context)).toMatchObject({ ok: true, duplicate: true });
    obstacle.resetToCommittedState();
    expect(obstacle.save()).toEqual(before);
    expect(ForestOpeningObstacle.fromSave(opening, before).save()).toEqual(before);
  });
});
