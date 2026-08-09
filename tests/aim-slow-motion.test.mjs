import assert from 'node:assert/strict';
import test from 'node:test';

import { AIM_TIME_SCALE, getAimTimeScale, scaleSimulationDelta } from '../src/aim-slow-motion.js';
import { beginSandboxAim, createSandboxState, stepSandbox } from '../src/sandbox-sim.js';

test('aiming uses a half-speed simulation scale', () => {
  assert.equal(AIM_TIME_SCALE, 0.5);
  assert.equal(getAimTimeScale(false), 1);
  assert.equal(getAimTimeScale(true), 0.5);
  assert.equal(scaleSimulationDelta(2, false), 2);
  assert.equal(scaleSimulationDelta(2, true), 1);
});

test('sandbox slows the player and world clock while aiming instead of pausing', () => {
  const state = createSandboxState();
  state.actor.vx = 100;
  assert.equal(beginSandboxAim(state, { x: state.actor.x + 100, y: state.actor.y }).ok, true);

  stepSandbox(state, 1);

  assert.equal(state.time, 0.5);
  assert.equal(state.actor.x, 200);
  assert.equal(state.actor.vx, 100);
});
