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
import { ENEMY_DEFINITIONS } from '../src/game-data.js';
import { getEnemySpriteScaleX, syncEnemyFacing } from '../src/enemy-movement.js';
import { getPlayEnemySteeringAngle } from '../src/play-enemies.js';
import { createEmptyMap, getHexCenter } from '../src/map-model.js';

test('enemy facing follows horizontal movement and mirrors left-facing source art to the right', () => {
  const enemy = { facing: 'left', vx: 32 };
  assert.equal(syncEnemyFacing(enemy), 'right');
  assert.equal(getEnemySpriteScaleX(enemy.facing), -1);
  enemy.vx = -18;
  assert.equal(syncEnemyFacing(enemy), 'left');
  assert.equal(getEnemySpriteScaleX(enemy.facing), 1);
  enemy.vx = 0;
  assert.equal(syncEnemyFacing(enemy), 'left', 'stopping keeps the last readable direction');
});

test('mobile enemies steer around a blocked direct cell while authored stationary supports stay fixed', () => {
  const map = createEmptyMap({ width: 5, height: 5 });
  const origin = { x: 0, y: 0 };
  const start = getHexCenter(map.cells['1,2'], origin);
  const target = getHexCenter(map.cells['3,2'], origin);
  map.cells['2,2'].terrain = 'blocked';
  const angle = getPlayEnemySteeringAngle(start, target, 52, 1 / 60, { map, chapter: 'chapter1', origin });
  assert.notEqual(angle, null);
  assert.ok(Math.cos(angle) > 0 && Math.abs(Math.sin(angle)) > 0.2, 'the route keeps making rightward progress through an open side cell');
  assert.deepEqual(
    Object.values(ENEMY_DEFINITIONS).filter((enemy) => enemy.moveSpeed === 0).map((enemy) => enemy.id),
    ['juvenileSeahorseCaller', 'coralBackSeahorse', 'mutantNautilusOracle'],
  );
});

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
