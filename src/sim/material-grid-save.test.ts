import { describe, expect, it } from "vitest";
import { MaterialGrid } from "./material-grid";
import { Material } from "./materials";

function basin() {
  const grid = new MaterialGrid(40, 24, 12345);
  grid.clear(Material.Rock);
  for (let y = 1; y < 23; y++) for (let x = 1; x < 39; x++) grid.setMaterial(x, y, Material.Air);
  for (let y = 3; y < 8; y++) for (let x = 4; x < 14; x++) grid.setMaterial(x, y, Material.Water);
  for (let x = 16; x < 23; x++) grid.setMaterial(x, 3, Material.Sand);
  return grid;
}
const water = (grid: MaterialGrid) => grid.material.filter(value => value === Material.Water).length;
const copy = (grid: MaterialGrid) => JSON.parse(JSON.stringify(grid.save()));

describe("persistent generic material simulation", () => {
  it("keeps every state array, seed and thermal phase through JSON and continued simulation", () => {
    const original = basin();
    original.setMaterial(30, 15, Material.Wood, 900);
    original.setMaterial(26, 14, Material.Ice, 100);
    original.liftCircle(8, 7, 5, 24);
    for (let i = 0; i < 5; i++) original.tick();
    const restored = MaterialGrid.fromSave(copy(original));
    expect(restored.save()).toEqual(original.save());
    for (let i = 0; i < 70; i++) {
      original.tick(); restored.tick();
      expect(restored.save()).toEqual(original.save());
    }
  });
  it("conserves all water in a closed basin across repeated save and resume", () => {
    let grid = basin();
    const amount = water(grid);
    for (let i = 0; i < 120; i++) {
      grid.tick();
      if (i % 11 === 0) grid = MaterialGrid.fromSave(copy(grid));
      expect(water(grid)).toBe(amount);
    }
  });
  it("flows into an opened soil channel and preserves the changed state without reseeding", () => {
    const grid = new MaterialGrid(30, 20, 99);
    grid.clear(Material.Rock);
    for (let y = 1; y < 19; y++) for (let x = 1; x < 29; x++) {
      grid.setMaterial(x, y, x === 14 ? Material.Soil : x < 14 ? Material.Water : Material.Air);
    }
    const count = water(grid);
    grid.setMaterial(14, 16, Material.Air); grid.setMaterial(14, 17, Material.Air);
    for (let i = 0; i < 60; i++) grid.tick();
    expect(grid.material.some((value, index) => index % grid.width > 14 && value === Material.Water)).toBe(true);
    expect(water(grid)).toBe(count);
    const restored = MaterialGrid.fromSave(copy(grid));
    expect(restored.getMaterial(14, 16)).not.toBe(Material.Soil);
    for (let i = 0; i < 20; i++) { restored.tick(); grid.tick(); }
    expect(restored.save()).toEqual(grid.save());
  });
  it("does not share mutable save buffers", () => {
    const grid = basin(); const state = copy(grid); const restored = MaterialGrid.fromSave(state);
    state.material.fill(Material.Air);
    expect(water(restored)).toBe(water(grid));
    const saved = grid.save(); grid.tick();
    expect(saved.tick).toBe(0); expect(Object.isFrozen(saved.material)).toBe(true);
  });
  it("rejects bad arrays, unknown schemas and oversized allocations without changing the original", () => {
    const grid = basin(); const before = grid.save();
    for (const patch of [{ schema: 'tokipona.forest-opening-obstacle.v0.1' }, { width: 1e9 },
      { height: -1 }, { tick: NaN }, { thermalTick: 3 }, { seed: 0.5 }, { material: [255] },
      { temperature: new Array(960) }, { movedAt: Array(960).fill(1) }, { lift: Array(960).fill(256) }]) {
      expect(() => MaterialGrid.fromSave({ ...copy(grid), ...patch })).toThrow();
      expect(grid.save()).toEqual(before);
    }
  });
  it("keeps the movement guard valid across a Uint32 counter rollover", () => {
    const state = copy(basin()); state.tick = 4_294_967_295;
    const restored = MaterialGrid.fromSave(state);
    const before = water(restored); restored.tick();
    expect(restored.save().tick).toBe(1); expect(water(restored)).toBe(before);
    expect(() => MaterialGrid.fromSave(copy(restored))).not.toThrow();
  });
});
