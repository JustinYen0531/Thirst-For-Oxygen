import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLAYER_ANIMATION_ASSETS,
  getPlayerAnimationFrameScale,
  getPlayerAnimationMotion,
  getPlayerFacingDirection,
  getPlayerSpriteScaleX,
} from '../src/player-animation.js';
import { createTestActor, launchActor } from '../src/physics.js';

test('player facing keeps the last physics-synced side while vertical', () => {
  const actor = { vx: -40, vy: 0, facing: 'right' };
  assert.equal(getPlayerFacingDirection(actor), 'right');
  actor.facing = 'left';
  actor.vx = 0;
  actor.vy = 80;
  assert.equal(getPlayerFacingDirection(actor), 'left');
});

test('launch direction synchronizes the diver facing before the first frame', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const leftLaunch = launchActor(actor, { x: 280, y: 200 });
  assert.equal(leftLaunch.launched, true);
  assert.equal(actor.facing, 'left');
  const rightLaunch = launchActor(actor, { x: 120, y: 200 });
  assert.equal(rightLaunch.launched, true);
  assert.equal(actor.facing, 'right');
});

test('sprite mirror rule keeps the source pose right-facing', () => {
  assert.equal(getPlayerSpriteScaleX('right', 1), 1);
  assert.equal(getPlayerSpriteScaleX('left', 1), -1);
  assert.equal(getPlayerSpriteScaleX(undefined, 1), 1);
});

test('player animation keeps one uniform motion scale and uses stable frame envelopes', () => {
  Object.keys(PLAYER_ANIMATION_ASSETS).forEach((animationState) => {
    for (let frameIndex = 0; frameIndex < 6; frameIndex += 1) {
      assert.ok(Number.isFinite(getPlayerAnimationFrameScale(animationState, frameIndex)));
    }
  });

  ['swim', 'hurt', 'death', 'fastAscent'].forEach((animationState) => {
    const motion = getPlayerAnimationMotion(animationState, 0.5, { x: 0, y: 0, vx: 0, vy: 0 });
    assert.equal(motion.scaleX, motion.scaleY);
    assert.ok(motion.scaleX > 0.8 && motion.scaleX < 1.2);
  });
});
