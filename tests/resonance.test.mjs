import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_DEFINITIONS, getPlayerDerivedStats } from '../src/game-data.js';
import {
  RESONANCE_BUFFS,
  RESONANCE_RULES,
  applyResonanceBuffsToStats,
  createResonanceState,
  getResonanceRequirement,
  getResonanceRenderState,
  reduceEnemyResonanceOnDamage,
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
  assert.equal(owner.resonanceProgress, RESONANCE_RULES.rangedProjectileGainPerSecond);
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

test('each successful player damage hit lowers the target Resonance value', () => {
  const target = enemy({ resonanceProgress: 12 });
  assert.equal(reduceEnemyResonanceOnDamage(target), RESONANCE_RULES.damageProgressLossPerHit);
  assert.equal(target.resonanceProgress, 4);
  assert.equal(target.resonanceSource, 'damage');
  assert.equal(reduceEnemyResonanceOnDamage(target), 4);
  assert.equal(target.resonanceProgress, 0);
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
  assert.equal(state.stacksByEnemyId.get('explodingLanternfish'), 2);
});

test('dangerous melee Resonance is dramatically faster than safe ranged grazing', () => {
  const melee = enemy({ enemyId: 'crabGuard', tier: 2 });
  const ranged = enemy({ enemyId: 'lionfishGunner', tier: 2 });
  assert.equal(getResonanceRequirement(melee), 45);
  assert.equal(getResonanceRequirement(ranged), 100);
  assert.ok(RESONANCE_RULES.meleeBodyGainPerSecond > RESONANCE_RULES.rangedBodyGainPerSecond);
  assert.ok(getResonanceRequirement(melee) / RESONANCE_RULES.meleeBodyGainPerSecond < 5);
  assert.ok(getResonanceRequirement(ranged) / RESONANCE_RULES.rangedProjectileGainPerSecond > 8);
});

test('lanternfish grants one-percent micro-stacks up to nine-percent damage reduction', () => {
  const state = createResonanceState();
  const events = [];
  for (let index = 0; index < 10; index += 1) {
    const target = enemy({ instanceId: `lantern-${index}`, resonanceProgress: 39 });
    events.push(stepEnemyResonance({ enemies: [target], actor, state, dt: 1 })[0]);
  }
  assert.equal(state.stacksByEnemyId.get('explodingLanternfish'), 9);
  assert.deepEqual(events.map((entry) => entry.stackGained), [true, true, true, true, true, true, true, true, true, false]);
  assert.equal(events[9].stackCount, 9);
  const stats = applyResonanceBuffsToStats(getPlayerDerivedStats([]), state);
  assert.equal(stats.resonanceDamageTakenMultiplier, 0.91);
});

test('powerful Boss Resonance buffs use three micro-stacks while preserving their old total cap', () => {
  const state = createResonanceState();
  state.stacksByEnemyId.set('abyssalSpermWhale', 4);
  const render = getResonanceRenderState(state);
  assert.equal(render.buffs[0].stacks, 3);
  assert.equal(render.buffs[0].maxStacks, 3);
  const stats = applyResonanceBuffsToStats(getPlayerDerivedStats([]), state);
  assert.ok(Math.abs(stats.currentDamageMultiplier - 0.6 * 1.1) < 1e-9);
  assert.equal(stats.resonanceDamageTakenMultiplier, 0.96);
});

test('unlocked buffs are applied from a fresh base without compounding each frame', () => {
  const state = createResonanceState();
  state.unlockedEnemyIds.add('juvenileSeahorseCaller');
  state.unlockedEnemyIds.add('lobsterSoldier');
  state.unlockedEnemyIds.add('squidAssassin');
  const base = getPlayerDerivedStats([]);
  const first = applyResonanceBuffsToStats(base, state);
  const second = applyResonanceBuffsToStats(base, state);
  assert.ok(Math.abs(first.maxOxygen - 100 * Math.cbrt(1.08)) < 1e-9);
  assert.ok(Math.abs(first.currentDamageMultiplier - 0.6 * Math.cbrt(1.06)) < 1e-9);
  assert.ok(Math.abs(first.oxygenDrainMultiplier - Math.cbrt(0.94)) < 1e-9);
  assert.deepEqual(second, first);
});
