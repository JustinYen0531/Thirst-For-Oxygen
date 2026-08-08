import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addExperience,
  applyUpgradeChoice,
  collectExperienceOrbs,
  createExperienceOrb,
  createProgressionState,
  getEnemyExperienceReward,
  getExperienceProgress,
  getUpgradeCandidates,
  getUpgradeChoices,
  setActiveWeapon,
} from '../src/progression.js';
import {
  SANDBOX_PLAYER_INTERACTION_RADIUS,
  createSandboxState,
  executeEnemySkill,
  isSandboxPlayerHit,
  playerAttack,
  setSandboxBuild,
  spawnSandboxEnemy,
  stepSandbox,
} from '../src/sandbox-sim.js';

test('new progression starts with one level-one knife and no other slots', () => {
  const progression = createProgressionState();

  assert.deepEqual(progression.weapons, [{ id: 'knife', level: 1 }]);
  assert.deepEqual(progression.passives, []);
  assert.equal(progression.activeWeaponSlot, 0);
  assert.deepEqual(getExperienceProgress(progression), {
    level: 1,
    current: 0,
    required: 100,
    ratio: 0,
    total: 0,
    atMaxLevel: false,
  });
});

test('enemy experience is derived from its authored tier', () => {
  assert.equal(getEnemyExperienceReward('explodingLanternfish'), 14);
  assert.equal(getEnemyExperienceReward('arcTideRay'), 38);
  assert.equal(getEnemyExperienceReward('abyssalSpermWhale'), 600);
  assert.equal(getEnemyExperienceReward('missing-enemy'), 0);
});

test('sandbox enemy defeat drops a stationary orb instead of granting instant experience', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 20, y: state.actor.y }, { health: 1, maxHealth: 1 });
  state.selectedEnemyInstanceId = enemy.instanceId;

  assert.equal(playerAttack(state).ok, true);
  assert.equal(state.progression.totalExperience, 0);
  assert.equal(state.experienceOrbs.length, 1);
  assert.deepEqual(
    state.experienceOrbs[0],
    {
      id: 'exp-1',
      x: enemy.x,
      y: enemy.y,
      value: 24,
      radius: 7,
      source: 'crabGuard',
      collected: false,
    },
  );
});

test('sandbox weapon use respects the authored cooldown before firing again', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 20, y: state.actor.y }, { health: 100, maxHealth: 100 });
  state.selectedEnemyInstanceId = enemy.instanceId;

  assert.equal(playerAttack(state).ok, true);
  assert.equal(playerAttack(state).reason, 'cooldown');
  for (let index = 0; index < 40; index += 1) state.actor.cooldowns && (state.actor.cooldowns['weapon:knife'] = Math.max(0, (state.actor.cooldowns['weapon:knife'] ?? 0) - 1 / 60));
  assert.equal(playerAttack(state).ok, true);
});

test('level-one knife passes through a hit instead of reflecting the diver', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 5, y: state.actor.y }, { health: 100, maxHealth: 100 });
  state.actor.vx = 40;

  stepSandbox(state);

  assert.ok(enemy.health < enemy.maxHealth);
  assert.ok(state.actor.vx > 0, 'knife collision should keep the diver moving forward');
});

test('knife levels expose distinct vector slash effects without image assets', () => {
  [1, 2, 3].forEach((level) => {
    const state = createSandboxState();
    setSandboxBuild(state, { weaponId: 'knife', weaponLevel: level });
    const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 20, y: state.actor.y }, { health: 1000, maxHealth: 1000 });
    state.selectedEnemyInstanceId = enemy.instanceId;

    assert.equal(playerAttack(state).ok, true);
    const slash = state.effects.find((effect) => effect.type === 'playerSlash');
    assert.ok(slash, `knife Lv.${level} should create a slash effect`);
    assert.equal(slash.style, 'knifeArc');
    assert.equal(slash.arcCount, level);
    assert.equal(slash.trailCount, level - 1);
    assert.equal(slash.accentCount, Math.max(0, level - 1));
  });
});

test('knife Lv.2 creates side trails that deal seventy percent damage', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 2 });
  state.actor.x = 200;
  state.actor.y = 280;
  state.actor.vx = 100;
  const primary = spawnSandboxEnemy(state, 'crabGuard', { x: 207, y: 280 }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });
  const side = spawnSandboxEnemy(state, 'crabGuard', { x: 207, y: 313 }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });

  stepSandbox(state);

  assert.ok(primary.health < primary.maxHealth, 'the movement path should hit the primary target');
  assert.equal(side.health, 1000 - 24 * 0.7, 'the side trail should use seventy percent of the main damage');
  assert.ok(state.effects.some((effect) => effect.type === 'knifeTrail'));
});

test('knife Lv.3 deals continuous area damage while the diver is stopped', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 3 });
  state.actor.x = 200;
  state.actor.y = 280;
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: 240, y: 280 }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });

  stepSandbox(state);

  assert.ok(enemy.health < enemy.maxHealth, 'a stopped Lv.3 knife should damage nearby enemies');
  assert.ok(state.effects.some((effect) => effect.type === 'knifeArea'));
  assert.ok((state.actor.cooldowns['weapon:knife:stationaryArea'] ?? 0) > 0);
});

test('sandbox gives the diver a generous control area before enemy placement', () => {
  const state = createSandboxState();
  assert.equal(isSandboxPlayerHit(state, { x: state.actor.x + SANDBOX_PLAYER_INTERACTION_RADIUS - 1, y: state.actor.y }), true);
  assert.equal(isSandboxPlayerHit(state, { x: state.actor.x + SANDBOX_PLAYER_INTERACTION_RADIUS + 1, y: state.actor.y }), false);
});

test('lanternfish locks a point, waits one second, then detonates', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'explodingLanternfish', { x: state.actor.x + 200, y: state.actor.y });
  const target = { x: state.actor.x, y: state.actor.y };
  assert.equal(executeEnemySkill(state, enemy.instanceId, 'contactExplosion').ok, true);
  assert.equal(enemy.defeated, false);

  let arrivalSteps = 0;
  while (enemy.suicideCharge?.phase !== 'detonating' && arrivalSteps < 240) {
    stepSandbox(state);
    arrivalSteps += 1;
  }
  assert.ok(arrivalSteps < 240, 'lanternfish should reach the locked detonation point');
  assert.deepEqual({ x: enemy.x, y: enemy.y }, target);
  assert.equal(enemy.defeated, false);

  stepSandbox(state, 0.5);
  assert.equal(enemy.defeated, false);
  stepSandbox(state, 0.5);
  assert.equal(enemy.defeated, true);
  assert.equal(state.experienceOrbs.length, 1);
});

test('experience orbs stay stationary until the player enters pickup range', () => {
  const progression = createProgressionState();
  const orb = createExperienceOrb('exp-1', 100, 100, 100, 'crabGuard');

  const far = collectExperienceOrbs(progression, [orb], { x: 0, y: 0, radius: 6 });
  assert.equal(far.collected.length, 0);
  assert.deepEqual(far.remaining, [orb]);
  assert.equal(progression.totalExperience, 0);

  const near = collectExperienceOrbs(progression, far.remaining, { x: 100, y: 100, radius: 6 });
  assert.equal(near.remaining.length, 0);
  assert.equal(near.collected.length, 1);
  assert.equal(near.levelUps, 1);
  assert.equal(progression.level, 2);
  assert.equal(progression.experience, 0);
  assert.equal(progression.pendingLevelUps, 1);
});

test('level-up choices can upgrade the knife or acquire a second weapon', () => {
  const progression = createProgressionState();
  const candidates = getUpgradeCandidates(progression, 'weapon');
  assert.ok(candidates.some((choice) => choice.id === 'knife' && choice.action === 'upgrade' && choice.level === 2));
  assert.ok(candidates.some((choice) => choice.id === 'trident' && choice.action === 'acquire' && choice.level === 1));

  progression.pendingLevelUps = 1;
  const choice = getUpgradeChoices(progression, 'weapon', 4).find((entry) => entry.id === 'trident');
  assert.ok(choice);
  const result = applyUpgradeChoice(progression, choice);
  assert.equal(result.ok, true);
  assert.deepEqual(progression.weapons, [
    { id: 'knife', level: 1 },
    { id: 'trident', level: 1 },
  ]);
  assert.equal(progression.pendingLevelUps, 0);
  assert.equal(setActiveWeapon(progression, 'trident').id, 'trident');
  assert.equal(progression.activeWeaponSlot, 1);
});

test('weapon slots enforce the 3/2/1 level caps while preserving the knife', () => {
  const progression = createProgressionState();
  progression.weapons = [
    { id: 'knife', level: 3 },
    { id: 'trident', level: 2 },
    { id: 'katana', level: 1 },
  ];

  const candidates = getUpgradeCandidates(progression, 'weapon');
  assert.equal(candidates.some((choice) => choice.id === 'knife'), false);
  assert.equal(candidates.some((choice) => choice.id === 'trident'), false);
  assert.equal(candidates.some((choice) => choice.id === 'katana'), false);
  assert.equal(candidates.some((choice) => choice.action === 'acquire'), false);
});

test('adding multiple orbs creates one pending upgrade per crossed level', () => {
  const progression = createProgressionState();
  const result = collectExperienceOrbs(
    progression,
    [createExperienceOrb('exp-a', 0, 0, 230)],
    { x: 0, y: 0, radius: 6 },
  );

  assert.equal(result.levelUps, 2);
  assert.equal(progression.level, 3);
  assert.equal(progression.pendingLevelUps, 2);
  assert.equal(progression.experience, 0);
});

test('non-positive experience does not create a level-up', () => {
  const progression = createProgressionState();
  assert.deepEqual(addExperience(progression, 0), { gained: 0, levelUps: 0, levels: [] });
  assert.deepEqual(addExperience(progression, -20), { gained: 0, levelUps: 0, levels: [] });
  assert.equal(progression.level, 1);
});
