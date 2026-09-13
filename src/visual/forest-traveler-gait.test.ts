import { describe, expect, it } from "vitest";
import type { PlayerState } from "../runtime/runtime";
import { ForestTravelerGait } from "./forest-traveler-gait";

const player = (x: number, speed: number, grounded = true): PlayerState => ({
  position: { x, y: 100 }, velocity: { x: speed, y: 0 }, grounded, body: { width: 12, height: 14 },
});

describe("distance-driven traveler gait", () => {
  for (const speed of [8, 30.8, 40, 88]) it(`shows every passing pose at ${speed} px/s without skipping`, () => {
    const gait = new ForestTravelerGait();
    gait.advance(0, player(0, speed));
    let previous = 0;
    let lastChange = 0;
    const seen = new Set([0]);
    let contacts = 0;
    for (let tick = 1; tick <= 300; tick += 1) {
      const sample = gait.advance(tick, player(tick * speed / 60, speed));
      if (sample.frame !== previous) {
        expect(sample.frame).toBe((previous + 1) % 8);
        expect(tick - lastChange).toBeGreaterThanOrEqual(5);
        lastChange = tick;
      }
      previous = sample.frame;
      seen.add(sample.frame);
      if (sample.footContact) contacts += 1;
    }
    expect(seen.size).toBe(8);
    expect(contacts).toBeGreaterThanOrEqual(2);
  });

  it("keeps phase continuous across walk/run transitions, reversals and repeated render projection", () => {
    const gait = new ForestTravelerGait();
    let x = 0;
    gait.advance(0, player(x, 40));
    let phase = 0;
    for (let tick = 1; tick < 90; tick += 1) {
      const speed = tick < 30 ? 40 : tick < 60 ? 88 : -40;
      x += speed / 60;
      const pose = gait.advance(tick, player(x, speed));
      expect(gait.advance(tick, player(x, speed))).toBe(pose);
      const delta = (pose.phase - phase + 1) % 1;
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThanOrEqual(0.0250001);
      phase = pose.phase;
    }
  });

  it("does not cycle feet when blocked, airborne or discontinuously repositioned", () => {
    const gait = new ForestTravelerGait();
    gait.advance(0, player(20, 88));
    expect(gait.advance(1, player(20, 88))).toEqual({ phase: 0, frame: 0, footContact: false });
    expect(gait.advance(2, player(21, 88, false)).phase).toBe(0);
    expect(gait.advance(3, player(22, 88)).phase).toBe(0);
    expect(gait.advance(4, player(800, 88)).phase).toBe(0);
    gait.reset();
    expect(gait.advance(5, player(512, 0))).toEqual({ phase: 0, frame: 0, footContact: false });
  });
});
