import { type Aabb, type Vec2, WORLD_TILE_SIZE_PX } from "./geometry";
import type { PlayerBody } from "./scene";

export const PLAYER_WALK_SPEED = 40;
const PLAYER_RUN_ACCELERATION = 96;
export const PLAYER_JUMP_GRACE = Object.freeze({ coyote: 0.1, buffer: 0.12 });
export interface PlayerJumpGrace { readonly coyote: number; readonly buffer: number }
export const EMPTY_JUMP_GRACE: PlayerJumpGrace = Object.freeze({ coyote: 0, buffer: 0 });

export const PLAYER_MOTION = Object.freeze({
  moveSpeed: 88,
  groundAcceleration: 300,
  airAcceleration: 220,
  groundDeceleration: 520,
  airDeceleration: 72,
  turnAcceleration: 840,
  gravity: 560,
  maxFallSpeed: 240,
  jumpSpeed: 190,
  jumpReleaseGravityMultiplier: 2.4,
  fallGravityMultiplier: 1.25,
});

export interface PlayerMotionState {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly grounded: boolean;
}

export interface PlayerMotionInput {
  readonly moveX: number;
  readonly jump: boolean;
}

export interface PlayerMotionStepOptions {
  readonly state: PlayerMotionState;
  readonly body: PlayerBody;
  readonly input: PlayerMotionInput;
  readonly previousJump: boolean;
  readonly fixedSeconds: number;
  readonly collides: (bounds: Aabb) => boolean;
  /** Opt-in; callers retain this fixed-time state across steps, never render frames. */
  readonly jumpGrace?: PlayerJumpGrace;
  /** Optional physical water fraction; zero keeps the approved dry-land gait exact. */
  readonly immersion?: number;
}

export interface PlayerMotionStepResult {
  readonly state: PlayerMotionState;
  readonly previousJump: boolean;
  readonly jumpGrace?: PlayerJumpGrace;
}

const EPSILON = 1e-9;

export function stepPlayerMotion(options: PlayerMotionStepOptions): PlayerMotionStepResult {
  const state = { ...options.state };
  const wasGrounded = state.grounded;
  const pressed = options.input.jump && !options.previousJump;
  let coyote = state.grounded ? PLAYER_JUMP_GRACE.coyote : Math.max(0, (options.jumpGrace?.coyote ?? 0) - options.fixedSeconds);
  let buffer = pressed ? PLAYER_JUMP_GRACE.buffer : Math.max(0, (options.jumpGrace?.buffer ?? 0) - options.fixedSeconds);
  const jumping = options.jumpGrace ? buffer > EPSILON && coyote > EPSILON : pressed && state.grounded;
  const wet = Number.isFinite(options.immersion) ? Math.max(0, Math.min(1, options.immersion!)) : 0;
  const targetVelocity = options.input.moveX * PLAYER_MOTION.moveSpeed * (1 - wet * 0.48);
  const reversing = options.input.moveX !== 0 && Math.sign(targetVelocity) !== Math.sign(state.velocityX) &&
    Math.abs(state.velocityX) > EPSILON;
  const rate = reversing
    ? state.grounded ? PLAYER_MOTION.turnAcceleration : PLAYER_MOTION.airAcceleration
    : options.input.moveX === 0
      ? state.grounded ? PLAYER_MOTION.groundDeceleration : PLAYER_MOTION.airDeceleration
      : state.grounded ? groundedAcceleration(state.velocityX, targetVelocity) : PLAYER_MOTION.airAcceleration;
  state.velocityX = approach(state.velocityX, targetVelocity, rate * options.fixedSeconds);
  if (jumping) {
    state.velocityY = -PLAYER_MOTION.jumpSpeed;
    state.grounded = false;
    coyote = buffer = 0;
  }
  const gravityMultiplier = state.velocityY < 0 && !options.input.jump
    ? PLAYER_MOTION.jumpReleaseGravityMultiplier
    : state.velocityY > 0
      ? PLAYER_MOTION.fallGravityMultiplier
      : 1;
  state.velocityY = Math.min(
    PLAYER_MOTION.maxFallSpeed,
    state.velocityY + PLAYER_MOTION.gravity * gravityMultiplier * options.fixedSeconds,
  );

  if (wet > 0) {
    state.velocityX *= Math.exp(-wet * 1.2 * options.fixedSeconds);
    state.velocityY = (state.velocityY - PLAYER_MOTION.gravity * gravityMultiplier * options.fixedSeconds * wet * 0.64) *
      Math.exp(-wet * 3.4 * options.fixedSeconds);
  }

  moveAxis(state, state.velocityX * options.fixedSeconds, "x", options.body, options.collides);
  state.grounded = false;
  moveAxis(state, state.velocityY * options.fixedSeconds, "y", options.body, options.collides);
  if (wasGrounded && !jumping && !state.grounded && state.velocityY >= 0) {
    for (let depth = 1; depth <= 3; depth += 1) {
      if (options.collides({ x: state.x, y: state.y + depth, ...options.body })) {
        moveAxis(state, depth, "y", options.body, options.collides);
        break;
      }
    }
  }
  // A press just before contact launches once on contact, without waiting for a
  // second input edge. Holding the button must not replenish this buffer.
  if (options.jumpGrace && state.grounded && buffer > EPSILON) {
    state.velocityY = -PLAYER_MOTION.jumpSpeed;
    state.grounded = false;
    coyote = buffer = 0;
  }
  return Object.freeze({ state: Object.freeze(state), previousJump: options.input.jump,
    ...(options.jumpGrace ? { jumpGrace: Object.freeze({ coyote, buffer }) } : {}) });
}

export function normalizeMoveAxis(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function groundedAcceleration(currentVelocity: number, targetVelocity: number): number {
  const sameDirection = Math.sign(currentVelocity) === Math.sign(targetVelocity);
  const buildingBeyondWalk = sameDirection &&
    Math.abs(currentVelocity) >= PLAYER_WALK_SPEED &&
    Math.abs(targetVelocity) > PLAYER_WALK_SPEED;
  return buildingBeyondWalk ? PLAYER_RUN_ACCELERATION : PLAYER_MOTION.groundAcceleration;
}

function approach(value: number, target: number, maximumDelta: number): number {
  if (value < target) return Math.min(value + maximumDelta, target);
  if (value > target) return Math.max(value - maximumDelta, target);
  return target;
}

function moveAxis(
  state: { x: number; y: number; velocityX: number; velocityY: number; grounded: boolean },
  delta: number,
  axis: "x" | "y",
  body: PlayerBody,
  collides: (bounds: Aabb) => boolean,
): void {
  const maximumStep = WORLD_TILE_SIZE_PX / 4;
  let remaining = delta;
  while (Math.abs(remaining) > EPSILON) {
    const step = Math.sign(remaining) * Math.min(Math.abs(remaining), maximumStep);
    const candidate: Vec2 = {
      x: state.x + (axis === "x" ? step : 0),
      y: state.y + (axis === "y" ? step : 0),
    };
    if (collides({ ...candidate, ...body })) {
      if (axis === "x" && state.grounded) {
        let stepped = false;
        for (let lift = 1; lift <= 3; lift += 1) {
          if (!collides({ x: state.x, y: state.y - lift, ...body }) &&
              !collides({ x: candidate.x, y: candidate.y - lift, ...body })) {
            state.x = candidate.x;
            state.y = candidate.y - lift;
            remaining -= step;
            stepped = true;
            break;
          }
        }
        if (stepped) continue;
      }
      // Advance to contact instead of discarding the entire substep. Keeping the
      // last safe point avoids both visible foot gaps and entry into thin solids.
      let safe = 0;
      let blocked = 1;
      for (let iteration = 0; iteration < 16; iteration += 1) {
        const t = (safe + blocked) / 2;
        const probe = { x: state.x + (axis === "x" ? step * t : 0),
          y: state.y + (axis === "y" ? step * t : 0), ...body };
        if (collides(probe)) blocked = t;
        else safe = t;
      }
      state[axis] += step * safe;
      const contactPixel = Math.round(state[axis]);
      if (Math.abs(contactPixel - state[axis]) < 0.0001 &&
          !collides({ x: axis === "x" ? contactPixel : state.x,
            y: axis === "y" ? contactPixel : state.y, ...body })) state[axis] = contactPixel;
      if (axis === "x") state.velocityX = 0;
      else {
        if (step > 0) state.grounded = true;
        state.velocityY = 0;
      }
      return;
    }
    state.x = candidate.x;
    state.y = candidate.y;
    remaining -= step;
  }
}
