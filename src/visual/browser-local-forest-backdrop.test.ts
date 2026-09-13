import { describe, expect, it, vi } from "vitest";
import { loadLocalForestBackdrop } from "./browser-local-forest-backdrop";

describe("local forest backdrop boundary", () => {
  it("never requests a private candidate in production", async () => {
    const load = vi.fn();
    expect(await loadLocalForestBackdrop(false, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it("accepts only the existing 640x360 export and fails safely when missing", async () => {
    const image = { naturalWidth: 640, naturalHeight: 360 } as HTMLImageElement;
    expect(await loadLocalForestBackdrop(true, async () => image)).toBe(image);
    expect(await loadLocalForestBackdrop(true, async () => ({ ...image, naturalWidth: 1280 }) as HTMLImageElement)).toBeNull();
    expect(await loadLocalForestBackdrop(true, async () => { throw new Error("missing"); })).toBeNull();
  });
});
