import type { ForestCameraState } from "../runtime/forest-camera";
import type { Vec2 } from "../runtime/geometry";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Local presentation only. Never changes the simulation camera or saved world. */
export class ForestMouseCamera {
  private zoom = 1;
  private targetZoom = 1;
  private pointer: Vec2 | null = null;
  private offset = { x: 0, y: 0 };

  public constructor(private readonly bounds: Readonly<{ width: number; height: number }>) {}

  public wheel(deltaY: number, deltaMode = 0): void {
    if (!Number.isFinite(deltaY)) return;
    const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 360 : 1);
    this.targetZoom = clamp(this.targetZoom * Math.exp(-clamp(pixels, -1000, 1000) * 0.0015), 0.75, 2);
  }

  public point(x: number, y: number): void {
    this.pointer = Number.isFinite(x) && Number.isFinite(y)
      ? { x: clamp(x, 0, 1), y: clamp(y, 0, 1) } : null;
  }

  public clearPointer(): void { this.pointer = null; }

  public reset(): void {
    this.targetZoom = 1;
    this.clearPointer();
  }

  public advance(seconds: number, camera: ForestCameraState, player: Vec2, reducedMotion = false): void {
    const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.1);
    const ease = (value: number, target: number, rate: number) => {
      if (reducedMotion || Math.abs(value - target) < 0.0001) return target;
      return value + (target - value) * (1 - Math.exp(-rate * dt));
    };
    this.zoom = ease(this.zoom, this.targetZoom, 10);
    const focus = { x: (player.x + 6 - camera.x) / camera.width, y: (player.y + 7 - camera.y) / camera.height };
    for (const axis of ["x", "y"] as const) {
      const delta = this.pointer === null || reducedMotion ? 0 : (this.pointer[axis] - focus[axis]) * 2;
      const softZone = Math.sign(delta) * clamp((Math.abs(delta) - 0.12) / 0.88, 0, 1);
      this.offset[axis] = ease(this.offset[axis], softZone * (axis === "x" ? 28 : 16), 6);
    }
  }

  public compose(camera: ForestCameraState, player: Vec2): ForestCameraState {
    const width = Math.min(this.bounds.width, Math.round(640 / this.zoom));
    const height = Math.min(this.bounds.height, Math.round(360 / this.zoom));
    const origin = (axis: "x" | "y", length: number, originalLength: number, limit: number, center: number) => {
      // Keep the traveler at their existing screen anchor during zoom, not the cursor.
      const anchor = clamp((center - camera[axis]) / originalLength, 0.2, 0.8);
      return Math.round(clamp(center - anchor * length + this.offset[axis] / this.zoom, 0, limit - length));
    };
    return { ...camera, width, height,
      x: origin("x", width, camera.width, this.bounds.width, player.x + 6),
      y: origin("y", height, camera.height, this.bounds.height, player.y + 7) };
  }
}

export function bindForestMouseCamera(canvas: HTMLCanvasElement, camera: ForestMouseCamera, blocked: () => boolean): void {
  const win = canvas.ownerDocument.defaultView!;
  canvas.addEventListener("wheel", (event) => {
    // Leave browser accessibility zoom and horizontal trackpad scrolling alone.
    if (event.ctrlKey || event.metaKey || blocked() || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    camera.wheel(event.deltaY, event.deltaMode);
  }, { passive: false });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || blocked()) { camera.clearPointer(); return; }
    // CSS cover cropping is accounted for, so the pointer and traveler use the
    // same normalized canvas coordinates on narrow and ultrawide windows.
    const rect = canvas.getBoundingClientRect();
    camera.point((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  });
  canvas.addEventListener("pointerleave", () => camera.clearPointer());
  win.addEventListener("blur", () => camera.clearPointer());
  win.addEventListener("keydown", (event) => {
    if (event.key !== "0" || event.ctrlKey || event.metaKey || event.altKey || blocked() || event.target !== canvas) return;
    camera.reset();
    event.preventDefault();
  });
}
