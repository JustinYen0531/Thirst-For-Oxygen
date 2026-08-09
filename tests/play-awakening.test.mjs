import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLAY_AWAKENING_TIMING,
  createPlayAwakeningState,
  getPlayAttemptState,
  getPlayAwakeningDuration,
  getPlayAwakeningRenderState,
  stepPlayAwakening,
} from '../src/play-awakening.js';

test('Attempt uses remaining-total notation without reusing HP terminology', () => {
  assert.deepEqual(getPlayAttemptState({ lives: 3, maxLives: 3 }), { remaining: 3, maximum: 3, label: 'ATTEMPT 3/3' });
  assert.deepEqual(getPlayAttemptState({ lives: 2, maxLives: 3 }), { remaining: 2, maximum: 3, label: 'ATTEMPT 2/3' });
  assert.deepEqual(getPlayAttemptState({ lives: 0, maxLives: 3 }), { remaining: 0, maximum: 3, label: 'ATTEMPT 0/3' });
});

test('part-one awakening reveals Attempt and HUD before three eye blinks', () => {
  const state = createPlayAwakeningState();
  let render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'black');
  assert.equal(render.attemptOpacity, 0);
  assert.equal(render.hudOpacity, 0);
  assert.equal(render.eyeOpenRatio, 0);
  assert.equal(render.blocksGameplay, true);

  stepPlayAwakening(state, PLAY_AWAKENING_TIMING.blackHold + PLAY_AWAKENING_TIMING.attemptFadeDuration);
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.attemptOpacity, 1);
  assert.ok(render.hudOpacity > 0 && render.hudOpacity < 1);

  state.elapsed = PLAY_AWAKENING_TIMING.blinkStart + PLAY_AWAKENING_TIMING.blinkDuration * 0.5;
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'blink-1');
  assert.equal(render.blinkIndex, 1);
  assert.ok(render.eyeOpenRatio > 0.99);

  state.elapsed = PLAY_AWAKENING_TIMING.blinkStart + PLAY_AWAKENING_TIMING.blinkDuration * 2.5;
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'blink-3');
  assert.equal(render.blinkIndex, 3);
  assert.ok(render.eyeOpenRatio > 0.99);
});

test('awakening ends fully open and releases gameplay', () => {
  const state = createPlayAwakeningState();
  stepPlayAwakening(state, getPlayAwakeningDuration());
  const render = getPlayAwakeningRenderState(state);
  assert.equal(render.active, false);
  assert.equal(render.maskVisible, false);
  assert.equal(render.eyeOpenRatio, 1);
  assert.equal(render.attemptOpacity, 1);
  assert.equal(render.hudOpacity, 1);
  assert.equal(render.blocksGameplay, false);
});

test('reduced-motion preference shortens rather than removes the authored entrance', () => {
  const regular = createPlayAwakeningState();
  const reduced = createPlayAwakeningState({ reducedMotion: true });
  stepPlayAwakening(regular, 1);
  stepPlayAwakening(reduced, 1);
  assert.equal(regular.active, true);
  assert.equal(reduced.active, false);
});
