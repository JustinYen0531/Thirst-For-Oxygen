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
    assert.equal(slash.style, 'knifeMeteor');
    assert.equal(slash.colour, '#ffffff');
    assert.equal(state.effects.filter((effect) => effect.type === 'knifeTrail').length, level === 1 ? 0 : 2);
    assert.ok(slash.duration >= 0.68);
    assert.equal(slash.sparkleCount > 0, level === 3);
  });
});

test('knife preview creates a visible white meteor slash without a target', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 1 });

  const result = playerAttack(state);

  assert.equal(result.ok, true);
  assert.equal(result.hit, false);
  assert.equal(state.effects.filter((effect) => effect.type === 'playerSlash').length, 1);
  assert.equal(state.effects[0].style, 'knifeMeteor');
  assert.ok(state.effects[0].targetX > state.effects[0].startX, 'the preview should extend in the diver facing direction');
});

test('knife movement leaves a white meteor trace even before it reaches an enemy', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 1 });
  state.actor.vx = 120;

  stepSandbox(state);

  const slash = state.effects.find((effect) => effect.type === 'playerSlash');
  assert.ok(slash, 'knife movement should create a visible trace without a collision target');
  assert.equal(slash.style, 'knifeMeteor');
  assert.equal(slash.colour, '#ffffff');
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
  const sideTrails = state.effects.filter((effect) => effect.type === 'knifeTrail');
  assert.ok(sideTrails.length >= 2);
  assert.ok(sideTrails.every((effect) => effect.pathAlpha > 0), 'Lv.2 side trails should be visible from their first frame');
  assert.equal(new Set(sideTrails.map((effect) => Math.round(effect.startY))).size, 2, 'the side trails should be visibly separated from one another');
  stepSandbox(state, 0.9);
  assert.ok(state.effects.filter((effect) => effect.type === 'knifeTrail').length >= 2, 'Lv.2 side trails should remain visible long enough to inspect');
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

test('knife Lv.3 keeps its main meteor slash after the sweep finishes', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 3 });

  assert.equal(playerAttack(state).ok, true);
  const slash = state.effects.find((effect) => effect.type === 'playerSlash');
  assert.ok(slash);
  assert.equal(slash.pathAlpha > 0, true);
  stepSandbox(state, 3.1);
  const lingeringSlash = state.effects.find((effect) => effect.type === 'playerSlash');
  assert.ok(lingeringSlash, 'Lv.3 main knife trail should still be present after three seconds');
  assert.equal(lingeringSlash.sparkleCount > 0, true);
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

test('sandbox enemies chase the diver and deal contact damage', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 200, y: state.actor.y }, { moveSpeed: 52 });
  const startX = enemy.x;

  for (let index = 0; index < 240; index += 1) stepSandbox(state);

  assert.ok(enemy.x < startX, 'a mobile enemy should close the distance to the diver');
  assert.ok(state.actor.health < 100, 'a melee enemy should damage the diver once it reaches attack range');
  assert.ok(['chasing', 'attacking'].includes(enemy.state));
});

test('telegraphed enemy skills resolve after their authored cast window', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 60, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'dashClamp').pending, true);
  assert.equal(state.actor.health, 100, 'the dash should not hit before its warning finishes');
  assert.equal(enemy.state, 'casting');

  stepSandbox(state, 0.65);

  assert.ok(state.actor.health < 100, 'the dash should resolve after the telegraph');
  assert.equal(enemy.pendingSkill, null);
});

test('seahorse rescue waits six seconds before summoning core enemies', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'juvenileSeahorseCaller', { x: state.actor.x + 160, y: state.actor.y });
  const initialCount = state.enemies.length;

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'callForHelp').pending, true);
  for (let index = 0; index < 359; index += 1) stepSandbox(state);
  assert.equal(state.enemies.length, initialCount, '援軍不應該在六秒前出現');

  stepSandbox(state);
  assert.equal(state.enemies.length, initialCount + 2);
  assert.ok(state.enemies.slice(-2).every((candidate) => ['crabGuard', 'lobsterSoldier', 'lionfishGunner', 'squidAssassin'].includes(candidate.enemyId)));
});

test('lionfish venom projectile applies a timed player status', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'lionfishGunner', { x: state.actor.x + 70, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'venomStraightShot').ok, true);
  stepSandbox(state, 0.25);

  assert.ok((state.actor.activeEffects.venom ?? 0) > 0, '毒刺命中後應保留持續效果');
  const healthAfterHit = state.actor.health;
  stepSandbox(state, 0.5);
  assert.ok(state.actor.health < healthAfterHit, 'venom should continue dealing damage over time');
});

test('coral seahorse automatically links and protects a nearby ally', () => {
  const state = createSandboxState();
  const coral = spawnSandboxEnemy(state, 'coralBackSeahorse', { x: state.actor.x + 100, y: state.actor.y });
  const crab = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 120, y: state.actor.y }, { moveSpeed: 0, health: 1000, maxHealth: 1000 });
  state.selectedEnemyInstanceId = crab.instanceId;

  stepSandbox(state);
  const before = crab.health;
  assert.equal(coral.linkedTarget, crab.instanceId);
  assert.equal(crab.linkedProtection, coral.instanceId);
  playerAttack(state);
  assert.equal(crab.health, before, '生命連結中的目標應該先解除支援才能受傷');
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
