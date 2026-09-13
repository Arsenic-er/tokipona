import { describe, expect, it } from "vitest";
import type { ForestOpeningPublicView } from "./forest-opening-view";
import { interpolateForestOpeningView } from "./forest-opening-interpolation";

const pose = (tick: number, x: number, cameraX: number): ForestOpeningPublicView => ({
  tick, mode: "forest_opening", camera: { x: cameraX, y: 300, width: 640, height: 360, facing: "right" },
  traveler: { position: { x, y: 480 }, frame: 3, animationId: "walk", facing: 1, visualHeightPx: 19, glow: false },
  creatures: [],
} as unknown as ForestOpeningPublicView);

describe("forest presentation interpolation", () => {
  it("interpolates player and camera together without changing simulation snapshots", () => {
    const before = pose(1, 512, 200);
    const after = pose(2, 513.4, 200.3);
    const drawn = interpolateForestOpeningView(before, after, 0.5);
    expect(drawn.traveler.position.x).toBeCloseTo(512.7);
    expect(drawn.camera.x).toBeCloseTo(200.15);
    expect(drawn.traveler.frame).toBe(3);
    expect(before.traveler.position.x).toBe(512);
    expect(after.camera.x).toBe(200.3);
  });
  it("does not interpolate a checkpoint reset, skipped samples or a mode transition", () => {
    const before = pose(120, 1700, 1400);
    const reset = pose(121, 512, 200);
    expect(interpolateForestOpeningView(before, reset, 0.5)).toBe(reset);
    const gap = pose(125, 1701, 1400);
    expect(interpolateForestOpeningView(before, gap, 0.5)).toBe(gap);
    const exit = { ...pose(121, 1701, 1400), mode: "settlement_perimeter" as const };
    expect(interpolateForestOpeningView(before, exit, 0.5)).toBe(exit);
  });
});
