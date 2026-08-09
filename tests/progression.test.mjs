import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  getSandboxAutoWeaponStatuses,
  isSandboxPlayerHit,
  playerAttack,
  playerAttackAllWeapons,
  setSandboxBuild,
  setSandboxActiveWeapon,
  spawnSandboxEnemy,
  stepSandbox,
} from '../src/sandbox-sim.js';
import { ENEMY_DEFINITIONS, getEnemyDamageToPlayer, getWeaponStats } from '../src/game-data.js';

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
  assert.equal(getEnemyExperienceReward('explodingLanternfish'), 42);
  assert.equal(getEnemyExperienceReward('arcTideRay'), 114);
  assert.equal(getEnemyExperienceReward('abyssalSpermWhale'), 1800);
  assert.equal(getEnemyExperienceReward('missing-enemy'), 0);
});

test('sandbox enemy defeat drops a stationary orb instead of granting instant experience', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 20, y: state.actor.y }, { health: 1, maxHealth: 1 });
  state.selectedEnemyInstanceId = enemy.instanceId;

  assert.equal(playerAttack(state).ok, true);
  assert.equal(state.progression.totalExperience, 0);
  assert.equal(state.enemies.length, 0, '擊敗的敵人不應該留下屍體阻擋沙盒');
  assert.equal(state.experienceOrbs.length, 1);
  assert.deepEqual(
    state.experienceOrbs[0],
    {
      id: 'exp-1',
      x: enemy.x,
      y: enemy.y,
      value: 72,
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
    const expectedColours = { 1: '#8fe8ff', 2: '#ffbd6e', 3: '#eaa7ff' };
    assert.equal(slash.colour, expectedColours[level]);
    assert.ok(slash.glowColour, `knife Lv.${level} should expose a level-specific glow colour`);
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

test('knife movement leaves a cyan meteor trace even before it reaches an enemy', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'knife', weaponLevel: 1 });
  state.actor.vx = 120;

  stepSandbox(state);

  const slash = state.effects.find((effect) => effect.type === 'playerSlash');
  assert.ok(slash, 'knife movement should create a visible trace without a collision target');
  assert.equal(slash.style, 'knifeMeteor');
  assert.equal(slash.colour, '#8fe8ff');
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

test('katana levels use a clockwise sword sprite contract instead of a white slash arc', () => {
  const levelOne = getWeaponStats('katana', 1);
  const levelTwo = getWeaponStats('katana', 2);
  const levelThree = getWeaponStats('katana', 3);

  assert.equal(levelOne.effect.style, 'katanaClockwiseSwing');
  assert.match(levelOne.effect.sprite, /abyssal-katana\.png$/);
  assert.equal(levelOne.effect.weaponLength, 36);
  assert.equal(levelOne.effect.weaponThickness, 5.6);
  assert.equal(levelOne.effect.afterimageCount >= 5, true);
  assert.equal(levelOne.effect.empowerAfterMovement, undefined);
  assert.ok(levelOne.range >= 48 && levelOne.range <= 56, 'katana should reach roughly two Cells');
  assert.equal(levelTwo.effect.empowerAfterMovement, true);
  assert.equal(levelTwo.effect.empoweredDamageMultiplier, 2);
  assert.equal(levelTwo.effect.weaponLength, 37);
  assert.equal(levelTwo.effect.afterimageCount > levelOne.effect.afterimageCount, true);
  assert.notEqual(levelTwo.effect.colour, levelOne.effect.colour);
  assert.notEqual(levelThree.effect.colour, levelTwo.effect.colour);
  assert.equal(levelThree.effect.wave.style, 'katanaProjectileWave');
  assert.equal(levelThree.effect.weaponLength, 38);
  assert.equal(levelThree.effect.wave.travelDistance > levelThree.effect.wave.startDistance, true);
  assert.equal(levelThree.effect.wave.arcDegrees < 120, true);
  assert.equal(levelThree.effect.wave.thickness > 0, true);
});

test('katana Lv.1 auto-swings the sword clockwise around a nearby enemy', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'katana', weaponLevel: 1 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 40, y: state.actor.y }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });

  stepSandbox(state);

  assert.ok(enemy.health < enemy.maxHealth, 'a nearby enemy should be hit automatically');
  const slash = state.effects.find((effect) => effect.type === 'katanaSwing');
  assert.ok(slash);
  assert.equal(slash.style, 'katanaClockwiseSwing');
  assert.equal(slash.empowered, false);
  assert.equal(state.effects.some((effect) => effect.style === 'knifeMeteor'), false);
  assert.ok(slash.duration <= 0.3, 'katana swing should remain a quick effect');
});

test('katana Lv.2 empowers only the next slash after movement', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'katana', weaponLevel: 2 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: 820, y: state.actor.y }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });
  state.actor.vx = 120;

  stepSandbox(state);

  assert.equal(state.actor.katanaEmpoweredNextSlash, true);
  enemy.x = state.actor.x + 40;
  enemy.y = state.actor.y;
  const result = playerAttack(state);
  assert.equal(result.ok, true);
  assert.equal(enemy.health, 1000 - 38 * 2);
  assert.equal(state.actor.katanaEmpoweredNextSlash, false);
  const slash = [...state.effects].reverse().find((effect) => effect.type === 'katanaSwing');
  assert.equal(slash.empowered, true);
  assert.equal(slash.colour, '#ff5c8a');
  assert.equal(slash.afterimageCount, 6);
});

test('katana Lv.3 fires a moving white shockwave that destroys enemy projectiles', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'katana', weaponLevel: 3 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 40, y: state.actor.y }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });
  state.projectiles.push({ id: 'enemy-test-projectile', x: state.actor.x + 50, y: state.actor.y, vx: 0, vy: 0, source: 'enemy', radius: 2, damage: 10, life: 5, age: 0 });

  const result = playerAttack(state);
  assert.equal(result.ok, true);
  assert.ok(state.effects.some((effect) => effect.type === 'katanaWave' && effect.style === 'katanaProjectileWave'));
  assert.equal(state.effects.some((effect) => effect.type === 'knifeTrail'), false);

  stepSandbox(state);

  assert.equal(state.projectiles.length, 0, 'the outer arc should destroy an enemy projectile');
  const wave = state.effects.find((effect) => effect.type === 'katanaWave');
  assert.equal(wave.destroyedProjectiles, 1);
  assert.equal(wave.arcDegrees < 120, true);
});

test('sandbox gives the diver a generous control area before enemy placement', () => {
  const state = createSandboxState();
  assert.equal(isSandboxPlayerHit(state, { x: state.actor.x + SANDBOX_PLAYER_INTERACTION_RADIUS - 1, y: state.actor.y }), true);
  assert.equal(isSandboxPlayerHit(state, { x: state.actor.x + SANDBOX_PLAYER_INTERACTION_RADIUS + 1, y: state.actor.y }), false);
});

test('lanternfish only starts its one-second detonation after overlapping the diver', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'explodingLanternfish', { x: state.actor.x + 200, y: state.actor.y });
  assert.equal(executeEnemySkill(state, enemy.instanceId, 'contactExplosion').reason, 'overlap');
  assert.equal(enemy.suicideCharge ?? null, null);

  enemy.x = state.actor.x;
  enemy.y = state.actor.y;
  assert.equal(executeEnemySkill(state, enemy.instanceId, 'contactExplosion').ok, true);
  const target = { x: enemy.x, y: enemy.y };
  assert.equal(enemy.defeated, false);
  assert.equal(enemy.suicideCharge?.phase, 'detonating');
  assert.deepEqual({ x: enemy.x, y: enemy.y }, target);
  assert.equal(enemy.defeated, false);

  state.actor.x += 100;
  stepSandbox(state, 0.5);
  assert.equal(enemy.defeated, false);
  stepSandbox(state, 0.5);
  assert.equal(enemy.defeated, true);
  assert.equal(state.enemies.includes(enemy), false, '死亡敵人應該從沙盒場景移除');
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

test('sandbox melee overlap starts a visible cast before dealing damage', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x, y: state.actor.y }, { moveSpeed: 0 });

  stepSandbox(state, 1 / 60);
  assert.equal(state.actor.health, 100, '碰到敵人本體的第一幀不得直接受傷');
  assert.equal(enemy.state, 'casting');
  assert.ok(enemy.pendingSkill?.remaining > 0);

  stepSandbox(state, 0.32);
  assert.ok(state.actor.health < 100, '只有技能讀條完成後才能造成近戰傷害');
});

test('manual enemy attack activation also waits for the attack cast', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x, y: state.actor.y }, { moveSpeed: 0 });

  const result = executeEnemySkill(state, enemy.instanceId, 'clawSwipe');
  assert.equal(result.pending, true);
  assert.equal(state.actor.health, 100, '選擇攻擊不能在攻擊動畫完成前直接造成傷害');

  stepSandbox(state, 0.32);
  assert.ok(state.actor.health < 100, '攻擊動畫完成後才可結算傷害');
});

test('telegraphed enemy skills resolve after their authored cast window', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 60, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'dashClamp').pending, true);
  assert.equal(state.actor.health, 100, 'the dash should not hit before its warning finishes');
  assert.equal(enemy.state, 'casting');

  stepSandbox(state, 0.65);

  const dash = ENEMY_DEFINITIONS.crabGuard.attacks.find((skill) => skill.id === 'dashClamp');
  assert.equal(state.actor.health, 100 - getEnemyDamageToPlayer(dash.damage), 'the dash should resolve at forty percent damage after the telegraph');
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
  assert.equal(state.enemies.length, initialCount + 1);
  assert.ok(['crabGuard', 'lobsterSoldier', 'lionfishGunner', 'squidAssassin'].includes(state.enemies.at(-1).enemyId));
});

test('lionfish venom projectile applies a timed player status', () => {
  const state = createSandboxState();
  state.infiniteResources = false;
  state.actor.oxygen = 50;
  state.actor.energy = 50;
  const enemy = spawnSandboxEnemy(state, 'lionfishGunner', { x: state.actor.x + 70, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'venomStraightShot').ok, true);
  stepSandbox(state, 1.2);

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

test('juvenile seahorse begins its rescue cast when the diver enters its radius', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'juvenileSeahorseCaller', { x: state.actor.x + 150, y: state.actor.y });

  stepSandbox(state);
  assert.equal(enemy.pendingSkill?.skillId, 'callForHelp');
  assert.equal(state.enemies.length, 1, '援軍應該先等待求援倒數');
  for (let index = 0; index < 360; index += 1) stepSandbox(state);
  assert.equal(enemy.rescueCompleted, true);
  assert.equal(state.enemies.length, 2);
});

test('coral seahorse remains invulnerable while multiple Lv.2 allies are linked', () => {
  const state = createSandboxState();
  const coral = spawnSandboxEnemy(state, 'coralBackSeahorse', { x: state.actor.x + 100, y: state.actor.y }, { moveSpeed: 0 });
  const first = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 120, y: state.actor.y }, { moveSpeed: 0, health: 1000, maxHealth: 1000 });
  const second = spawnSandboxEnemy(state, 'lionfishGunner', { x: state.actor.x + 140, y: state.actor.y }, { moveSpeed: 0, health: 1000, maxHealth: 1000 });

  stepSandbox(state);
  assert.deepEqual(new Set(coral.linkedTargets), new Set([first.instanceId, second.instanceId]));
  state.selectedEnemyInstanceId = coral.instanceId;
  const before = coral.health;
  playerAttack(state);
  assert.equal(coral.health, before, '支援目標存在時珊瑚背海馬本體不可受傷');
});

test('mantis beacon assault marks a locked point before the delayed jump', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'mantisShrimpBrute', { x: state.actor.x + 160, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'beaconAssault').ok, true);
  assert.equal(enemy.beacon?.remaining, 0.8);
  assert.equal(state.actor.health, 100);
  stepSandbox(state, 0.8);
  assert.equal(enemy.beacon, null);
  assert.ok(state.actor.health < 100, '信標突襲完成後才應該造成傷害');
  assert.ok(state.logs.some((entry) => entry.message.includes('投出信標')));
});

test('nautilus mortar bursts into a spread and dual-core magic emits a spiral stream', () => {
  const mortarState = createSandboxState();
  const mortar = spawnSandboxEnemy(mortarState, 'nautilusOracle', { x: mortarState.actor.x + 300, y: mortarState.actor.y }, { moveSpeed: 0 });
  executeEnemySkill(mortarState, mortar.instanceId, 'coralMortar');
  assert.equal(mortarState.zones[0].damageType, 'projectile');
  stepSandbox(mortarState, 1.1);
  assert.equal(mortarState.projectiles.length, 3);
  assert.ok(mortarState.projectiles.every((projectile) => projectile.source === 'enemy'));

  const magicState = createSandboxState();
  const oracle = spawnSandboxEnemy(magicState, 'nautilusOracle', { x: magicState.actor.x + 300, y: magicState.actor.y }, { moveSpeed: 0 });
  executeEnemySkill(magicState, oracle.instanceId, 'dualCoreMagic');
  stepSandbox(magicState, 0.32);
  assert.equal(magicState.projectiles.filter((projectile) => projectile.spiral).length, 2);
  stepSandbox(magicState, 0.35);
  assert.ok(magicState.projectiles.some((projectile) => !projectile.spiral), '雙核應該沿途發射小子彈');
});

test('nautilus short thrust pushes instead of dealing direct damage', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'nautilusOracle', { x: state.actor.x + 35, y: state.actor.y }, { moveSpeed: 0 });
  const before = state.actor.vx;

  executeEnemySkill(state, enemy.instanceId, 'shortThrust');
  stepSandbox(state, 0.32);

  assert.equal(state.actor.health, 100);
  assert.ok(state.actor.vx < before, '短距離刺擊應把玩家往外推');
});

test('squid shadow slash hides during its cast and leaves ink after the hit', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'squidAssassin', { x: state.actor.x + 180, y: state.actor.y }, { moveSpeed: 0 });

  assert.equal(executeEnemySkill(state, enemy.instanceId, 'inkShadowSlash').pending, true);
  assert.equal(enemy.hidden, true);
  stepSandbox(state, 0.7);
  assert.equal(enemy.hidden, false);
  assert.equal(state.actor.inInk, true);
});

test('split lanternfish descendants shrink their contact explosion radius', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'splitLanternfish', { x: state.actor.x + 20, y: state.actor.y }, { moveSpeed: 0, splitGeneration: 1 });

  executeEnemySkill(state, enemy.instanceId, 'splitRush');
  stepSandbox(state, 0.3);
  const area = state.effects.find((effect) => effect.type === 'area');
  assert.ok(area);
  assert.ok(area.radius < 48);
});

test('lobster spear and lionfish scatter each create their authored projectile counts', () => {
  const lobsterState = createSandboxState();
  const lobster = spawnSandboxEnemy(lobsterState, 'lobsterSoldier', { x: lobsterState.actor.x + 180, y: lobsterState.actor.y }, { moveSpeed: 0 });
  executeEnemySkill(lobsterState, lobster.instanceId, 'spearThrow');
  stepSandbox(lobsterState, 0.32);
  assert.equal(lobsterState.projectiles.length, 1);
  assert.equal(lobsterState.projectiles[0].damage, 24);
  assert.equal(Math.hypot(lobsterState.projectiles[0].vx, lobsterState.projectiles[0].vy), 65);

  const lionfishState = createSandboxState();
  const lionfish = spawnSandboxEnemy(lionfishState, 'lionfishGunner', { x: lionfishState.actor.x + 180, y: lionfishState.actor.y }, { moveSpeed: 0 });
  executeEnemySkill(lionfishState, lionfish.instanceId, 'spineScatter');
  stepSandbox(lionfishState, 0.32);
  assert.equal(lionfishState.projectiles.length, 5);
  assert.ok(new Set(lionfishState.projectiles.map((projectile) => projectile.vy)).size > 1);
  assert.ok(lionfishState.projectiles.every((projectile) => projectile.radius === 3));
});

test('sandbox auto-cycle keeps lionfish attacks in one alternating cooldown sequence', () => {
  const state = createSandboxState();
  state.autoCycle = true;
  state.invincible = true;
  const enemy = spawnSandboxEnemy(state, 'lionfishGunner', { x: state.actor.x + 100, y: state.actor.y }, { moveSpeed: 0 });
  for (let index = 0; index < 380; index += 1) stepSandbox(state);

  const sequence = state.logs
    .filter((entry) => entry.message.includes('獅子魚砲手・') && entry.message.includes('已啟動'))
    .sort((left, right) => left.time - right.time)
    .map((entry) => entry.message);
  assert.match(sequence[0], /毒刺直射/);
  assert.match(sequence[1], /棘刺散射/);
  assert.match(sequence[2], /毒刺直射/);
});

test('trident can be preview-fired without a target and carries its authored visual contract', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'trident', weaponLevel: 1 });

  const result = playerAttack(state);

  assert.equal(result.ok, true);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].weaponId, 'trident');
  assert.equal(state.projectiles[0].weaponLevel, 1);
  assert.equal(state.projectiles[0].visual.sprite, '/assets/editor/weapons/trident.png');
});

test('stationary trident waits one second before auto-firing and resets its charge timer', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'trident', weaponLevel: 1 });
  state.infiniteResources = true;

  stepSandbox(state, 0.98);
  assert.equal(state.projectiles.length, 0);
  assert.ok(state.actor.tridentStationaryTime < 1);

  stepSandbox(state, 0.04);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].weaponId, 'trident');
  assert.equal(state.actor.tridentStationaryTime, 0);
});

test('trident level two stuns and level three stays single-shot while shortening cooldown on hit', () => {
  const levelTwo = createSandboxState();
  setSandboxBuild(levelTwo, { weaponId: 'trident', weaponLevel: 2 });
  const stunnedEnemy = spawnSandboxEnemy(levelTwo, 'crabGuard', { x: levelTwo.actor.x + 90, y: levelTwo.actor.y }, { moveSpeed: 0 });

  assert.equal(playerAttack(levelTwo).ok, true);
  stepSandbox(levelTwo, 0.3);
  assert.ok(stunnedEnemy.stunnedUntil > levelTwo.time);
  assert.ok(levelTwo.effects.some((effect) => effect.type === 'tridentImpact' && effect.style === 'tridentStun'));

  const levelThree = createSandboxState();
  setSandboxBuild(levelThree, { weaponId: 'trident', weaponLevel: 3 });
  spawnSandboxEnemy(levelThree, 'crabGuard', { x: levelThree.actor.x + 90, y: levelThree.actor.y }, { moveSpeed: 0, health: 1000, maxHealth: 1000 });

  assert.equal(playerAttack(levelThree).ok, true);
  assert.equal(levelThree.projectiles.length, 1);
  assert.equal(levelThree.projectiles[0].weaponLevel, 3);
  const cooldownBeforeHit = levelThree.actor.cooldowns['weapon:trident'];
  stepSandbox(levelThree, 0.3);
  assert.ok(levelThree.actor.cooldowns['weapon:trident'] < Math.max(0, cooldownBeforeHit - 0.3), '命中應額外縮短下一次發射冷卻');
});

test('light machine gun fires six rounds on one locked aim direction and charges energy once', () => {
  const state = createSandboxState();
  state.infiniteResources = false;
  setSandboxBuild(state, { weaponId: 'lightMachineGun', weaponLevel: 1 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 280, y: state.actor.y + 140 }, { moveSpeed: 0 });
  const energyBefore = state.actor.energy;

  const result = playerAttack(state);
  assert.equal(result.ok, true);
  assert.equal(state.actor.energy, energyBefore - 2);
  assert.equal(state.projectiles.length, 1, '第一發應該立即出膛');
  assert.equal(state.weaponBurst?.shotCount, 6);
  assert.equal(state.weaponBurst?.targetId, enemy.instanceId);
  const lockedAngle = state.projectiles[0].angle;

  enemy.y = state.actor.y - 220;
  stepSandbox(state, 0.5);
  assert.equal(state.projectiles.length, 6);
  assert.ok(state.projectiles.every((projectile) => Math.abs(projectile.angle - lockedAngle) < 1e-9));
  assert.equal(state.actor.energy, energyBefore - 2, '連射中的後五發不應重複扣能量');
  const gun = state.effects.find((effect) => effect.type === 'lightMachineGun');
  assert.ok(gun);
  assert.equal(gun.firedShots, 6);
});

test('light machine gun Lv.2 changes the last three outlines and Lv.3 uses distinct bullet colours', () => {
  const levelTwo = createSandboxState();
  setSandboxBuild(levelTwo, { weaponId: 'lightMachineGun', weaponLevel: 2 });
  playerAttack(levelTwo);
  stepSandbox(levelTwo, 0.5);
  const levelTwoShots = [...levelTwo.projectiles].sort((left, right) => left.shotIndex - right.shotIndex);
  assert.equal(levelTwoShots.length, 6);
  assert.deepEqual(levelTwoShots.slice(0, 3).map((shot) => shot.visual.bulletStyle), ['tracer', 'tracer', 'tracer']);
  assert.deepEqual(levelTwoShots.slice(3).map((shot) => shot.visual.bulletStyle), ['outlined', 'outlined', 'outlined']);
  assert.equal(new Set(levelTwoShots.slice(3).map((shot) => shot.visual.bulletColour)).size, 1);

  const levelThree = createSandboxState();
  setSandboxBuild(levelThree, { weaponId: 'lightMachineGun', weaponLevel: 3 });
  playerAttack(levelThree);
  stepSandbox(levelThree, 0.5);
  const levelThreeShots = [...levelThree.projectiles].sort((left, right) => left.shotIndex - right.shotIndex);
  assert.equal(levelThreeShots.length, 6);
  assert.ok(levelThreeShots.every((shot) => shot.visual.bulletStyle === 'prism'));
  assert.equal(new Set(levelThreeShots.map((shot) => shot.visual.bulletColour)).size, 6);
});

test('equipped light machine gun auto-fires a burst after its cooldown without manual input', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'lightMachineGun', weaponLevel: 1 });

  stepSandbox(state, 0.1);
  assert.equal(state.projectiles.length, 1, '自動連射應該先立即發射第一發');
  assert.ok(state.weaponBurst, '第一發應該建立六發連射狀態');

  stepSandbox(state, 0.6);
  assert.equal(state.projectiles.length, 6, '連射狀態應該在短時間內完成六發');

  stepSandbox(state, 0.1);
  assert.equal(state.projectiles.length, 7, '冷卻結束後應該自動開始下一輪');
});

test('sandbox exposes readable auto-fire countdown and burst status', () => {
  const tridentState = createSandboxState();
  setSandboxBuild(tridentState, { weapons: [{ id: 'trident', level: 1 }], allowEmpty: true });
  assert.match(getSandboxAutoWeaponStatuses(tridentState)[0].label, /1\.0 秒後自動發射/);
  stepSandbox(tridentState, 0.5);
  assert.match(getSandboxAutoWeaponStatuses(tridentState)[0].label, /0\.5 秒後自動發射/);
  tridentState.aiming = true;
  assert.equal(getSandboxAutoWeaponStatuses(tridentState)[0].label, '暫停：拉射中');

  const machineGunState = createSandboxState();
  setSandboxBuild(machineGunState, { weapons: [{ id: 'lightMachineGun', level: 1 }], allowEmpty: true });
  assert.equal(getSandboxAutoWeaponStatuses(machineGunState)[0].label, '準備自動六連射');
  stepSandbox(machineGunState, 0.1);
  assert.match(getSandboxAutoWeaponStatuses(machineGunState)[0].label, /自動六連射 1\/6/);
});

test('sandbox build selectors apply immediately and expose auto-fire status in the page contract', () => {
  const html = readFileSync(new URL('../sandbox.html', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/sandbox-page.js', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /id="apply-build"/);
  assert.match(html, /id="auto-weapon-status"/);
  assert.match(page, /weaponBuildList\.addEventListener\('change',[\s\S]*?applyBuild\(\);[\s\S]*?render\(\);/);
  assert.match(page, /passiveList\.addEventListener\('change',[\s\S]*?applyBuild\(\);[\s\S]*?render\(\);/);
});

test('squid sniper warns before firing and ray bombardment keeps its cast position', () => {
  const squidState = createSandboxState();
  const squid = spawnSandboxEnemy(squidState, 'squidAssassin', { x: squidState.actor.x + 180, y: squidState.actor.y }, { moveSpeed: 0 });
  assert.equal(executeEnemySkill(squidState, squid.instanceId, 'inkGunSnipe').pending, true);
  assert.equal(squidState.projectiles.length, 0);
  stepSandbox(squidState, 0.99);
  stepSandbox(squidState, 0.02);
  assert.equal(squidState.projectiles.length, 1);

  const rayState = createSandboxState();
  const ray = spawnSandboxEnemy(rayState, 'arcTideRay', { x: rayState.actor.x + 200, y: rayState.actor.y }, { moveSpeed: 0 });
  const castPoint = { x: rayState.actor.x, y: rayState.actor.y };
  executeEnemySkill(rayState, ray.instanceId, 'arcTideBombardment');
  rayState.actor.x += 90;
  rayState.actor.y += 30;
  assert.deepEqual({ x: rayState.zones[0].x, y: rayState.zones[0].y }, castPoint);
});

test('mantis ground smash stuns and coral pulse heals nearby allies', () => {
  const state = createSandboxState();
  const mantis = spawnSandboxEnemy(state, 'mantisShrimpBrute', { x: state.actor.x + 40, y: state.actor.y }, { moveSpeed: 0 });
  assert.equal(executeEnemySkill(state, mantis.instanceId, 'groundSmash').pending, true);
  stepSandbox(state, 0.8);
  assert.ok(state.actor.stunnedUntil > state.time);
  assert.ok(state.logs.some((entry) => entry.message.includes('震海重擊')));

  const coral = spawnSandboxEnemy(state, 'coralBackSeahorse', { x: state.actor.x + 40, y: state.actor.y }, { moveSpeed: 0 });
  const ally = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 50, y: state.actor.y }, { moveSpeed: 0, health: 20, maxHealth: 100 });
  executeEnemySkill(state, coral.instanceId, 'coralPulse');
  assert.ok(ally.health > 20);
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

test('sandbox accepts the authored three weapon and three passive slots with 3/2/1 caps', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 3 },
      { id: 'trident', level: 2 },
      { id: 'katana', level: 3 },
    ],
    activeWeaponSlot: 1,
    passives: [
      { id: 'oxygenCirculator', level: 3 },
      { id: 'pressureStabilizer', level: 3 },
      { id: 'abyssalAmplifier', level: 3 },
    ],
  });

  assert.deepEqual(state.build.weapons, [
    { id: 'knife', level: 3 },
    { id: 'trident', level: 2 },
    { id: 'katana', level: 1 },
  ]);
  assert.deepEqual(state.build.passives, [
    { id: 'oxygenCirculator', level: 3 },
    { id: 'pressureStabilizer', level: 2 },
    { id: 'abyssalAmplifier', level: 1 },
  ]);
  assert.equal(state.build.activeWeaponSlot, 1);
  assert.deepEqual(state.actor.activeWeapon, { id: 'trident', level: 2 });
  assert.equal(state.actor.abilities.length, 3);
});

test('sandbox can activate each authored weapon slot instead of only the knife', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 3 },
      { id: 'trident', level: 2 },
      { id: 'katana', level: 1 },
    ],
  });

  [
    [0, 'knife', 3],
    [1, 'trident', 2],
    [2, 'katana', 1],
  ].forEach(([slot, id, level]) => {
    const active = setSandboxActiveWeapon(state, slot);
    assert.deepEqual(active, { id, level });
    assert.equal(state.build.activeWeaponSlot, slot);
    assert.equal(state.build.weaponId, id);
    assert.equal(state.build.weaponLevel, level);
    assert.deepEqual(state.actor.activeWeapon, { id, level });
  });
});

test('sandbox knife path damage follows the equipped build instead of the focused weapon slot', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 1 },
      { id: 'lightMachineGun', level: 2 },
    ],
    activeWeaponSlot: 1,
  });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 36, y: state.actor.y }, { moveSpeed: 0, health: 1000, maxHealth: 1000 });
  state.actor.vx = 240;
  const healthBefore = enemy.health;

  stepSandbox(state, 0.2);

  assert.ok(enemy.health < healthBefore, '焦點在機槍時，已裝備的小刀仍應造成移動路徑傷害');
  assert.ok(state.actor.vx > 0, '小刀是穿透傷害，不能把玩家反彈回去');
});

test('sandbox direct weapon test fires every equipped slot together', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 3 },
      { id: 'trident', level: 2 },
      { id: 'katana', level: 1 },
    ],
  });

  const result = playerAttackAllWeapons(state);

  assert.equal(result.ok, true);
  assert.deepEqual(result.firedWeaponIds, ['knife', 'trident', 'katana']);
  assert.equal(state.projectiles.filter((projectile) => projectile.weaponId === 'trident').length, 1);
  assert.ok(state.effects.some((effect) => effect.type === 'playerSlash' && effect.style === 'knifeMeteor'));
  assert.ok(state.effects.some((effect) => effect.type === 'katanaSwing'));
});

test('sandbox can start with an empty build and use any weapon in the main slot', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weapons: [], passives: [], activeWeaponSlot: 0, allowEmpty: true });

  assert.deepEqual(state.build.weapons, []);
  assert.deepEqual(state.build.passives, []);
  assert.equal(state.build.weaponId, null);
  assert.equal(playerAttackAllWeapons(state).reason, 'noWeapon');

  setSandboxBuild(state, { weapons: [{ id: 'trident', level: 2 }], allowEmpty: true });
  assert.deepEqual(state.build.weapons, [{ id: 'trident', level: 2 }]);
  assert.equal(state.build.weaponId, 'trident');
  assert.deepEqual(setSandboxActiveWeapon(state, 0), { id: 'trident', level: 2 });
});

test('equipped trident and katana auto-fire without changing the focused slot', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 3 },
      { id: 'trident', level: 2 },
      { id: 'katana', level: 1 },
    ],
    activeWeaponSlot: 0,
  });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', {
    x: state.actor.x + 40,
    y: state.actor.y,
  }, { health: 1000, maxHealth: 1000, moveSpeed: 0 });

  stepSandbox(state, 0.1);
  assert.ok(state.effects.some((effect) => effect.type === 'katanaSwing'), '副副槽武士刀應在近距離自動揮擊');
  assert.equal(state.build.activeWeaponSlot, 0);

  for (let index = 0; index < 10; index += 1) stepSandbox(state, 0.1);
  assert.ok(state.logs.some((entry) => entry.message.includes('自動發動 三叉戟')), '副槽三叉戟應在靜止一秒後自動發射');
  assert.ok(enemy.health < enemy.maxHealth);
  assert.equal(state.build.activeWeaponSlot, 0);
});

test('knife visual data keeps the Lv.3 linger within a low-cost glow budget', () => {
  const lv3 = getWeaponStats('knife', 3).effect;
  assert.ok(lv3.glowBlur <= 8);
  assert.ok(lv3.sideGlowBlur <= 4);
  assert.ok(lv3.sparkleBudget <= 6);
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
