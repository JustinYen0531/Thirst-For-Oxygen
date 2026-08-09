import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SANDBOX_ENEMY_ACTION_VISUAL_HOLD,
  createSandboxState,
  executeEnemySkill,
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
  assert.equal(enemy.health, 100 - 28 * 0.6);
  assert.equal(state.effects.some((effect) => effect.type === 'katanaSwing'), true);
  stepSandbox(state);
});

test('sandbox keeps one full exact skill animation across cast and resolution', () => {
  const state = createSandboxState();
  state.autoCycle = false;
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 300, y: state.actor.y }, { moveSpeed: 0 });

  const cast = executeEnemySkill(state, enemy.instanceId, 'clawSwipe');
  assert.equal(cast.pending, true);
  assert.equal(enemy.animation, 'clawSwipe');
  assert.equal(enemy.animationUntil >= SANDBOX_ENEMY_ACTION_VISUAL_HOLD, true);
  const playbackToken = enemy.animationToken;

  state.time = 0.5;
  enemy.pendingSkill = null;
  const resolved = executeEnemySkill(state, enemy.instanceId, 'clawSwipe', { resolve: true });
  assert.equal(resolved.ok, true);
  assert.equal(enemy.animationToken, playbackToken, 'resolving the cast must not restart the GIF from an unrelated frame');
  assert.equal(enemy.animationUntil >= state.time + SANDBOX_ENEMY_ACTION_VISUAL_HOLD, true);

  stepSandbox(state, SANDBOX_ENEMY_ACTION_VISUAL_HOLD + 0.01);
  assert.equal(enemy.animation, 'idle');
});
