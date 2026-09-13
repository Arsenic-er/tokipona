import type { ForestOpeningPublicView } from "./forest-opening-view";

export function interpolateForestOpeningView(
  previous: ForestOpeningPublicView,
  current: ForestOpeningPublicView,
  alpha: number,
): ForestOpeningPublicView {
  if (current.tick !== previous.tick + 1 || current.mode !== previous.mode ||
      Math.hypot(current.traveler.position.x - previous.traveler.position.x,
        current.traveler.position.y - previous.traveler.position.y) > 16) return current;
  const ratio = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  const lerp = (a: number, b: number) => a + (b - a) * ratio;
  return {
    ...current,
    camera: { ...current.camera, x: lerp(previous.camera.x, current.camera.x), y: lerp(previous.camera.y, current.camera.y) },
    traveler: { ...current.traveler, position: {
      x: lerp(previous.traveler.position.x, current.traveler.position.x),
      y: lerp(previous.traveler.position.y, current.traveler.position.y),
    } },
    creatures: current.creatures.map((creature) => {
      const before = previous.creatures.find(({ speciesId }) => speciesId === creature.speciesId);
      if (!before || Math.hypot(creature.position.x - before.position.x, creature.position.y - before.position.y) > 16) return creature;
      return { ...creature, position: { x: lerp(before.position.x, creature.position.x), y: lerp(before.position.y, creature.position.y) } };
    }),
  };
}
