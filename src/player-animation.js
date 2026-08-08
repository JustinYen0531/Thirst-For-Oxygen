export const PLAYER_ANIMATION_ASSETS = Object.freeze({
  swim: '/assets/editor/actors/player-diver-swim.png',
  hurt: '/assets/editor/actors/player-diver-hurt.png',
  death: '/assets/editor/actors/player-diver-death.png',
  fastAscent: '/assets/editor/actors/player-diver-fast-ascent.png',
});

export const PLAYER_ANIMATION_IMAGE_KEYS = Object.freeze({
  swim: 'playerSwim',
  hurt: 'playerHurt',
  death: 'playerDeath',
  fastAscent: 'playerFastAscent',
});

export const PLAYER_HURT_DURATION = 0.42;
export const PLAYER_DEATH_DURATION = 0.9;
export const FAST_ASCENT_VELOCITY = -55;

export function getPlayerAnimationState(actor) {
  if (!actor) return 'swim';
  if (actor.gameOver || actor.dead || (actor.deathAnimation?.timer ?? 0) > 0) return 'death';
  if ((actor.hurtTimer ?? 0) > 0) return 'hurt';
  if (actor.vy <= FAST_ASCENT_VELOCITY) return 'fastAscent';
  return 'swim';
}

export function getPlayerAnimationPosition(actor) {
  if (actor?.deathAnimation && Number.isFinite(actor.deathAnimation.x) && Number.isFinite(actor.deathAnimation.y)) {
    return { x: actor.deathAnimation.x, y: actor.deathAnimation.y };
  }
  return { x: actor?.x ?? 0, y: actor?.y ?? 0 };
}

export function getPlayerAnimationMotion(animationState, time = 0, actor = null) {
  const speed = Math.hypot(actor?.vx ?? 0, actor?.vy ?? 0);
  if (animationState === 'hurt') {
    return {
      rotation: -0.1 + Math.sin(time * 34) * 0.035,
      scaleX: 1 + Math.sin(time * 28) * 0.025,
      scaleY: 1 - Math.sin(time * 28) * 0.025,
      bob: Math.sin(time * 20) * 0.35,
      alpha: 0.86 + Math.abs(Math.sin(time * 26)) * 0.14,
      glow: '#ffb7a1',
    };
  }
  if (animationState === 'death') {
    return {
      rotation: -0.28 + Math.sin(time * 1.8) * 0.04,
      scaleX: 1 + Math.sin(time * 2.1) * 0.015,
      scaleY: 1 - Math.sin(time * 2.1) * 0.015,
      bob: Math.sin(time * 2.2) * 0.45,
      alpha: actor?.gameOver ? 0.84 : 0.72,
      glow: '#9aaabd',
    };
  }
  if (animationState === 'fastAscent') {
    return {
      rotation: Math.sin(time * 12) * 0.018,
      scaleX: 0.96 + Math.sin(time * 10) * 0.025,
      scaleY: 1.03 - Math.sin(time * 10) * 0.025,
      bob: -Math.abs(Math.sin(time * 5)) * 0.6,
      alpha: 1,
      glow: '#d8fbff',
    };
  }
  return {
    rotation: Math.sin(time * 1.35 + (actor?.y ?? 0) * 0.008) * 0.025 + Math.max(-0.06, Math.min(0.06, (actor?.vy ?? 0) * 0.002)),
    scaleX: 1 + Math.sin(time * 2.4) * 0.012,
    scaleY: 1 - Math.sin(time * 2.4) * 0.012,
    bob: Math.sin(time * 1.8 + (actor?.x ?? 0) * 0.01) * (speed > 1 ? 0.7 : 0.35),
    alpha: 0.98,
    glow: '#c6f8ff',
  };
}
