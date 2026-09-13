import type { ForestCameraState } from "../runtime/forest-camera";

type BackdropImage = CanvasImageSource & { naturalWidth: number; naturalHeight: number };

export async function loadLocalForestBackdrop(
  enabled: boolean,
  load: (url: string) => Promise<BackdropImage>,
): Promise<BackdropImage | null> {
  if (!enabled) return null;
  try {
    const image = await load("/src/local-art-cache/background-far.v0.3.png");
    return image.naturalWidth === 640 && image.naturalHeight === 360 ? image : null;
  } catch { return null; }
}

export function loadLocalForestBackdropFromDocument(): Promise<BackdropImage | null> {
  return loadLocalForestBackdrop(import.meta.env.DEV || __TOKIPONA_LOCAL_DESKTOP__, (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("forest backdrop unavailable"));
    image.src = url;
  }));
}

export function drawLocalForestBackdrop(context: CanvasRenderingContext2D, camera: ForestCameraState, image: BackdropImage): void {
  context.fillStyle = "#1c2a29";
  context.fillRect(0, 0, camera.width, camera.height);
  const height = Math.max(360, camera.height);
  const width = Math.ceil(height * 640 / 360);
  const offset = camera.x * 0.15;
  const first = Math.floor(offset / width);
  const y = -Math.round(Math.max(0, camera.y - 300) * 0.12);
  const last = Math.ceil((offset + camera.width) / width);
  for (let tile = first; tile <= last; tile += 1) {
    const x = Math.round(tile * width - offset);
    context.save();
    // Mirror alternating repeats so the existing non-tileable artwork joins at
    // identical edge pixels. This is distant scenery, never a collision surface.
    if (tile % 2 !== 0) { context.translate(x * 2 + width, 0); context.scale(-1, 1); }
    context.drawImage(image, x, y, width, height);
    context.restore();
  }
}
