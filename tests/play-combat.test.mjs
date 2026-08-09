import test from 'node:test';
import assert from 'node:assert/strict';
import './resonance.test.mjs';
import { getEnemyDamageToPlayer } from '../src/game-data.js';
import { createTestActor } from '../src/physics.js';
import {
  KNIFE_DASH_MINIMUM_SPEED,
  choosePlayUpgrade,
  choosePlayUpgradeCategory,
  createPlayCombatState,
  getPlayCombatRenderState,
  recordPlayEnemyDefeats,
  restorePlayCombatBuild,
  syncPlayCombatBuild,
  stepPlayCombat,
} from '../src/play-combat.js';

function enemy(instanceId, enemyId, x, y, health = 200, radius = 12) {
  return { instanceId, enemyId, x, y, radius, health, maxHealth: health, defeated: false, state: 'idle', vx: 0, vy: 0 };
}

function advance(state, actor, enemies, seconds, options = {}) {
  const step = options.step ?? 1 / 60;
  let elapsed = 0;
  while (elapsed + 1e-9 < seconds && !state.awaitingUpgrade) {
    const dt = Math.min(step, seconds - elapsed);
    stepPlayCombat(state, { actor, enemies, previousPosition: { x: actor.x, y: actor.y }, dt, aiming: options.aiming ?? false });
    elapsed += dt;
  }
}

test('formal combat starts with only the permanent level-one knife', () => {
  const state = createPlayCombatState();
  assert.deepEqual(state.build.weapons, [{ id: 'knife', level: 1 }]);
  assert.deepEqual(state.build.passives, []);
  assert.deepEqual(state.experienceOrbs, []);
  assert.equal(state.weaponBurst, null);
  assert.deepEqual(getPlayCombatRenderState(state).build.weapons, [{ id: 'knife', level: 1 }]);
});

test('neutral Resonance partners cannot be targeted or damaged by player weapons', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 0, y: 0 });
  const partner = enemy('partner-1', 'crabGuard', 5, 0, 200);
  partner.resonanceNeutral = true;
  actor.x = 40;
  stepPlayCombat(state, { actor, enemies: [partner], previousPosition: { x: -40, y: 0 }, dt: 1 / 60 });
  assert.equal(partner.health, 200);
  assert.equal(state.effects.some((effect) => effect.type === 'weaponHit'), false);
  partner.health = 0;
  partner.defeated = true;
  assert.deepEqual(recordPlayEnemyDefeats(state, [partner], actor), []);
  assert.equal(state.experienceOrbs.length, 0, 'a resonated enemy never pays EXP even if another system later marks it defeated');
});

test('a defeated enemy drops one stationary orb and pickup opens the existing upgrade flow', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 0, y: 0 });
  const crab = enemy('crab-1', 'crabGuard', 100, 80, 0);
  crab.defeated = true;

  const first = recordPlayEnemyDefeats(state, [crab], actor);
  const second = recordPlayEnemyDefeats(state, [crab], actor);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0, 'the same death cannot pay twice');
  assert.deepEqual({ x: state.experienceOrbs[0].x, y: state.experienceOrbs[0].y }, { x: 100, y: 80 });

  actor.x = 100;
  actor.y = 80;
  state.experienceOrbs[0].value = 100;
  const result = stepPlayCombat(state, { actor, enemies: [crab], dt: 1 / 60 });
  assert.equal(result.collected.collected.length, 1);
  assert.equal(state.progression.level, 2);
  assert.equal(state.awaitingUpgrade, true);

  const category = choosePlayUpgradeCategory(state, 'weapon');
  assert.equal(category.ok, true);
  assert.equal(category.choices.length, 2);
  assert.match(category.choices[0].icon, /^\/assets\/editor\/icons\/weapons\/.+\/lv\d\.png$/);
  assert.ok(category.choices[0].detail.length > 18, '卡面必須顯示該級的實際進化說明');
  const rejectedSwitch = choosePlayUpgradeCategory(state, 'passive');
  assert.deepEqual(
    { ok: rejectedSwitch.ok, reason: rejectedSwitch.reason, category: rejectedSwitch.category },
    { ok: false, reason: 'categoryLocked', category: 'weapon' },
    '選定武器牌組後，本次升級不能退回被動牌組',
  );
  assert.equal(state.upgradeCategory, 'weapon');
  const upgrade = choosePlayUpgrade(state, category.choices[0], actor);
  assert.equal(upgrade.ok, true);
  assert.equal(state.progression.pendingLevelUps, 0);
  assert.equal(state.awaitingUpgrade, false);
  assert.equal(state.build.weapons[0].id, 'knife');
});

test('knife path pierces every crossed enemy and Lv.2 side tracks deal seventy percent damage', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  restorePlayCombatBuild(state, { weapons: [{ id: 'knife', level: 2 }] }, actor);
  const centreA = enemy('centre-a', 'crabGuard', 140, 100);
  const centreB = enemy('centre-b', 'crabGuard', 180, 100);
  const side = enemy('side', 'crabGuard', 160, 140);

  actor.x = 210;
  stepPlayCombat(state, {
    actor,
    enemies: [centreA, centreB, side],
    previousPosition: { x: 100, y: 100 },
    dt: 1 / 60,
  });

  assert.equal(centreA.health, 200 - 24 * 0.6);
  assert.equal(centreB.health, 200 - 24 * 0.6, 'main path must penetrate instead of stopping at the first target');
  assert.ok(Math.abs(side.health - (200 - 24 * 0.7 * 0.6)) < 1e-9);
  assert.ok(state.effects.some((effect) => effect.type === 'knifePath' && effect.hitIds.length === 2));
});

test('a medium forty-five-pixel-per-second dash is enough to trigger the knife path', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  const slowStart = { x: actor.x, y: actor.y };
  actor.x += (KNIFE_DASH_MINIMUM_SPEED - 5) / 60;
  stepPlayCombat(state, { actor, enemies: [], previousPosition: slowStart, dt: 1 / 60 });
  assert.equal(state.effects.some((effect) => effect.type === 'knifePath'), false);

  const mediumStart = { x: actor.x, y: actor.y };
  actor.x += (KNIFE_DASH_MINIMUM_SPEED + 5) / 60;
  stepPlayCombat(state, { actor, enemies: [], previousPosition: mediumStart, dt: 1 / 60 });
  assert.equal(state.effects.some((effect) => effect.type === 'knifePath'), true);
});

test('knife Lv.3 damages nearby enemies while stationary', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  restorePlayCombatBuild(state, { weapons: [{ id: 'knife', level: 3 }] }, actor);
  const target = enemy('area-target', 'crabGuard', 145, 100);

  stepPlayCombat(state, { actor, enemies: [target], previousPosition: { x: 100, y: 100 }, dt: 1 / 60 });
  assert.ok(target.health < 200);
  assert.ok(state.effects.some((effect) => effect.type === 'knifeStationaryArea'));
});

test('trident stays single-shot, waits one stationary second, stuns, and Lv.3 hit reduces cooldown', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  actor.energy = 100;
  state.progression.weapons = [{ id: 'knife', level: 1 }, { id: 'trident', level: 3 }];
  syncPlayCombatBuild(state, actor);
  const target = enemy('trident-target', 'crabGuard', 190, 100, 500);

  advance(state, actor, [target], 0.98);
  assert.equal(state.projectiles.length, 0);
  advance(state, actor, [target], 0.04);
  assert.equal(state.projectiles.length, 1, 'Lv.3 must remain one trident, not the sandbox three-shot drift');
  for (let elapsed = 0; elapsed < 0.5 && !state.effects.some((effect) => effect.type === 'tridentCooldownReduced'); elapsed += 1 / 60) {
    advance(state, actor, [target], 1 / 60);
  }
  assert.ok(target.health < 500);
  assert.ok(target.stunnedUntil > state.time, 'Lv.3 inherits the Lv.2 stun');
  const reduction = state.effects.find((effect) => effect.type === 'tridentCooldownReduced');
  assert.ok(reduction, 'successful Lv.3 hit records the cooldown reduction');
  assert.ok(reduction.before > reduction.after);
  assert.ok(Math.abs((reduction.before - reduction.after) - 0.27) < 1e-9, 'reduction comes directly from game-data');
});

test('machine gun locks six shots to one direction, charges once, and outlines shots four to six at Lv.2', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  actor.energy = 100;
  restorePlayCombatBuild(state, { weapons: [{ id: 'knife', level: 1 }, { id: 'lightMachineGun', level: 2 }] }, actor);
  const target = enemy('moving-target', 'crabGuard', 500, 200, 1000);

  const energyBefore = actor.energy;
  stepPlayCombat(state, { actor, enemies: [target], dt: 0.01 });
  const lockedAngle = state.projectiles[0].angle;
  target.y = 20;
  advance(state, actor, [target], 0.5);
  const shots = state.projectiles.filter((projectile) => projectile.weaponId === 'lightMachineGun').sort((left, right) => left.shotIndex - right.shotIndex);

  assert.equal(shots.length, 6);
  assert.ok(shots.every((shot) => Math.abs(shot.angle - lockedAngle) < 1e-9));
  assert.equal(actor.energy, energyBefore - 2, 'one burst charges energy once');
  assert.deepEqual(shots.map((shot) => shot.damage), [11, 11, 11, 11, 11, 11]);
  assert.deepEqual(shots.slice(3).map((shot) => shot.visual.bulletStyle), ['outlined', 'outlined', 'outlined']);
});

test('machine gun Lv.3 keeps six prism colours and ends without an explosion', () => {
  const endState = createPlayCombatState();
  const endActor = createTestActor({ x: 100, y: 100 });
  endState.progression.weapons = [{ id: 'knife', level: 1 }, { id: 'lightMachineGun', level: 3 }];
  syncPlayCombatBuild(endState, endActor);
  stepPlayCombat(endState, { actor: endActor, enemies: [], dt: 0.01 });
  endActor.attached = true;
  advance(endState, endActor, [], 0.5);
  const colours = endState.projectiles
    .filter((projectile) => projectile.weaponId === 'lightMachineGun')
    .sort((left, right) => left.shotIndex - right.shotIndex)
    .map((projectile) => projectile.visual.bulletColour);
  assert.equal(new Set(colours).size, 6);
  advance(endState, endActor, [], 1.2);
  assert.equal(endState.projectiles.length, 0);
  assert.ok(!endState.effects.some((effect) => effect.type === 'machineGunExplosion'));
});

test('passive damage multiplier flows through formal projectile damage and external katana deaths can be rewarded', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  restorePlayCombatBuild(state, {
    weapons: [{ id: 'knife', level: 1 }, { id: 'trident', level: 1 }],
    passives: [{ id: 'abyssalAmplifier', level: 3 }],
  }, actor);
  actor.oxygen = actor.derivedStats.maxOxygen;
  const target = enemy('amplified-target', 'crabGuard', 190, 100, 100);
  advance(state, actor, [target], 1.35);
  assert.ok(target.health < 100 - 20 * 0.6, 'high-oxygen amplifier must raise damage above the reduced baseline');

  const katanaVictim = enemy('katana-victim', 'lionfishGunner', 220, 100, 0);
  katanaVictim.defeated = true;
  const dropped = recordPlayEnemyDefeats(state, [katanaVictim], actor);
  assert.equal(dropped.length, 1, 'the outer play-katana system can report its defeated enemy exactly once');
});

test('formal weapons respect the coral seahorse life-link protection field', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 0, y: 0 });
  const protectedEnemy = enemy('protected', 'crabGuard', 30, 0, 100);
  protectedEnemy.linkedProtection = 'coral-protector';
  actor.x = 60;
  stepPlayCombat(state, { actor, enemies: [protectedEnemy], previousPosition: { x: 0, y: 0 }, dt: 1 / 60 });
  assert.equal(protectedEnemy.health, 100);
  assert.ok(state.effects.some((effect) => effect.type === 'weaponBlocked' && effect.protectorId === 'coral-protector'));
});

test('formal projectile weapons respect authored Boss damage reduction', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  const guardian = enemy('guardian', 'prismCrabGuardian', 140, 100, 200);
  actor.x = 180;
  stepPlayCombat(state, {
    actor,
    enemies: [guardian],
    previousPosition: { x: 100, y: 100 },
    dt: 1 / 60,
  });
  assert.equal(guardian.health, 200 - 18 * 0.6 * 0.75, 'global player damage and deep-sea carapace reductions both apply');
});

test('abyss-awakened whale thorns retaliate against a successful formal weapon hit', () => {
  const state = createPlayCombatState();
  const actor = createTestActor({ x: 100, y: 100 });
  const whale = enemy('whale', 'abyssalSpermWhale', 140, 100, 2400);
  whale.maxHealth = 5000;
  whale.name = '深淵抹香鯨';
  whale.passiveState = { enraged: true };
  actor.x = 180;
  stepPlayCombat(state, {
    actor,
    enemies: [whale],
    previousPosition: { x: 100, y: 100 },
    dt: 1 / 60,
  });
  assert.equal(actor.health, 100 - getEnemyDamageToPlayer(18));
  assert.ok(state.effects.some((effect) => effect.type === 'thornsHit' && effect.damage === getEnemyDamageToPlayer(18)));
});
