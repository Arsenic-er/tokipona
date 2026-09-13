import { describe, expect, it } from "vitest";
import { ForestTravelerLanding } from "./forest-traveler-landing";
import type { ForestOpeningPublicView, ForestOpeningAnimationId } from "./forest-opening-view";
const view = (tick: number, animationId: ForestOpeningAnimationId, x = 10) => ({ tick,
  traveler: { animationId, position: { x, y: 20 } } }) as ForestOpeningPublicView;

describe("local traveler landing poses", () => {
  it("plays four existing recovery poses once after contact, with stable repeated renders", () => {
    const landing = new ForestTravelerLanding();
    expect(landing.frame(view(9, "fall"))).toBeNull();
    for (let tick = 10; tick < 22; tick++) {
      expect(landing.frame(view(tick, "idle"))).toBe(Math.floor((tick - 10) / 3));
      expect(landing.frame(view(tick, "idle"))).toBe(Math.floor((tick - 10) / 3));
    }
    expect(landing.frame(view(22, "idle"))).toBeNull();
  });
  it("does not delay a run, action or immediate jump", () => {
    for (const action of ["run", "push", "jump", "observe"] as const) {
      const landing = new ForestTravelerLanding();
      landing.frame(view(9, "fall"));
      landing.frame(view(10, "idle"));
      expect(landing.frame(view(11, action))).toBeNull();
      expect(landing.frame(view(12, "idle"))).toBeNull();
    }
  });
  it("does not interpret reset, frame gaps or teleport as a landing", () => {
    for (const current of [view(1, "idle"), view(60, "idle"), view(10, "idle", 400)]) {
      const landing = new ForestTravelerLanding();
      landing.frame(view(9, "fall"));
      expect(landing.frame(current)).toBeNull();
    }
  });
});
