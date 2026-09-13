import type { PlayerState } from "../runtime/runtime";

export interface ForestTravelerGaitFrame {
  readonly phase: number;
  readonly frame: number;
  readonly footContact: boolean;
}

/** Presentation only: no task, motion, MP or saved progression authority. */
export class ForestTravelerGait {
  private previous: { tick: number; x: number; grounded: boolean } | null = null;
  private current: ForestTravelerGaitFrame = Object.freeze({ phase: 0, frame: 0, footContact: false });

  public reset(): void {
    this.previous = null;
    this.current = Object.freeze({ phase: 0, frame: 0, footContact: false });
  }

  public advance(tick: number, player: PlayerState): ForestTravelerGaitFrame {
    if (this.previous?.tick === tick) return this.current;
    const previous = this.previous;
    this.previous = { tick, x: player.position.x, grounded: player.grounded };
    const distance = previous === null ? 0 : Math.abs(player.position.x - previous.x);
    // A reset/load/teleport is not a footstep. Normal samples arrive once per fixed tick.
    const consecutive = previous !== null && tick === previous.tick + 1 && distance <= 4;
    const moving = consecutive && previous.grounded && player.grounded && distance > 0.001;
    const speed = Math.abs(player.velocity.x);
    // Full left/right cycle: 32 px at walking speed, 64 px at top running speed.
    // This keeps all eight transition poses visible, including at light stick input.
    const runBlend = Math.max(0, Math.min(1, (speed - 40) / 48));
    const stride = 32 + 32 * runBlend;
    const delta = moving ? Math.min(distance / stride, 1 / 40) : 0;
    const phase = (this.current.phase + delta) % 1;
    const contact = delta > 0 && Math.floor((this.current.phase + delta) * 2) !== Math.floor(this.current.phase * 2);
    this.current = Object.freeze({ phase, frame: Math.floor(phase * 8), footContact: contact });
    return this.current;
  }
}
