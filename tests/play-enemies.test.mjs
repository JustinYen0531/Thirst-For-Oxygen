import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DESCENT_CORE_ENEMIES,
  DESCENT_ELITE_ENEMIES,
  DESCENT_ENEMY_ROSTER,
  DESCENT_LV1_ENEMIES,
  PLAY_ENEMY_RENDER_SCALE,
  PLAY_SPECIAL_ENEMY_IDS,
  PLAY_ENEMY_ACTIVATION_RADIUS,
  PLAY_ENEMY_SPAWN_SAFE_RADIUS,
  PLAY_ENEMY_TARGETS,
  PLAY_ENEMY_VISUALS,
  createPlayEnemies,
  getPlayEnemyRenderState,
  getPlayEnemyPose,
  isPlayEnemyVisible,
  updatePlayEnemies,
} from '../src/play-enemies.js';
import { ENEMY_DEFINITIONS } from '../src/game-data.js';
import { getHexCenter } from '../src/map-model.js';

const PART_MAP_PATHS = [
  '../maps/下沉篇/下沉篇-第1部分.json',
  '../maps/下沉篇/下沉篇-第2部分.json',
  '../maps/下沉篇/下沉篇-第3部分.json',
];

function readMap(relativePath) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'));
}

const regularEnemies = (enemies) => enemies.filter((enemy) => enemy.markerKind === 'enemySpawn');

function authoredEnemy(enemyId, overrides = {}) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  return {
    instanceId: overrides.instanceId ?? `test-${enemyId}`,
    enemyId,
    name: definition.name,
    tier: definition.tier,
    x: 0,
    y: 0,
    homeX: 0,
    homeY: 0,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    moveSpeed: definition.moveSpeed ?? 0,
    vx: 0,
    vy: 0,
    radius: 12,
    state: 'idle',
    facing: 'right',
    alerted: false,
    cooldowns: {},
    nextSkillIndex: 0,
    pendingSkill: null,
    suicideCharge: null,
    stunnedUntil: 0,
    linkedTargets: [],
    linkedTarget: null,
    linkedProtection: null,
    rescueCompleted: false,
    defeated: false,
    ...overrides,
  };
}

function advanceCombat(enemies, actor, seconds, { start = 0, step = 1 / 60, onDamage = null } = {}) {
  let now = start;
  const end = start + seconds;
  while (now + 1e-9 < end) {
    const dt = Math.min(step, end - now);
    now += dt;
    updatePlayEnemies(enemies, actor, dt, now, onDamage);
  }
  return now;
}

test('all descent map parts distribute the required population with sparse authored clusters', () => {
  const allEnemyIds = new Set();
  PART_MAP_PATHS.forEach((relativePath, index) => {
    const part = index + 1;
    const enemies = regularEnemies(createPlayEnemies(readMap(relativePath), part, 'chapter1', { x: 36, y: 36 }));
    assert.equal(enemies.length, PLAY_ENEMY_TARGETS[part], `Part ${part} should keep its authored regular population`);
    assert.equal(new Set(enemies.map((enemy) => enemy.spawnCellKey)).size, enemies.length, `Part ${part} should spread enemies across distinct water cells`);
    assert.equal(enemies.filter((enemy) => enemy.spawnPattern === 'cluster').length, Math.floor(enemies.length * .2), `Part ${part} should reserve only a small share for local clusters`);
    enemies.forEach((enemy) => {
      assert.equal(DESCENT_ENEMY_ROSTER.includes(enemy.enemyId), true, `${enemy.enemyId} must belong to Chapter 1: Descent`);
      allEnemyIds.add(enemy.enemyId);
    });
  });
  assert.deepEqual(new Set(DESCENT_ENEMY_ROSTER), allEnemyIds, 'the three descent parts should use the complete documented nine-enemy roster');
});

test('enemy instance IDs remain unique when combat state survives a map-part transition', () => {
  const idsByPart = PART_MAP_PATHS.map((relativePath, index) => new Set(
    createPlayEnemies(readMap(relativePath), index + 1, 'chapter1', { x: 36, y: 36 })
      .map((enemy) => enemy.instanceId),
  ));
  const allIds = idsByPart.flatMap((ids) => [...ids]);
  assert.equal(new Set(allIds).size, allIds.length);
  idsByPart.forEach((ids, index) => {
    assert.ok([...ids].every((id) => id.startsWith(`map-part-${index + 1}-`)));
  });
});

test('enemy distribution protects the player start and covers the map instead of stacking at anchors', () => {
  PART_MAP_PATHS.forEach((relativePath, index) => {
    const map = readMap(relativePath);
    const origin = { x: 36, y: 36 };
    const enemies = regularEnemies(createPlayEnemies(map, index + 1, 'chapter1', origin));
    const startCell = Object.values(map.cells).find((cell) => cell.actors?.some((actor) => actor.kind === 'playerStart'));
    const start = getHexCenter(startCell, origin);
    assert.ok(enemies.every((enemy) => Math.hypot(enemy.x - start.x, enemy.y - start.y) >= PLAY_ENEMY_SPAWN_SAFE_RADIUS), `Part ${index + 1} should keep a safe opening around the player`);

    const rows = enemies.map((enemy) => map.cells[enemy.spawnCellKey].r);
    const minimum = Math.min(...rows);
    const maximum = Math.max(...rows);
    const coveredBands = new Set(rows.map((row) => Math.min(3, Math.floor((row - minimum) / Math.max(1, maximum - minimum + 1) * 4))));
    assert.equal(coveredBands.size, 4, `Part ${index + 1} should distribute enemies throughout the playable length`);
  });
});

test('enemy progression follows the configuration document instead of a made-up tier per map', () => {
  const part1 = regularEnemies(createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 }));
  const part2 = regularEnemies(createPlayEnemies(readMap(PART_MAP_PATHS[1]), 2, 'chapter1', { x: 36, y: 36 }));
  const part3 = regularEnemies(createPlayEnemies(readMap(PART_MAP_PATHS[2]), 3, 'chapter1', { x: 36, y: 36 }));
  const firstPart1Anchors = [...new Set(part1.map((enemy) => enemy.anchorCellKey))].slice(0, 3);

  assert.ok(part1.filter((enemy) => firstPart1Anchors.includes(enemy.anchorCellKey)).every((enemy) => DESCENT_LV1_ENEMIES.includes(enemy.enemyId)), 'Part 1 should establish both Lv.1 enemies first');
  assert.ok(DESCENT_CORE_ENEMIES.every((enemyId) => part1.some((enemy) => enemy.enemyId === enemyId)), 'Part 1 should transition into the complete four-enemy core pool');
  assert.ok(DESCENT_CORE_ENEMIES.every((enemyId) => part2.some((enemy) => enemy.enemyId === enemyId)), 'Part 2 should keep the complete core pool');
  assert.ok(DESCENT_ELITE_ENEMIES.every((enemyId) => part2.some((enemy) => enemy.enemyId === enemyId)), 'Part 2 should introduce all three descent elites');
  assert.ok(DESCENT_ELITE_ENEMIES.every((enemyId) => part3.some((enemy) => enemy.enemyId === enemyId)), 'Part 3 should retain all three descent elites');
  assert.ok([...part1, ...part2, ...part3].every((enemy) => !['splitLanternfish', 'coralBackSeahorse', 'mutantMantisShrimp', 'mutantNautilusOracle', 'mutantArcTideRay'].includes(enemy.enemyId)), 'Chapter 2-only enemies must not leak into descent maps');
});

test('explicit markers can select a documented descent enemy but cannot inject another chapter or a Boss', () => {
  const map = readMap(PART_MAP_PATHS[1]);
  const markers = Object.values(map.cells).flatMap((cell) => cell.actors ?? []).filter((actor) => actor.kind === 'enemySpawn');
  markers[0].enemyId = 'lionfishGunner';
  markers[1].enemyId = 'splitLanternfish';
  const enemies = regularEnemies(createPlayEnemies(map, 2, 'chapter1', { x: 36, y: 36 }));
  const anchors = [...new Set(enemies.map((enemy) => enemy.anchorCellKey))];

  assert.ok(enemies.filter((enemy) => enemy.anchorCellKey === anchors[0]).every((enemy) => enemy.enemyId === 'lionfishGunner'));
  assert.ok(enemies.filter((enemy) => enemy.anchorCellKey === anchors[1]).every((enemy) => enemy.enemyId !== 'splitLanternfish'));
});

test('all nine regular descent visuals exist and enemy display size is at least doubled', () => {
  DESCENT_ENEMY_ROSTER.forEach((enemyId) => {
    const source = PLAY_ENEMY_VISUALS[enemyId];
    assert.ok(source, `${enemyId} should have a play visual`);
    const assetPath = fileURLToPath(new URL(`../public${source}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${enemyId} visual should exist at ${source}`);
  });
  assert.deepEqual(new Set(Object.keys(PLAY_ENEMY_VISUALS)), new Set([...DESCENT_ENEMY_ROSTER, ...PLAY_SPECIAL_ENEMY_IDS]));
  assert.equal(PLAY_ENEMY_RENDER_SCALE >= 2, true);

  const enemies = createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 });
  enemies.forEach((enemy) => {
    assert.ok(enemy.renderSize >= (12 + enemy.tier * 1.8) * 2);
    assert.ok(enemy.radius >= (4.5 + enemy.tier * 0.65) * 2);
  });

  const enemy = { x: 100, y: 200, phase: 0, renderSize: 36 };
  const first = getPlayEnemyPose(enemy, 0);
  const later = getPlayEnemyPose(enemy, 1.5);
  assert.equal(enemy.renderSize, 36);
  assert.notDeepEqual(first, later);
  assert.equal(isPlayEnemyVisible(enemy, { x: 80, y: 160 }, { width: 100, height: 100 }), true);
  assert.equal(isPlayEnemyVisible(enemy, { x: 400, y: 400 }, { width: 100, height: 100 }), false);
});

test('special map markers instantiate the documented Mini Bosses and Boss without reducing regular populations', () => {
  const expectedSpecials = [
    [],
    [['miniBossSpawn', 'prismCrabGuardian']],
    [['miniBossSpawn', 'tideLawNautilus'], ['bossSpawn', 'abyssalSpermWhale']],
  ];
  PART_MAP_PATHS.forEach((relativePath, index) => {
    const map = readMap(relativePath);
    const enemies = createPlayEnemies(map, index + 1, 'chapter1', { x: 36, y: 36 });
    assert.equal(regularEnemies(enemies).length, PLAY_ENEMY_TARGETS[index + 1]);
    const specials = enemies.filter((enemy) => enemy.markerKind !== 'enemySpawn');
    assert.deepEqual(specials.map((enemy) => [enemy.markerKind, enemy.enemyId]), expectedSpecials[index]);
    specials.forEach((enemy) => {
      assert.equal(enemy.spawnPattern, 'special');
      assert.equal(enemy.anchorCellKey, enemy.spawnCellKey);
      assert.ok(Number.isFinite(enemy.radius) && Number.isFinite(enemy.renderSize));
      if (enemy.visual) {
        assert.equal(existsSync(fileURLToPath(new URL(`../public${enemy.visual}`, import.meta.url))), true);
      }
    });
  });
  assert.equal(PLAY_ENEMY_VISUALS.abyssalSpermWhale, null, 'Boss art is honestly absent instead of borrowing another enemy asset');
});

test('play enemies chase the actor and expose a real damage callback', () => {
  const enemies = createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 });
  const enemy = enemies.find((candidate) => candidate.enemyId === 'crabGuard');
  assert.ok(enemy);
  const actor = { x: enemy.x - 120, y: enemy.y, radius: 6, health: 100, dead: false, invulnerability: 0 };
  const startX = enemy.x;
  let damage = 0;
  for (let index = 0; index < 180; index += 1) updatePlayEnemies([enemy], actor, 1 / 60, index / 60, (amount) => { damage += amount; });

  assert.ok(enemy.x < startX, 'the real play enemy should track the actor');
  assert.ok(damage > 0, 'the real play enemy should eventually call the player damage path');
  assert.ok(['chasing', 'casting', 'attacking'].includes(enemy.state));
});

test('physical overlap is harmless until an enemy skill finishes its cast', () => {
  const enemies = createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 });
  const enemy = enemies.find((candidate) => candidate.enemyId === 'crabGuard');
  const actor = { x: enemy.x, y: enemy.y, radius: 6, health: 100, dead: false, invulnerability: 0 };
  let damage = 0;

  updatePlayEnemies([enemy], actor, 1 / 60, 0, (amount) => { damage += amount; });
  assert.equal(damage, 0, 'touching an enemy body must not deal collision damage');
  assert.equal(enemy.state, 'casting', 'the enemy should visibly enter a skill cast first');
  for (let index = 1; index <= 30; index += 1) updatePlayEnemies([enemy], actor, 1 / 60, index / 60, (amount) => { damage += amount; });
  assert.ok(damage > 0, 'damage should occur only after the skill cast resolves');
});

test('distant enemies remain dormant instead of converging on the player spawn', () => {
  const enemies = createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 });
  const enemy = enemies.find((candidate) => candidate.enemyId === 'crabGuard');
  const actor = { x: enemy.x + PLAY_ENEMY_ACTIVATION_RADIUS + 80, y: enemy.y, radius: 6, health: 100, dead: false, invulnerability: 0 };
  const start = { x: enemy.x, y: enemy.y };
  let damage = 0;
  for (let index = 0; index < 180; index += 1) updatePlayEnemies([enemy], actor, 1 / 60, index / 60, (amount) => { damage += amount; });

  assert.deepEqual({ x: enemy.x, y: enemy.y }, start);
  assert.equal(enemy.state, 'idle');
  assert.equal(damage, 0);
});

test('stunnedUntil pauses movement, cooldowns, and an active cast until the stun expires', () => {
  const enemy = authoredEnemy('crabGuard', {
    alerted: true,
    x: 40,
    pendingSkill: { skillId: 'clawSwipe', remaining: 0.3, targetX: 0, targetY: 0 },
    cooldowns: { clawSwipe: 0.8 },
    stunnedUntil: 1,
  });
  const actor = { x: 0, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  let damage = 0;

  updatePlayEnemies([enemy], actor, 0.5, 0.5, (amount) => { damage += amount; });
  assert.equal(enemy.state, 'stunned');
  assert.equal(enemy.pendingSkill.remaining, 0.3);
  assert.equal(enemy.cooldowns.clawSwipe, 0.8);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, { x: 40, y: 0 });
  assert.equal(damage, 0);

  updatePlayEnemies([enemy], actor, 0.1, 1.1, (amount) => { damage += amount; });
  assert.equal(enemy.stunnedUntil, 0);
  assert.ok(enemy.pendingSkill.remaining < 0.3, 'the cast resumes only after the stun deadline');
});

test('lanternfish locks one destination, reaches it, then waits one second before exploding there', () => {
  const enemy = authoredEnemy('explodingLanternfish');
  const enemies = [enemy];
  const actor = { x: 90, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  let damage = 0;
  let now = advanceCombat(enemies, actor, 1 / 60, { onDamage: (amount) => { damage += amount; } });
  assert.equal(enemy.suicideCharge.targetX, 90);
  actor.x = 280;

  while (enemy.suicideCharge?.phase === 'seeking' && now < 3) {
    now = advanceCombat(enemies, actor, 1 / 60, { start: now, onDamage: (amount) => { damage += amount; } });
  }
  assert.equal(enemy.suicideCharge.phase, 'detonating');
  assert.equal(enemy.x, 90);
  assert.equal(enemy.suicideCharge.targetX, 90, 'moving the player cannot move the locked destination');
  now = advanceCombat(enemies, actor, 0.9, { start: now, onDamage: (amount) => { damage += amount; } });
  assert.equal(enemy.defeated, false);
  now = advanceCombat(enemies, actor, 0.12, { start: now, onDamage: (amount) => { damage += amount; } });
  assert.equal(enemy.defeated, true);
  assert.equal(damage, 0, 'the explosion checks the locked point instead of following the player');
  const render = getPlayEnemyRenderState(enemies, now);
  assert.ok(render.effects.some((effect) => effect.type === 'detonation' && effect.x === 90));
});

test('formal enemy projectiles exist in flight and use swept collision instead of remote instant damage', () => {
  const enemy = authoredEnemy('lobsterSoldier');
  const enemies = [enemy];
  const actor = { x: 150, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  let damage = 0;
  const onDamage = (amount) => { damage += amount; };
  let now = advanceCombat(enemies, actor, 0.36, { onDamage });
  let render = getPlayEnemyRenderState(enemies, now);
  assert.equal(damage, 0);
  assert.equal(render.projectiles.length, 1, 'resolving the cast creates a renderable projectile first');
  assert.ok(render.projectiles[0].x < actor.x);

  now = advanceCombat(enemies, actor, 0.2, { start: now, onDamage });
  assert.equal(damage, 0, 'the projectile cannot damage before it reaches the actor');
  updatePlayEnemies(enemies, actor, 1, now + 1, onDamage);
  render = getPlayEnemyRenderState(enemies, now + 1);
  assert.equal(damage, 24, 'a large fixed step still detects the swept crossing');
  assert.equal(render.projectiles.length, 0);
});

test('juvenile seahorse finishes its six-second rescue cast before adding two core enemies', () => {
  const caller = authoredEnemy('juvenileSeahorseCaller');
  const enemies = [caller];
  const actor = { x: 100, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  let now = advanceCombat(enemies, actor, 5.9);
  assert.equal(enemies.length, 1);
  assert.equal(caller.pendingSkill?.skillId, 'callForHelp');
  now = advanceCombat(enemies, actor, 0.2, { start: now });
  assert.equal(enemies.length, 3);
  assert.equal(caller.rescueCompleted, true);
  const summons = enemies.slice(1);
  assert.ok(summons.every((enemy) => DESCENT_CORE_ENEMIES.includes(enemy.enemyId)));
  assert.ok(summons.every((enemy) => enemy.summonedBy === caller.instanceId));
  assert.ok(getPlayEnemyRenderState(enemies, now).effects.some((effect) => effect.type === 'summon'));
});

test('coral-back seahorse exposes life links, continuous healing, and its support pulse', () => {
  const coral = authoredEnemy('coralBackSeahorse', {
    health: 100,
    cooldowns: { coralPulse: 5 },
  });
  const ally = authoredEnemy('crabGuard', {
    instanceId: 'linked-crab',
    x: 30,
    health: 100,
    maxHealth: 200,
  });
  const enemies = [coral, ally];
  const actor = { x: 80, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };

  updatePlayEnemies(enemies, actor, 1, 1);
  assert.deepEqual(coral.linkedTargets, [ally.instanceId]);
  assert.equal(ally.linkedProtection, coral.instanceId);
  assert.equal(ally.health, 106);
  assert.equal(coral.health, 106);
  let render = getPlayEnemyRenderState(enemies, 1);
  assert.deepEqual(render.enemies.find((entry) => entry.instanceId === coral.instanceId).linkedTargets, [ally.instanceId]);

  coral.cooldowns.coralPulse = 0;
  updatePlayEnemies(enemies, actor, 0.01, 1.01);
  render = getPlayEnemyRenderState(enemies, 1.01);
  assert.ok(render.effects.some((effect) => effect.type === 'supportPulse'));
  assert.ok(ally.health > 106, 'the authored pulse adds a visible nearby heal');
});

test('unsupported Mini Boss and Boss skills expose safe render cues without unavoidable remote damage', () => {
  const miniBoss = authoredEnemy('prismCrabGuardian', { instanceId: 'mini-boss' });
  const boss = authoredEnemy('abyssalSpermWhale', { instanceId: 'boss', x: 20 });
  const enemies = [miniBoss, boss];
  const actor = { x: 100, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  let damage = 0;
  const now = advanceCombat(enemies, actor, 0.4, { onDamage: (amount) => { damage += amount; } });
  const render = getPlayEnemyRenderState(enemies, now);

  assert.equal(damage, 0);
  assert.equal(actor.health, 100);
  assert.ok(render.effects.filter((effect) => effect.type === 'unsupportedSkill' && effect.damageSuppressed).length >= 2);
  assert.ok(render.enemies.every((enemy) => enemy.lastResolvedSkill?.supported === false));
});
