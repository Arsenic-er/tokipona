import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "tokipona.forest-opening.vertical-slice.v0.1";
const canvasSelector = 'canvas[data-surface="game"]';

test.use({ viewport: { width: 1440, height: 900 } });

async function start(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.goto("/chapter-one.html");
  await page.waitForLoadState("networkidle");
  await page.clock.pauseAt(60_000);
  await page.clock.runFor(1200);
}

// Observe rendered pixels, not a hidden camera/debug API. The production missing-
// asset candidate has a distinct teal coat; local private artwork is not used here.
async function picture(page: Page) {
  return page.locator(canvasSelector).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 47 || pixels[i + 1] !== 105 || pixels[i + 2] !== 112) continue;
      const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX < 0) throw new Error("traveler pixels missing after camera operation");
    const rect = canvas.getBoundingClientRect();
    return { width: canvas.width, height: canvas.height,
      x: rect.left + (minX + maxX + 1) / 2 * rect.width / canvas.width,
      y: rect.top + (minY + maxY + 1) / 2 * rect.height / canvas.height,
      actorHeight: (maxY - minY + 1) * rect.height / canvas.height,
      covers: rect.left <= 0.01 && rect.top <= 0.01 && rect.right >= innerWidth - 0.01 && rect.bottom >= innerHeight - 0.01,
      bottomRightAlpha: pixels[pixels.length - 1],
      bottomRightColor: [...pixels.slice(pixels.length - 4, pixels.length - 1)] };
  });
}

async function save(page: Page) {
  return page.evaluate((key) => {
    window.dispatchEvent(new Event("pagehide"));
    const value = JSON.parse(localStorage.getItem(key)!);
    return { player: value.spatial.spatial.player, camera: value.spatial.spatial.camera,
      session: value.session, obstacle: value.spatial.obstacle.committedSolutionId };
  }, SAVE_KEY);
}

test("wheel changes the actual field of view, keeps the player visible and restores with 0", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  const initial = await picture(page);
  const before = await save(page);
  await page.mouse.move(initial.x, initial.y);
  await page.mouse.wheel(0, -240);
  await page.clock.runFor(1400);
  const close = await picture(page);
  expect(close.width).toBeLessThan(640);
  expect(close.actorHeight).toBeGreaterThan(initial.actorHeight * 1.3);
  expect(Math.abs(close.x - initial.x)).toBeLessThan(10);
  expect(close.covers).toBe(true);
  await page.screenshot({ path: info.outputPath("zoom-in.png") });

  await page.mouse.wheel(0, 10000);
  await page.clock.runFor(1400);
  const far = await picture(page);
  expect(far).toMatchObject({ width: 853, height: 480, covers: true, bottomRightAlpha: 255 });
  expect(far.bottomRightColor.every((channel) => channel > 10)).toBe(true);
  expect(far.actorHeight).toBeLessThan(initial.actorHeight);
  const after = await save(page);
  expect(after.player).toEqual(before.player);
  // The original follow camera may still converge by sub-micro-pixel amounts
  // while the simulation advances; mouse controls must not move its framing.
  expect(after.camera.x).toBeCloseTo(before.camera.x, 6);
  expect(after.camera.y).toBeCloseTo(before.camera.y, 6);
  expect(after.camera.width).toBe(before.camera.width);
  expect(after.camera.height).toBe(before.camera.height);
  expect(after.session).toEqual(before.session);
  expect(after.obstacle).toEqual(before.obstacle);
  await page.screenshot({ path: info.outputPath("zoom-out.png") });

  await page.locator(canvasSelector).focus();
  await page.keyboard.press("0");
  await page.clock.runFor(1400);
  expect(await picture(page)).toMatchObject({ width: 640, height: 360, covers: true });
  expect(errors).toEqual([]);
});

test("mouse look is small and damped, returns when leaving, and ignores paused wheel input", async ({ page }, info) => {
  await start(page);
  const initial = await picture(page);
  await page.mouse.move(1390, initial.y);
  await page.clock.runFor(50);
  const early = await picture(page);
  await page.clock.runFor(1200);
  const right = await picture(page);
  expect(right.x).toBeLessThan(early.x);
  expect(early.x).toBeLessThan(initial.x);
  expect(initial.x - right.x).toBeGreaterThan(25);
  expect(initial.x - right.x).toBeLessThan(85);
  await page.mouse.move(30, initial.y);
  await page.clock.runFor(1400);
  const left = await picture(page);
  expect(left.x).toBeGreaterThan(initial.x + 25);
  expect(left.x - initial.x).toBeLessThan(85);
  await page.screenshot({ path: info.outputPath("mouse-look-left.png") });

  // Moving onto the HUD leaves the game canvas and recenters the view.
  await page.getByRole("button", { name: "暂停", exact: true }).hover();
  await page.clock.runFor(1400);
  expect(Math.abs((await picture(page)).x - initial.x)).toBeLessThan(4);
  await page.keyboard.press("Escape");
  await page.mouse.move(1300, 800);
  await page.mouse.wheel(0, -480);
  await page.clock.runFor(1400);
  expect((await picture(page)).width).toBe(640);
  await page.keyboard.press("Escape");
});

test("touch pointers do not pan and resized zoomed windows stay filled", async ({ page }) => {
  await start(page);
  const initial = await picture(page);
  await page.locator(canvasSelector).dispatchEvent("pointermove", { pointerType: "touch", clientX: 1400, clientY: 880 });
  await page.clock.runFor(1200);
  expect(Math.abs((await picture(page)).x - initial.x)).toBeLessThan(4);
  await page.mouse.move(initial.x, initial.y);
  await page.mouse.wheel(0, 10000);
  await page.clock.runFor(1400);
  for (const viewport of [{ width: 844, height: 390 }, { width: 2560, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.clock.runFor(200);
    const result = await picture(page);
    expect(result.covers).toBe(true);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(viewport.width);
    expect(result.y).toBeGreaterThan(0);
    expect(result.y).toBeLessThan(viewport.height);
  }
});
