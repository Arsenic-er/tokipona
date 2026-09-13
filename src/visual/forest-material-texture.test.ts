import { describe, expect, it } from "vitest";
import { FOREST_MATERIAL as M } from "../world/forest-chunk-stream";
import { forestMaterialColor, forestObjectMaterialRuns } from "./forest-material-texture";

describe("native forest material textures", () => {
  it("uses distinct earth, wet-earth, rock and wood palettes instead of one recolored noise", () => {
    for (const [x,y] of [[12,23],[97,51],[1789,712],[-8,-11]]) {
      const soil = forestMaterialColor(M.soil,x!,y!);
      const wet = forestMaterialColor(M.wet_soil,x!,y!);
      const rock = forestMaterialColor(M.stone,x!,y!);
      const wood = forestMaterialColor(M.wood,x!,y!);
      expect(soil[0]).toBeGreaterThan(soil[2]);
      expect(rock[2]).toBeGreaterThan(rock[0]);
      expect(wet.reduce((a,b)=>a+b)).toBeLessThan(soil.reduce((a,b)=>a+b));
      expect(wood).not.toEqual(soil);
    }
  });
  it("quantizes fine-grained clusters without gradients, white sparkles or a time input", () => {
    const colors = new Set<string>();
    for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
      const color=forestMaterialColor(M.stone,x,y);
      colors.add(color.join(","));
      expect(Math.max(...color)).toBeLessThan(140);
      expect(forestMaterialColor(M.stone,x,y)).toEqual(color);
    }
    expect(colors.size).toBeGreaterThanOrEqual(5);
    expect(colors.size).toBeLessThanOrEqual(7);
  });
  it.each([["stone",12,12],["deadwood",40,6],["deadwood",64,8]] as const)(
    "%s texture covers each existing contact pixel once, with no decorative overhang",
    (kind,width,height) => {
      const runs=forestObjectMaterialRuns(kind,width,height,0);
      const coverage=new Uint8Array(width*height);
      for (const run of runs) {
        expect(Number.isInteger(run.x) && Number.isInteger(run.y)).toBe(true);
        expect(run.x).toBeGreaterThanOrEqual(0);
        expect(run.y).toBeGreaterThanOrEqual(0);
        expect(run.x+run.width).toBeLessThanOrEqual(width);
        expect(run.y).toBeLessThan(height);
        for(let x=run.x;x<run.x+run.width;x++) coverage[run.y*width+x]!++;
      }
      expect([...coverage].every(n=>n===1)).toBe(true);
      expect(forestObjectMaterialRuns(kind,width,height,0)).toBe(runs);
    },
  );
  it("keeps texture variants independent of body movement", () => {
    expect(forestObjectMaterialRuns("stone",12,12,0)).not.toEqual(forestObjectMaterialRuns("stone",12,12,1));
    expect(()=>forestObjectMaterialRuns("stone",12.5,12,0)).toThrow();
    expect(()=>forestObjectMaterialRuns("stone",257,12,0)).toThrow();
  });
});
