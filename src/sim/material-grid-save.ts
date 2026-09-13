/** Versioned state of the generic simulator, not the forest v0.1 material-ID table. */
export interface MaterialGridSave {
  readonly schema: "tokipona.material-grid.v0.1";
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly tick: number;
  readonly thermalTick: number;
  readonly material: readonly number[];
  readonly temperature: readonly number[];
  readonly integrity: readonly number[];
  readonly phaseProgress: readonly number[];
  readonly burning: readonly number[];
  readonly lift: readonly number[];
  readonly movedAt: readonly number[];
}

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;

export function validateMaterialGridShape(width: number, height: number): void {
  if (!integer(width, 1, 4096) || !integer(height, 1, 4096) || width * height > 1_048_576) {
    throw new Error("material_grid_dimensions_invalid");
  }
}

export function readMaterialGridSave(candidate: unknown): MaterialGridSave {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("material_grid_save_invalid");
  const value = candidate as Record<string, unknown>;
  if (value.schema !== "tokipona.material-grid.v0.1") throw new Error("material_grid_schema_invalid");
  validateMaterialGridShape(value.width as number, value.height as number);
  if (!integer(value.seed, -2_147_483_648, 4_294_967_295) ||
      !integer(value.tick, 0, 4_294_967_295) || !integer(value.thermalTick, 0, 2)) throw new Error("material_grid_clock_invalid");
  const size = (value.width as number) * (value.height as number);
  for (const [key, min, max] of [
    ['material', 0, 8], ['temperature', -32768, 32767], ['integrity', 0, 255],
    ['phaseProgress', 0, 255], ['burning', 0, 255], ['lift', 0, 255], ['movedAt', 0, value.tick],
  ] as const) {
    const cells = value[key];
    if (!Array.isArray(cells) || cells.length !== size) throw new Error(`material_grid_${key}_invalid`);
    // A numeric loop also rejects sparse arrays; Array.every would skip holes.
    for (let index = 0; index < size; index++) {
      if (!integer(cells[index], min, max)) throw new Error(`material_grid_${key}_invalid`);
    }
  }
  return value as unknown as MaterialGridSave;
}
