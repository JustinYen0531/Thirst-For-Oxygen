import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_DEFINITIONS, getPlayerDerivedStats } from '../src/game-data.js';
import {
  RESONANCE_BUFFS,
  RESONANCE_RULES,
  applyResonanceBuffsToStats,
  createResonanceState,
  getResonanceRenderState,
  stepEnemyResonance,
} from '../src/resonance.js';

function enemy(overrides = {}) {
  return {
    instanceId: 'enemy-1', enemyId: 'explodingLanternfish', name: '爆腹燈籠魚', tier: 1,
    x: 30, y: 0, radius: 10, health: 100, maxHealth: 100, defeated: false, vx: 20, vy: 0,
    ...overrides,
  };
}

const actor = { x: 0, y: 0, radius: 6 };

test('every authored enemy has an explicit permanent Resonance buff', () => {
  assert.deepEqual(Object.keys(RESONANCE_BUFFS).sort(), Object.keys(ENEMY_DEFINITIONS).sort());
  Object.values(RESONANCE_BUFFS).forEach((entry) => {
    assert.ok(entry.name && entry.description);
    assert.ok(Object.keys(entry.modifiers).length > 0);
  });
});

test('continuous body proximity fills the per-enemy bar and makes only that instance neutral', () => {
  const state = createResonanceState();
  const target = enemy();
  let events = [];
  for (let elapsed = 0; elapsed < 20 && !events.length; elapsed += 0.1) {
    events = stepEnemyResonance({ enemies: [target], actor, state, dt: 0.1 });
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].firstUnlock, true);
  assert.equal(target.resonanceNeutral, true);
  assert.equal(target.state, 'resonantNeutral');
  assert.equal(target.vx, 0);
  assert.equal(state.unlockedEnemyIds.has(target.enemyId), true);
  assert.equal(getResonanceRenderState(state).buffs[0].name, '冷光耐爆');
});

test('a projectile graze belongs to its firing enemy and fills faster than body proximity', () => {
  const state = createResonanceState();
  const owner = enemy({ x: 400, y: 400 });
  const other = enemy({ instanceId: 'enemy-2', enemyId: 'crabGuard', name: '螃蟹守衛', x: 400, y: 400, tier: 2 });
  stepEnemyResonance({ enemies: [owner, other], projectiles: [{ ownerId: owner.instanceId, x: 12, y: 0, radius: 3 }], actor, state, dt: 1 });
  assert.equal(owner.resonanceProgress, RESONANCE_RULES.projectileGainPerSecond);
  assert.equal(owner.resonanceSource, 'projectile');
  assert.equal(other.resonanceProgress, 0);
});

test('breaking continuous proximity grants a short grace then rapidly decays the bar', () => {
  const state = createResonanceState();
  const target = enemy();
  stepEnemyResonance({ enemies: [target], actor, state, dt: 1 });
  const gained = target.resonanceProgress;
  target.x = 500;
  stepEnemyResonance({ enemies: [target], actor, state, dt: RESONANCE_RULES.disengageGraceSeconds });
  assert.equal(target.resonanceProgress, gained);
  stepEnemyResonance({ enemies: [target], actor, state, dt: 0.5 });
  assert.ok(target.resonanceProgress < gained);
});

test('a species buff unlocks only once while later individuals can still become neutral', () => {
  const state = createResonanceState();
  const first = enemy({ resonanceProgress: 109 });
  const second = enemy({ instanceId: 'enemy-2', resonanceProgress: 109 });
  const firstEvent = stepEnemyResonance({ enemies: [first], actor, state, dt: 1 })[0];
  const secondEvent = stepEnemyResonance({ enemies: [second], actor, state, dt: 1 })[0];
  assert.equal(firstEvent.firstUnlock, true);
  assert.equal(secondEvent.firstUnlock, false);
  assert.equal(state.unlockedEnemyIds.size, 1);
  assert.equal(state.completedInstanceIds.size, 2);
});

test('unlocked buffs are applied from a fresh base without compounding each frame', () => {
  const state = createResonanceState();
  state.unlockedEnemyIds.add('juvenileSeahorseCaller');
  state.unlockedEnemyIds.add('lobsterSoldier');
  state.unlockedEnemyIds.add('squidAssassin');
  const base = getPlayerDerivedStats([]);
  const first = applyResonanceBuffsToStats(base, state);
  const second = applyResonanceBuffsToStats(base, state);
  assert.equal(first.maxOxygen, 108);
  assert.equal(first.currentDamageMultiplier, 1.06);
  assert.equal(first.oxygenDrainMultiplier, 0.94);
  assert.deepEqual(second, first);
});
