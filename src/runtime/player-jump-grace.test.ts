import { describe, expect, it } from "vitest";
import { EMPTY_JUMP_GRACE, stepPlayerMotion, type PlayerMotionState } from "./player-motion";
import type { Aabb } from "./geometry";

function runner(initial: PlayerMotionState, collides = (b: Aabb) => b.y + b.height > 80, hz = 60) {
  let result = { state: initial, previousJump: false, jumpGrace: EMPTY_JUMP_GRACE };
  return (jump = false, moveX = 0) => {
    const next = stepPlayerMotion({ ...result, body: { width: 12, height: 14 },
      input: { moveX, jump }, fixedSeconds: 1 / hz, collides });
    result = { ...next, jumpGrace: next.jumpGrace! };
    return result;
  };
}
const ground = { x: 63.5, y: 66, velocityX: 88, velocityY: 0, grounded: true };
const ledge = (b: Aabb) => b.x < 64 && b.y + b.height > 80;

describe("opt-in fixed-time jump forgiveness", () => {
  it.each([30, 60, 120])("permits a late ledge jump within 100 ms at %i Hz", hz => {
    const next = runner(ground, ledge, hz);
    expect(next(false, 1).state.grounded).toBe(false);
    for (let tick = 0; tick < Math.floor(hz * 0.04); tick++) next(false, 1);
    const jumped = next(true, 1);
    expect(jumped.state.velocityY).toBeLessThan(-160);
    expect(jumped.jumpGrace).toEqual(EMPTY_JUMP_GRACE);
    next(false, 1);
    expect(next(true, 1).state.velocityY).toBeGreaterThan(jumped.state.velocityY);
  });

  it("does not grant a jump after leaving the ledge window", () => {
    const next = runner(ground, ledge);
    for (let tick = 0; tick < 9; tick++) next(false, 1);
    expect(next(true, 1).state.velocityY).toBeGreaterThan(0);
  });

  it("remembers a brief press before contact, consumes it once and does not auto-bounce", () => {
    const next = runner({ ...ground, x: 10, y: 62, velocityX: 0, velocityY: 150, grounded: false });
    expect(next(true).state.grounded).toBe(false);
    const contact = next(false);
    expect(contact.state.y).toBeCloseTo(66, 3);
    expect(contact.state.velocityY).toBe(-190);
    expect(contact.jumpGrace).toEqual(EMPTY_JUMP_GRACE);
    for (let tick = 0; tick < 90; tick++) next(true);
    expect(next(true).state.grounded).toBe(true);
  });

  it("expires an early airborne press and never provides an air spawn jump", () => {
    const next = runner({ ...ground, x: 10, y: 0, velocityX: 0, velocityY: 0, grounded: false });
    expect(next(true).state.velocityY).toBeGreaterThan(0);
    for (let tick = 0; tick < 90; tick++) next(false);
    expect(next().state.grounded).toBe(true);
  });

  it("leaves legacy callers without opt-in memory unchanged", () => {
    const result = stepPlayerMotion({ state: { ...ground, grounded: false }, body: { width: 12, height: 14 },
      input: { moveX: 0, jump: true }, previousJump: false, fixedSeconds: 1 / 60, collides: () => false });
    expect(result.state.velocityY).toBeGreaterThan(0);
    expect(result.jumpGrace).toBeUndefined();
  });
});
