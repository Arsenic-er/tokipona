import { describe, expect, it } from "vitest";
import { ForestMouseCamera, bindForestMouseCamera } from "./forest-mouse-camera";
import { fitForestOpeningPresentation } from "./forest-opening-view";

const bounds = { width: 10240, height: 2880 };
const base = Object.freeze({ x: 200, y: 300, width: 640, height: 360, facing: "right" as const });
const player = Object.freeze({ x: 514, y: 473 });
const settle = (camera: ForestMouseCamera, seconds = 2, hz = 60) => {
  for (let i = 0; i < seconds * hz; i++) camera.advance(1 / hz, base, player);
  return camera.compose(base, player);
};

describe("presentation-only mouse camera", () => {
  it("leaves default framing and simulation values untouched", () => {
    const camera = new ForestMouseCamera(bounds);
    expect(camera.compose(base, player)).toEqual(base);
    camera.wheel(-120);
    settle(camera);
    expect(base).toEqual({ x: 200, y: 300, width: 640, height: 360, facing: "right" });
    expect(player).toEqual({ x: 514, y: 473 });
  });

  it("zooms in/out with bounded field of view and smoothly resets", () => {
    const camera = new ForestMouseCamera(bounds);
    camera.wheel(-10000);
    camera.advance(1 / 60, base, player);
    expect(camera.compose(base, player).width).toBeGreaterThan(320);
    expect(settle(camera).width).toBe(320);
    camera.wheel(10000);
    const wide = settle(camera);
    expect(wide).toMatchObject({ width: 853, height: 480 });
    camera.reset();
    expect(settle(camera)).toEqual(base);
  });

  it("normalizes wheel modes and ignores invalid deltas", () => {
    const pixels = new ForestMouseCamera(bounds), lines = new ForestMouseCamera(bounds);
    pixels.wheel(-48);
    lines.wheel(-3, 1);
    expect(settle(lines)).toEqual(settle(pixels));
    lines.wheel(Number.NaN);
    lines.wheel(Number.POSITIVE_INFINITY);
    expect(settle(lines)).toEqual(settle(pixels));
  });

  it("preserves the player screen anchor while zooming", () => {
    const camera = new ForestMouseCamera(bounds);
    camera.wheel(-320);
    const zoomed = settle(camera);
    expect((player.x + 6 - zoomed.x) / zoomed.width).toBeCloseTo(0.5, 2);
    expect((player.y + 7 - zoomed.y) / zoomed.height).toBeCloseTo(0.5, 2);
  });

  it("softly looks towards the pointer, ignores the dead zone and returns on leave", () => {
    const camera = new ForestMouseCamera(bounds);
    camera.point(0.52, 0.48);
    expect(settle(camera)).toEqual(base);
    camera.point(1, 0);
    camera.advance(1 / 60, base, player);
    expect(camera.compose(base, player).x).toBeGreaterThan(base.x);
    expect(camera.compose(base, player).x).toBeLessThan(base.x + 28);
    expect(settle(camera)).toMatchObject({ x: base.x + 28, y: base.y - 16 });
    camera.point(0, 1);
    expect(settle(camera)).toMatchObject({ x: base.x - 28, y: base.y + 16 });
    camera.clearPointer();
    expect(settle(camera)).toEqual(base);
  });

  it("uses time-based damping and honors reduced motion", () => {
    const slow = new ForestMouseCamera(bounds), fast = new ForestMouseCamera(bounds);
    for (const camera of [slow, fast]) { camera.point(1, 1); camera.wheel(-180); }
    expect(settle(slow, 0.5, 30)).toEqual(settle(fast, 0.5, 120));
    slow.advance(1 / 60, base, player, true);
    const result = slow.compose(base, player);
    expect((player.x + 6 - result.x) / result.width).toBeCloseTo(0.5, 2);
  });

  it("clamps all zoom levels to the region and keeps full-screen crops", () => {
    for (const delta of [-10000, 0, 10000]) {
      const camera = new ForestMouseCamera(bounds);
      camera.wheel(delta);
      camera.point(1, 1);
      settle(camera);
      for (const corner of [{ x: 0, y: 0 }, { x: bounds.width - 12, y: bounds.height - 14 }]) {
        const result = camera.compose({ ...base, ...corner }, corner);
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeGreaterThanOrEqual(0);
        expect(result.x + result.width).toBeLessThanOrEqual(bounds.width);
        expect(result.y + result.height).toBeLessThanOrEqual(bounds.height);
      }
      for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 2560, height: 1080 }]) {
        const result = camera.compose(base, player);
        const actor = { x: player.x - result.x, y: player.y - result.y, width: 12, height: 14 };
        const crop = fitForestOpeningPresentation(viewport, actor, result);
        expect(crop.width).toBeGreaterThanOrEqual(viewport.width);
        expect(crop.height).toBeGreaterThanOrEqual(viewport.height);
        expect(crop.left + actor.x * crop.scale).toBeGreaterThanOrEqual(0);
        expect(crop.top + actor.y * crop.scale).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("ignores touch, paused controls and browser zoom without eating those events", () => {
    const win = new EventTarget();
    const canvas = Object.assign(new EventTarget(), {
      ownerDocument: { defaultView: win },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    }) as unknown as HTMLCanvasElement;
    const camera = new ForestMouseCamera(bounds);
    let blocked = false;
    bindForestMouseCamera(canvas, camera, () => blocked);
    const event = (type: string, properties: object) => Object.assign(new Event(type, { cancelable: true }), properties);
    const browserZoom = event("wheel", { deltaX: 0, deltaY: -120, ctrlKey: true });
    canvas.dispatchEvent(browserZoom);
    expect(browserZoom.defaultPrevented).toBe(false);
    canvas.dispatchEvent(event("pointermove", { pointerType: "touch", clientX: 640, clientY: 360 }));
    expect(settle(camera)).toEqual(base);
    blocked = true;
    const paused = event("wheel", { deltaX: 0, deltaY: -120 });
    canvas.dispatchEvent(paused);
    expect(paused.defaultPrevented).toBe(false);
    expect(settle(camera)).toEqual(base);
    blocked = false;
    const zoom = event("wheel", { deltaX: 0, deltaY: -120, deltaMode: 0 });
    canvas.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(true);
    expect(settle(camera).width).toBeLessThan(640);
  });
});
