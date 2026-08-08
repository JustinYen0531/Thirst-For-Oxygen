import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSandboxState,
  playerAttack,
  setSandboxBuild,
  spawnSandboxEnemy,
  stepSandbox,
} from '../src/sandbox-sim.js';

test('sandbox katana showcase ingredients hit a nearby target with the sword sprite swing', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'katana', weaponLevel: 1 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 40, y: state.actor.y }, {
    moveSpeed: 0,
    health: 100,
    maxHealth: 100,
  });

  const result = playerAttack(state);
  assert.equal(result.hit, true);
  assert.equal(enemy.health, 72);
  assert.equal(state.effects.some((effect) => effect.type === 'katanaSwing'), true);
  stepSandbox(state);
});
