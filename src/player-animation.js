const PLAYER_ANIMATION_ROOT = '/assets/editor/actors/player';
const framePaths = (action) => Object.freeze(Array.from({ length: 6 }, (_, index) => `${PLAYER_ANIMATION_ROOT}/${action}/player-diver__${action}__${String(index + 1).padStart(2, '0')}.png`));

// The six source frames share a 512px canvas, but their authored alpha
// envelopes are not identical. These small per-frame presentation factors
// keep the diver's visible body at a stable size without removing pose motion.
const PLAYER_ANIMATION_FRAME_SCALES = Object.freeze({
  swim: Object.freeze([0.984, 1.019, 1.012, 0.988, 1.071, 0.976]),
  hurt: Object.freeze([1.005, 1, 1, 1.049, 0.987, 0.989]),
  death: Object.freeze([0.836, 0.863, 1.022, 1.105, 0.979, 1.093]),
  fastAscent: Object.freeze([0.967, 1.035, 1.049, 1.052, 0.914, 0.967]),
});

export const PLAYER_ANIMATION_ASSETS = Object.freeze({
  swim: framePaths('swim'),
  rest: framePaths('swim'),
  hurt: framePaths('hurt'),
  death: framePaths('death'),
  fastAscent: framePaths('fast-ascent'),
});

export const PLAYER_ANIMATION_IMAGE_KEYS = Object.freeze({
  swim: 'playerSwim',
  rest: 'playerSwim',
  hurt: 'playerHurt',
  death: 'playerDeath',
  fastAscent: 'playerFastAscent',
});

// The generated diver poses point toward the right in their source files.
// Keep the mirror rule here so every renderer uses the same visual contract.
export const PLAYER_SPRITE_SOURCE_FACING = 'right';

export function getPlayerSpriteScaleX(facing, scale = 1) {
  const magnitude = Number.isFinite(scale) ? Math.abs(scale) : 1;
  const resolvedFacing = facing === 'left' ? 'left' : 'right';
  return resolvedFacing === PLAYER_SPRITE_SOURCE_FACING ? magnitude : -magnitude;
}

export const PLAYER_HURT_DURATION = 0.42;
export const PLAYER_DEATH_DURATION = 0.9;
export const FAST_ASCENT_VELOCITY = -55;
export const PLAYER_ANIMATION_FPS = 12;
export const PLAYER_ANIMATION_FRAME_COUNT = 6;

export function getPlayerAnimationState(actor) {
  if (!actor) return 'swim';
  if (actor.gameOver || actor.dead || (actor.deathAnimation?.timer ?? 0) > 0) return 'death';
  if ((actor.hurtTimer ?? 0) > 0) return 'hurt';
  if (actor.blockedResting && Math.hypot(actor.vx ?? 0, actor.vy ?? 0) < 1.5) return 'rest';
  if (actor.vy <= FAST_ASCENT_VELOCITY) return 'fastAscent';
  return 'swim';
}

export function getPlayerAnimationPosition(actor) {
  if (actor?.deathAnimation && Number.isFinite(actor.deathAnimation.x) && Number.isFinite(actor.deathAnimation.y)) {
    return { x: actor.deathAnimation.x, y: actor.deathAnimation.y };
  }
  return { x: actor?.x ?? 0, y: actor?.y ?? 0 };
}

export function getPlayerAnimationFrameIndex(animationState, time = 0, actor = null) {
  if (animationState === 'rest') return 0;
  if (animationState === 'hurt') {
    const progress = 1 - Math.max(0, Math.min(PLAYER_HURT_DURATION, actor?.hurtTimer ?? 0)) / PLAYER_HURT_DURATION;
    return Math.max(0, Math.min(PLAYER_ANIMATION_FRAME_COUNT - 1, Math.floor(progress * PLAYER_ANIMATION_FRAME_COUNT)));
  }
  if (animationState === 'death') {
    return Math.max(0, Math.min(PLAYER_ANIMATION_FRAME_COUNT - 1, Math.floor((actor?.deathAnimation?.elapsed ?? 0) * PLAYER_ANIMATION_FPS)));
  }
  return Math.floor(Math.max(0, time) * PLAYER_ANIMATION_FPS) % PLAYER_ANIMATION_FRAME_COUNT;
}

export function getPlayerAnimationFrameScale(animationState, frameIndex = 0) {
  const scales = PLAYER_ANIMATION_FRAME_SCALES[animationState] ?? PLAYER_ANIMATION_FRAME_SCALES.swim;
  const safeIndex = Math.max(0, Math.min(scales.length - 1, Math.floor(Number.isFinite(frameIndex) ? frameIndex : 0)));
  return scales[safeIndex] ?? 1;
}

export function getPlayerFacingDirection(actor) {
  if (actor?.facing === 'left' || actor?.facing === 'right') return actor.facing;
  if ((actor?.vx ?? 0) < -1) return 'left';
  if ((actor?.vx ?? 0) > 1) return 'right';
  return actor?.facing ?? 'right';
}

export function getPlayerAnimationMotion(animationState, time = 0, actor = null) {
  const speed = Math.hypot(actor?.vx ?? 0, actor?.vy ?? 0);
  const frameIndex = getPlayerAnimationFrameIndex(animationState, time, actor);
  const frameScale = getPlayerAnimationFrameScale(animationState, frameIndex);
  if (animationState === 'rest') {
    return {
      rotation: 0,
      scaleX: frameScale,
      scaleY: frameScale,
      bob: 0,
      alpha: 1,
      glow: '#c6f8ff',
    };
  }
  if (animationState === 'hurt') {
    return {
      rotation: -0.1 + Math.sin(time * 34) * 0.035,
      scaleX: frameScale,
      scaleY: frameScale,
      bob: Math.sin(time * 20) * 0.35,
      alpha: 0.86 + Math.abs(Math.sin(time * 26)) * 0.14,
      glow: '#ffb7a1',
    };
  }
  if (animationState === 'death') {
    return {
      rotation: -0.28 + Math.sin(time * 1.8) * 0.04,
      scaleX: frameScale,
      scaleY: frameScale,
      bob: Math.sin(time * 2.2) * 0.45,
      alpha: actor?.gameOver ? 0.84 : 0.72,
      glow: '#9aaabd',
    };
  }
  if (animationState === 'fastAscent') {
    return {
      rotation: Math.sin(time * 12) * 0.018,
      scaleX: frameScale,
      scaleY: frameScale,
      bob: -Math.abs(Math.sin(time * 5)) * 0.6,
      alpha: 1,
      glow: '#d8fbff',
    };
  }
  return {
    rotation: Math.sin(time * 1.35 + (actor?.y ?? 0) * 0.008) * 0.025 + Math.max(-0.06, Math.min(0.06, (actor?.vy ?? 0) * 0.002)),
    scaleX: frameScale,
    scaleY: frameScale,
    bob: Math.sin(time * 1.8 + (actor?.x ?? 0) * 0.01) * (speed > 1 ? 0.7 : 0.35),
    alpha: 0.98,
    glow: '#c6f8ff',
  };
}
