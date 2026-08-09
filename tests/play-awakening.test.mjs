import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLAY_DESCENT_ROUTE_STAGES,
  PLAY_AWAKENING_TIMING,
  beginPlayAwakening,
  createPlayAwakeningState,
  getPlayAttemptState,
  getPlayAwakeningDuration,
  getPlayAwakeningRenderState,
  getPlayShutterHalfDrawRect,
  stepPlayAwakening,
} from '../src/play-awakening.js';

test('Attempt uses remaining-total notation without reusing HP terminology', () => {
  assert.deepEqual(getPlayAttemptState({ lives: 3, maxLives: 3 }), { remaining: 3, maximum: 3, label: 'ATTEMPT 3/3' });
  assert.deepEqual(getPlayAttemptState({ lives: 2, maxLives: 3 }), { remaining: 2, maximum: 3, label: 'ATTEMPT 2/3' });
  assert.deepEqual(getPlayAttemptState({ lives: 0, maxLives: 3 }), { remaining: 0, maximum: 3, label: 'ATTEMPT 0/3' });
});

test('part-one awakening waits with the HUD visible, then closes, lights route one, and opens', () => {
  const state = createPlayAwakeningState();
  let render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'ready');
  assert.equal(render.awaitingTrigger, true);
  assert.equal(render.active, false);
  assert.equal(render.attemptOpacity, 1);
  assert.equal(render.hudOpacity, 1);
  assert.equal(render.routeLightRatio, 0);
  assert.equal(render.shutterOpenRatio, 1);
  assert.equal(render.maskVisible, false);
  assert.equal(render.blocksGameplay, true);

  beginPlayAwakening(state);
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'shutter-close');
  assert.equal(render.awaitingTrigger, false);
  assert.equal(render.active, true);
  assert.equal(render.shutterOpenRatio, 1);
  assert.equal(render.hudOpacity, 1);

  stepPlayAwakening(state, PLAY_AWAKENING_TIMING.shutterCloseDuration * .5);
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'shutter-close');
  assert.ok(render.shutterOpenRatio > 0 && render.shutterOpenRatio < 1);
  assert.equal(render.hudOpacity, 1);

  state.elapsed = PLAY_AWAKENING_TIMING.shutterCloseDuration
    + PLAY_AWAKENING_TIMING.shutterClosedHold
    + PLAY_AWAKENING_TIMING.routeLightDuration * .5;
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'route-lock');
  assert.equal(render.activeRouteIndex, 0);
  assert.ok(render.routeLightRatio > 0 && render.routeLightRatio < 1);
  assert.ok(render.routeOpacity > 0);
  assert.equal(render.shutterOpenRatio, 0);

  const shutterOpenStart = PLAY_AWAKENING_TIMING.shutterCloseDuration
    + PLAY_AWAKENING_TIMING.shutterClosedHold
    + PLAY_AWAKENING_TIMING.routeLightDuration
    + PLAY_AWAKENING_TIMING.routeHoldDuration;
  state.elapsed = shutterOpenStart + PLAY_AWAKENING_TIMING.shutterOpenDuration * .5;
  render = getPlayAwakeningRenderState(state);
  assert.equal(render.phase, 'shutter-open');
  assert.ok(render.shutterOpenRatio > 0 && render.shutterOpenRatio < 1);
  assert.equal(render.attemptOpacity, 1);
  assert.equal(render.hudOpacity, 1);
});

test('pressure shutter route labels preserve all three authored Descent names', () => {
  assert.deepEqual(PLAY_DESCENT_ROUTE_STAGES, [
    { part: 1, chapterLabel: '下沉篇・第一部分', title: '深海森林入口' },
    { part: 2, chapterLabel: '下沉篇・第二部分', title: '穿越熱泉' },
    { part: 3, chapterLabel: '下沉篇・第三部分', title: '深淵遺跡' },
  ]);
});

test('awakening lights the route belonging to the entered descent part', () => {
  assert.equal(getPlayAwakeningRenderState(createPlayAwakeningState({ part: 1 })).activeRouteIndex, 0);
  assert.equal(getPlayAwakeningRenderState(createPlayAwakeningState({ part: 2 })).activeRouteIndex, 1);
  assert.equal(getPlayAwakeningRenderState(createPlayAwakeningState({ part: 3 })).activeRouteIndex, 2);
});

test('pressure shutter always crops fixed top and bottom source halves before moving them', () => {
  const source = { imageWidth: 1672, imageHeight: 941, canvasWidth: 1200, canvasHeight: 680 };
  const closedTop = getPlayShutterHalfDrawRect({ ...source, topHalf: true, openRatio: 0 });
  const closedBottom = getPlayShutterHalfDrawRect({ ...source, topHalf: false, openRatio: 0 });
  const movingTop = getPlayShutterHalfDrawRect({ ...source, topHalf: true, openRatio: .5 });
  const movingBottom = getPlayShutterHalfDrawRect({ ...source, topHalf: false, openRatio: .5 });

  assert.deepEqual(
    { sy: closedTop.sy, sh: closedTop.sh, dy: closedTop.dy, dh: closedTop.dh },
    { sy: 0, sh: 470.5, dy: 0, dh: 340 },
  );
  assert.deepEqual(
    { sy: closedBottom.sy, sh: closedBottom.sh, dy: closedBottom.dy, dh: closedBottom.dh },
    { sy: 470.5, sh: 470.5, dy: 340, dh: 340 },
  );
  assert.equal(movingTop.sy, closedTop.sy);
  assert.equal(movingBottom.sy, closedBottom.sy);
  assert.equal(movingTop.dy, -190.4);
  assert.equal(movingBottom.dy, 530.4);
});

test('awakening ends fully open and releases gameplay', () => {
  const state = createPlayAwakeningState();
  beginPlayAwakening(state);
  stepPlayAwakening(state, getPlayAwakeningDuration());
  const render = getPlayAwakeningRenderState(state);
  assert.equal(render.active, false);
  assert.equal(render.maskVisible, false);
  assert.equal(render.shutterOpenRatio, 1);
  assert.equal(render.routeOpacity, 0);
  assert.equal(render.attemptOpacity, 1);
  assert.equal(render.hudOpacity, 1);
  assert.equal(render.blocksGameplay, false);
});

test('reduced-motion preference shortens rather than removes the authored entrance', () => {
  const regular = createPlayAwakeningState();
  const reduced = createPlayAwakeningState({ reducedMotion: true });
  beginPlayAwakening(regular);
  beginPlayAwakening(reduced);
  stepPlayAwakening(regular, 1);
  stepPlayAwakening(reduced, 1);
  assert.equal(regular.active, true);
  assert.equal(reduced.active, false);
});
