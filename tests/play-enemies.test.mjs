import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  PLAY_ENEMY_ACTION_VISUAL_HOLD,
  PLAY_ENEMY_ANIMATED_ASSET_PATHS,
  PLAY_ENEMY_ASSET_PATHS,
  PLAY_ENEMY_FRAME_COUNT,
  PLAY_ENEMY_FRAME_DURATION,
  PLAY_ENEMY_VISUAL_SETS,
  PLAY_ENEMY_VISUALS,
  createPlayEnemies,
  getReachablePlayCellKeys,
  getPlayEnemyFramePaths,
  getPlayEnemyFrameState,
  getPlayEnemyRenderState,
  getPlayEnemyPose,
  getPlayEnemyVisualState,
  isPlayEnemyVisible,
  updatePlayEnemies,
} from '../src/play-enemies.js';
import { ENEMY_DAMAGE_BALANCE, ENEMY_DEFINITIONS, getEnemyDamageToPlayer } from '../src/game-data.js';
import { createEmptyMap, getHexCenter } from '../src/map-model.js';

const PART_MAP_PATHS = [
  '../maps/下沉篇/下沉篇-第1部分.json',
  '../maps/下沉篇/下沉篇-第2部分.json',
  '../maps/下沉篇/下沉篇-第3部分.json',
];
const ASCENT_MAP_PATHS = [
  '../maps/上升篇/上升篇-第1部分.json',
  '../maps/上升篇/上升篇-第2部分.json',
  '../maps/上升篇/上升篇-第3部分.json',
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
    visualAction: null,
    visualActionSequence: 0,
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

function resolveAuthoredSkill(enemyId, skillId, actorOverrides = {}) {
  const enemy = authoredEnemy(enemyId, { alerted: true });
  const definition = ENEMY_DEFINITIONS[enemyId];
  const skillIndex = definition.attacks.findIndex((skill) => skill.id === skillId);
  assert.ok(skillIndex >= 0, `${enemyId} must author ${skillId}`);
  enemy.nextSkillIndex = skillIndex;
  definition.attacks.forEach((skill) => { enemy.cooldowns[skill.id] = skill.id === skillId ? 0 : 999; });
  const actor = {
    x: 100,
    y: 0,
    radius: 6,
    health: 100,
    oxygen: 100,
    energy: 100,
    dead: false,
    invulnerability: 0,
    vx: 0,
    vy: 0,
    ...actorOverrides,
  };
  const enemies = [enemy];
  let damage = 0;
  const onDamage = (amount) => { damage += amount; };
  let now = advanceCombat(enemies, actor, 1 / 60, { onDamage });
  if (enemy.pendingSkill) now = advanceCombat(enemies, actor, enemy.pendingSkill.remaining + 1e-6, { start: now, onDamage });
  return { actor, damage: () => damage, enemies, enemy, now, onDamage, render: () => getPlayEnemyRenderState(enemies, now) };
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

test('ascent maps use their authored buffed enemy populations', () => {
  const populations = ASCENT_MAP_PATHS.map((relativePath, index) => {
    const map = readMap(relativePath);
    const enemies = regularEnemies(createPlayEnemies(map, index + 1, 'chapter1', { x: 36, y: 36 }));
    assert.equal(enemies.length, map.metadata.enemyTargetCount, `Ascent Part ${index + 1} should use its stronger population`);
    assert.equal(new Set(enemies.map((enemy) => enemy.spawnCellKey)).size, enemies.length);
    return enemies.length;
  });
  assert.deepEqual(populations, [48, 56, 64]);
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

test('every regular runtime spawn is reachable through gates, layer transitions, or paired portals', () => {
  PART_MAP_PATHS.forEach((relativePath, index) => {
    const map = readMap(relativePath);
    const reachable = getReachablePlayCellKeys(map, 'chapter1');
    const enemies = regularEnemies(createPlayEnemies(map, index + 1, 'chapter1', { x: 36, y: 36 }));
    assert.ok(enemies.every((enemy) => reachable.has(enemy.spawnCellKey)), `Part ${index + 1} must not silently spawn enemies in unreachable water`);
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

test('movement loops idle art and each authored skill selects its exact attack animation', () => {
  const formalEnemyIds = [...DESCENT_ENEMY_ROSTER, ...PLAY_SPECIAL_ENEMY_IDS];
  formalEnemyIds.forEach((enemyId) => {
    const visualSet = PLAY_ENEMY_VISUAL_SETS[enemyId];
    assert.ok(visualSet?.idle, `${enemyId} should expose a natural-floating loop`);
    assert.equal(PLAY_ENEMY_VISUALS[enemyId], visualSet.idle);
    assert.equal(PLAY_ENEMY_ANIMATED_ASSET_PATHS.includes(visualSet.idle), true);
    assert.equal(existsSync(fileURLToPath(new URL(`../public${visualSet.idle}`, import.meta.url))), true);
    ENEMY_DEFINITIONS[enemyId].attacks.forEach((skill) => {
      const actionPath = visualSet.actions[skill.id];
      assert.ok(actionPath, `${enemyId}.${skill.id} should select its own animation`);
      assert.equal(PLAY_ENEMY_ANIMATED_ASSET_PATHS.includes(actionPath), true);
      assert.equal(existsSync(fileURLToPath(new URL(`../public${actionPath}`, import.meta.url))), true);
    });
  });

  const moving = authoredEnemy('crabGuard', { state: 'chasing', vx: 24 });
  assert.deepEqual(getPlayEnemyVisualState(moving, 2), {
    path: PLAY_ENEMY_VISUAL_SETS.crabGuard.idle,
    mode: 'idle',
    actionId: null,
    playbackKey: 'test-crabGuard:idle',
  });
});

test('formal rendering advances six distinct static frames instead of trusting animated image decoding', () => {
  assert.equal(PLAY_ENEMY_FRAME_COUNT, 6);
  assert.equal(PLAY_ENEMY_ASSET_PATHS.length, PLAY_ENEMY_ANIMATED_ASSET_PATHS.length * PLAY_ENEMY_FRAME_COUNT);
  PLAY_ENEMY_ANIMATED_ASSET_PATHS.forEach((animatedPath) => {
    const framePaths = getPlayEnemyFramePaths(animatedPath);
    assert.equal(framePaths.length, PLAY_ENEMY_FRAME_COUNT);
    const hashes = framePaths.map((framePath) => {
      const absolutePath = fileURLToPath(new URL(`../public${framePath}`, import.meta.url));
      assert.equal(existsSync(absolutePath), true, `${framePath} should be a real runtime frame`);
      return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
    });
    assert.ok(new Set(hashes).size > 1, `${animatedPath} must visibly change across its extracted frames`);
  });

  const moving = authoredEnemy('crabGuard', { state: 'chasing', vx: 24, phase: 0 });
  const first = getPlayEnemyFrameState(moving, 0);
  const second = getPlayEnemyFrameState(moving, PLAY_ENEMY_FRAME_DURATION);
  assert.equal(first.mode, 'idle');
  assert.equal(first.frameIndex, 0);
  assert.equal(second.frameIndex, 1);
  assert.notEqual(first.path, second.path);
  assert.match(first.path, /\/assets\/enemy-frames\/crabGuard\/base-float-move\/01\.png$/);
});

test('a skill animation starts with its cast, survives resolution, then returns to idle', () => {
  const enemy = authoredEnemy('crabGuard', { alerted: true });
  const actor = { x: 0, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };

  updatePlayEnemies([enemy], actor, 1 / 60, 0);
  assert.equal(enemy.pendingSkill?.skillId, 'clawSwipe');
  const castingVisual = getPlayEnemyVisualState(enemy, 0);
  const castingFrame = getPlayEnemyFrameState(enemy, 0);
  assert.equal(castingVisual.mode, 'action');
  assert.equal(castingVisual.actionId, 'clawSwipe');
  assert.equal(castingVisual.path, PLAY_ENEMY_VISUAL_SETS.crabGuard.actions.clawSwipe);
  assert.equal(castingFrame.frameIndex, 0);
  assert.match(castingFrame.path, /\/assets\/enemy-frames\/crabGuard\/attack-claw-swing\/01\.png$/);

  updatePlayEnemies([enemy], actor, 0.5, 0.5);
  const resolvedVisual = getPlayEnemyVisualState(enemy, 0.5);
  assert.equal(enemy.lastResolvedSkill?.skillId, 'clawSwipe');
  assert.equal(resolvedVisual.path, castingVisual.path);
  assert.equal(resolvedVisual.playbackKey, castingVisual.playbackKey, 'resolution must continue the same playback instead of restarting mid-swing');

  const idleVisual = getPlayEnemyVisualState(enemy, 0.5 + PLAY_ENEMY_ACTION_VISUAL_HOLD + 0.01);
  assert.equal(idleVisual.mode, 'idle');
  assert.equal(idleVisual.path, PLAY_ENEMY_VISUAL_SETS.crabGuard.idle);
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
  assert.equal(
    PLAY_ENEMY_VISUALS.abyssalSpermWhale,
    '/assets/enemies-afterimage/abyssalSpermWhale/reconstructed-preview__base-float-move.webp',
    'the Final Boss should use its own authored idle art instead of borrowing another enemy asset',
  );
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

test('worldless diagnostics keep distant enemies dormant instead of inventing a route', () => {
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

test('mobile wildlife roams near home without converging when the diver is far away', () => {
  const map = createEmptyMap({ width: 9, height: 9 });
  const origin = { x: 0, y: 0 };
  const start = getHexCenter(map.cells['4,4'], origin);
  const enemy = authoredEnemy('lionfishGunner', {
    x: start.x,
    y: start.y,
    homeX: start.x,
    homeY: start.y,
    alerted: false,
  });
  const actor = { x: start.x + PLAY_ENEMY_ACTIVATION_RADIUS * 2, y: start.y, radius: 6, health: 100, dead: false, invulnerability: 0 };
  for (let index = 0; index < 180; index += 1) {
    updatePlayEnemies([enemy], actor, 1 / 60, (index + 1) / 60, null, null, { map, chapter: 'chapter1', origin });
  }

  assert.ok(Math.hypot(enemy.x - start.x, enemy.y - start.y) > 12, 'wildlife should visibly roam instead of freezing at its spawn point');
  assert.ok(Math.hypot(enemy.x - start.x, enemy.y - start.y) < 180, 'home roaming must remain local instead of tracking a distant diver');
  assert.equal(enemy.movementGoal?.mode, 'home');
  assert.ok(['roaming', 'loitering'].includes(enemy.state));
});

test('seahorse-summoned ranged wildlife leaves a cramped bottom edge for open water', () => {
  const map = createEmptyMap({ width: 9, height: 9 });
  const origin = { x: 0, y: 0 };
  const start = getHexCenter(map.cells['4,8'], origin);
  const enemy = authoredEnemy('lionfishGunner', {
    instanceId: 'play-summon-seahorse-lionfish',
    summonedBy: 'juvenile-seahorse',
    x: start.x,
    y: start.y,
    homeX: start.x,
    homeY: start.y,
    alerted: true,
  });
  ENEMY_DEFINITIONS.lionfishGunner.attacks.forEach((skill) => { enemy.cooldowns[skill.id] = 999; });
  const actor = { x: start.x - 100, y: start.y, radius: 6, health: 100, dead: false, invulnerability: 0 };
  for (let index = 0; index < 300; index += 1) {
    updatePlayEnemies([enemy], actor, 1 / 60, (index + 1) / 60, null, null, { map, chapter: 'chapter1', origin });
  }

  assert.ok(enemy.y < start.y - 24, 'the summoned gunner should leave the bottom boundary instead of camping there');
  assert.equal(enemy.movementGoal?.mode, 'combat');
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
  assert.equal(render.projectiles[0].speed, 65, 'enemy projectile speed is twenty-five percent of the authored spear speed');
  assert.ok(render.projectiles[0].x < actor.x);

  now = advanceCombat(enemies, actor, 0.2, { start: now, onDamage });
  assert.equal(damage, 0, 'the projectile cannot damage before it reaches the actor');
  updatePlayEnemies(enemies, actor, 3, now + 3, onDamage);
  render = getPlayEnemyRenderState(enemies, now + 3);
  assert.equal(ENEMY_DAMAGE_BALANCE.playerDamageMultiplier, 0.4);
  assert.equal(damage, getEnemyDamageToPlayer(24, 'projectile'), 'a swept hit applies the projectile-specific ten percent final damage');
  assert.equal(render.projectiles.length, 0);
});

test('lionfish poison needle is twice as fast as its five-shot non-poison scatter', () => {
  const poison = resolveAuthoredSkill('lionfishGunner', 'venomStraightShot');
  const scatter = resolveAuthoredSkill('lionfishGunner', 'spineScatter');
  const poisonProjectiles = poison.render().projectiles;
  const scatterProjectiles = scatter.render().projectiles;
  const poisonSkill = ENEMY_DEFINITIONS.lionfishGunner.attacks.find((skill) => skill.id === 'venomStraightShot');
  const scatterSkill = ENEMY_DEFINITIONS.lionfishGunner.attacks.find((skill) => skill.id === 'spineScatter');

  assert.equal(poisonProjectiles.length, 1);
  assert.equal(scatterProjectiles.length, 5);
  assert.equal(poisonSkill.projectileSpeed, scatterSkill.projectileSpeed * 2);
  assert.equal(poisonProjectiles[0].speed, scatterProjectiles[0].speed * 2);
  assert.equal(poisonProjectiles[0].applies, 'venom');
  assert.ok(poisonProjectiles[0].damage > scatterProjectiles[0].damage);
  assert.ok(scatterProjectiles.every((projectile) => projectile.applies == null));
});

test('lobbed enemy ordnance uses the same projectile damage reduction', () => {
  const mortar = resolveAuthoredSkill('nautilusOracle', 'coralMortar');
  assert.equal(mortar.damage(), 0, 'the mortar telegraph cannot deal remote instant damage');
  advanceCombat(mortar.enemies, mortar.actor, 0.3, { start: mortar.now, onDamage: mortar.onDamage });
  assert.equal(mortar.damage(), getEnemyDamageToPlayer(30, 'projectile'));
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

test('prism guardian models its Lv.1 summons, exact resource drain, beam, and local gravity field', () => {
  const gathering = resolveAuthoredSkill('prismCrabGuardian', 'tidalGathering');
  let render = getPlayEnemyRenderState(gathering.enemies, gathering.now);
  assert.equal(gathering.damage(), 0, 'summoning never falls back to remote direct damage');
  assert.equal(gathering.actor.energy, 82);
  assert.equal(gathering.actor.oxygen, 88);
  assert.equal(gathering.enemies.length, 4);
  assert.ok(gathering.enemies.slice(1).every((enemy) => DESCENT_LV1_ENEMIES.includes(enemy.enemyId)));
  assert.equal(render.summons[0].count, 3);
  assert.ok(render.effects.some((effect) => effect.type === 'resourceDrain' && effect.energyDrain === 18 && effect.oxygenDrain === 12));

  const laser = resolveAuthoredSkill('prismCrabGuardian', 'refractedLaser');
  render = getPlayEnemyRenderState(laser.enemies, laser.now);
  assert.equal(laser.damage(), 0, 'creating the beam does not remotely hit before simulation advances');
  assert.deepEqual(
    { damagePerSecond: render.zones[0].damagePerSecond, remaining: render.zones[0].remaining, maxReflections: render.zones[0].maxReflections },
    { damagePerSecond: 24, remaining: 3, maxReflections: 4 },
  );
  updatePlayEnemies(laser.enemies, laser.actor, 0.5, laser.now + 0.5, laser.onDamage);
  assert.equal(laser.damage(), getEnemyDamageToPlayer(12), 'the primary beam applies forty percent of its authored damage over time while crossed');

  const gravity = resolveAuthoredSkill('prismCrabGuardian', 'deepSeaGravityField');
  render = getPlayEnemyRenderState(gravity.enemies, gravity.now);
  assert.equal(gravity.damage(), getEnemyDamageToPlayer(20));
  assert.ok(gravity.actor.stunnedUntil > gravity.now + 0.75);
  assert.ok(render.rules.some((rule) => rule.type === 'gravityField'
    && rule.radius === 150
    && rule.duration === 2.5
    && rule.gravityMultiplier === 2.5));
  assert.ok(!render.effects.some((effect) => effect.type === 'unsupportedSkill'));
});

test('tide-law nautilus models four Lv.2 summons, seven returning rounds, and an authored gravity rule', () => {
  const summoning = resolveAuthoredSkill('tideLawNautilus', 'deepSeaSummoning');
  let render = getPlayEnemyRenderState(summoning.enemies, summoning.now);
  assert.equal(summoning.damage(), 0);
  assert.equal(summoning.enemies.length, 5);
  assert.ok(summoning.enemies.slice(1).every((enemy) => DESCENT_CORE_ENEMIES.includes(enemy.enemyId)));
  assert.equal(render.summons[0].count, 4);

  const buckshot = resolveAuthoredSkill('tideLawNautilus', 'returningBuckshot');
  render = getPlayEnemyRenderState(buckshot.enemies, buckshot.now);
  assert.equal(render.projectiles.length, 7);
  assert.ok(render.projectiles.every((projectile) => projectile.speed === 65 && projectile.returnDelay === 1.4 && projectile.damage === 16));
  buckshot.actor.y = 220;
  const returnTime = advanceCombat(buckshot.enemies, buckshot.actor, 1.42, { start: buckshot.now, onDamage: buckshot.onDamage });
  render = getPlayEnemyRenderState(buckshot.enemies, returnTime);
  assert.ok(render.projectiles.some((projectile) => projectile.returning), 'rounds reverse toward their owner after exactly 1.4 seconds');

  const law = resolveAuthoredSkill('tideLawNautilus', 'tidalLaw');
  render = getPlayEnemyRenderState(law.enemies, law.now);
  const rule = render.rules.find((candidate) => candidate.type === 'tidalLaw');
  assert.equal(rule.duration, 4);
  assert.deepEqual(rule.modes, ['reverse', 'low', 'horizontal', 'currentShift']);
  assert.ok(rule.modes.includes(rule.mode));
  assert.ok(!render.effects.some((effect) => effect.type === 'unsupportedSkill'));
});

test('abyssal whale sacrifice summons resolve after thirty seconds using authored heal and damage stacks', () => {
  const result = resolveAuthoredSkill('abyssalSpermWhale', 'abyssalSummoning');
  result.enemy.health = 3000;
  let render = getPlayEnemyRenderState(result.enemies, result.now);
  assert.equal(result.damage(), 0);
  assert.equal(result.enemies.length, 7);
  assert.equal(render.summons[0].count, 6);
  assert.ok(result.enemies.slice(1).every((enemy) => DESCENT_ENEMY_ROSTER.includes(enemy.enemyId)));
  result.actor.x = 1000;
  updatePlayEnemies(result.enemies, result.actor, 30.1, result.now + 30.1, result.onDamage);
  render = getPlayEnemyRenderState(result.enemies, result.now + 30.1);
  assert.equal(render.summons[0].status, 'sacrificed');
  assert.equal(render.summons[0].sacrificedCount, 6);
  assert.equal(result.enemy.health, 3750);
  assert.ok(Math.abs(result.enemy.damageStack - 0.18) < 1e-9);
});

test('abyssal whale reconstruction, echo barrage, and miniature form expose their complete authored state', () => {
  const reconstruction = resolveAuthoredSkill('abyssalSpermWhale', 'ancientReconstruction');
  reconstruction.enemy.health = 3000;
  updatePlayEnemies(reconstruction.enemies, reconstruction.actor, 1, reconstruction.now + 1, reconstruction.onDamage);
  let render = getPlayEnemyRenderState(reconstruction.enemies, reconstruction.now + 1);
  assert.equal(reconstruction.enemy.health, 3100);
  assert.ok(render.rules.some((rule) => rule.type === 'rebuildArena'
    && rule.healPerSecondRatio === 0.02
    && Math.abs(rule.remaining - 7) < 1e-9));

  const echo = resolveAuthoredSkill('abyssalSpermWhale', 'abyssEcho');
  render = getPlayEnemyRenderState(echo.enemies, echo.now);
  assert.equal(echo.damage(), 0);
  assert.equal(render.projectiles.length, 3);
  assert.ok(render.projectiles.every((projectile) => projectile.speed === 42.5 && projectile.damage === 18 && projectile.cloneHealthRatio === 0.18));
  assert.ok(render.summons.some((summon) => summon.kind === 'abyssEcho' && summon.count === 3 && summon.healthEach === 900));

  const miniature = resolveAuthoredSkill('abyssalSpermWhale', 'miniatureForm', { x: 160 });
  render = getPlayEnemyRenderState(miniature.enemies, miniature.now);
  assert.equal(miniature.enemy.damageTakenMultiplier, 1.2);
  assert.ok(render.rules.some((rule) => rule.type === 'speedForm'
    && rule.moveSpeedMultiplier === 1.7
    && rule.cooldownMultiplier === 0.5
    && rule.remaining === 7
    && rule.sludgeDuration === 8));
  updatePlayEnemies(miniature.enemies, miniature.actor, 0.1, miniature.now + 0.1, miniature.onDamage);
  assert.ok(Math.abs(Math.hypot(miniature.enemy.vx, miniature.enemy.vy) - 46 * 1.7) < 1e-9);
  miniature.enemy.nextSkillIndex = ENEMY_DEFINITIONS.abyssalSpermWhale.attacks.findIndex((skill) => skill.id === 'gravityDominion');
  miniature.enemy.cooldowns.gravityDominion = 0;
  updatePlayEnemies(miniature.enemies, miniature.actor, 1 / 60, miniature.now + 0.1 + 1 / 60, miniature.onDamage);
  assert.equal(miniature.enemy.cooldowns.gravityDominion, 7);
});

test('abyssal whale gravity dominion and corrupted oxygen are rule and delayed-zone mechanics, never remote instant hits', () => {
  const gravity = resolveAuthoredSkill('abyssalSpermWhale', 'gravityDominion');
  let render = getPlayEnemyRenderState(gravity.enemies, gravity.now);
  assert.equal(gravity.damage(), 0);
  assert.ok(render.rules.some((rule) => rule.type === 'gravityDominion'
    && rule.duration === 5
    && rule.gravityLevelShift === 1
    && rule.directionToggle
    && rule.damage === 16
    && rule.damageSuppressed));

  const oxygen = resolveAuthoredSkill('abyssalSpermWhale', 'corruptedOxygen');
  render = getPlayEnemyRenderState(oxygen.enemies, oxygen.now);
  assert.equal(oxygen.damage(), 0);
  assert.equal(oxygen.actor.oxygen, 100);
  assert.ok(render.zones.some((zone) => zone.type === 'corruptOxygen'
    && zone.phase === 'bubble'
    && zone.bubbleLifetime === 4
    && zone.radius === 96
    && zone.oxygenDrain === 35
    && zone.oxygenZoneDuration === 10));
  let now = advanceCombat(oxygen.enemies, oxygen.actor, 3.9, { start: oxygen.now, onDamage: oxygen.onDamage });
  assert.equal(oxygen.damage(), 0);
  assert.equal(oxygen.actor.oxygen, 100);
  now = advanceCombat(oxygen.enemies, oxygen.actor, 0.12, { start: now, onDamage: oxygen.onDamage });
  render = getPlayEnemyRenderState(oxygen.enemies, now);
  assert.equal(oxygen.damage(), getEnemyDamageToPlayer(26));
  assert.equal(oxygen.actor.oxygen, 65);
  assert.ok(render.zones.some((zone) => zone.type === 'corruptOxygen' && zone.phase === 'oxygenZone' && zone.remaining > 9.8));
  assert.deepEqual(render.playerResources, { health: 100, oxygen: 65, energy: 100, stunnedUntil: 0 });
  assert.ok(!render.effects.some((effect) => effect.type === 'unsupportedSkill'));
});

test('special-enemy passive state exposes carapace, shield phases, and abyss awakening multipliers', () => {
  const prism = authoredEnemy('prismCrabGuardian');
  const prismActor = { x: 500, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  updatePlayEnemies([prism], prismActor, 1 / 60, 1 / 60);
  assert.equal(prism.passiveState.id, 'deepSeaCarapace');
  assert.equal(prism.damageTakenMultiplier, 0.75);

  const tide = authoredEnemy('tideLawNautilus', { health: 1350 * 0.79 });
  const tideEnemies = [tide];
  updatePlayEnemies(tideEnemies, prismActor, 1 / 60, 1 / 60);
  let render = getPlayEnemyRenderState(tideEnemies, 1 / 60);
  assert.equal(tide.passiveState.triggeredPhases, 1);
  assert.equal(tide.damageTakenMultiplier, 0);
  assert.equal(tide.outgoingDamageMultiplier, 1.3);
  assert.ok(tide.invulnerableUntil >= 7);
  assert.ok(render.effects.some((effect) => effect.type === 'tidalShield' && effect.phase === 1 && effect.phaseCount === 5));
  updatePlayEnemies(tideEnemies, prismActor, 0.1, 7.2);
  assert.equal(tide.damageTakenMultiplier, 1);

  const whale = authoredEnemy('abyssalSpermWhale', { health: 2400, alerted: true });
  const whaleEnemies = [whale];
  const whaleActor = { x: 160, y: 0, radius: 6, health: 100, dead: false, invulnerability: 0, vx: 0, vy: 0 };
  ENEMY_DEFINITIONS.abyssalSpermWhale.attacks.forEach((skill) => { whale.cooldowns[skill.id] = 999; });
  updatePlayEnemies(whaleEnemies, whaleActor, 0.1, 0.1);
  render = getPlayEnemyRenderState(whaleEnemies, 0.1);
  assert.equal(whale.passiveState.enraged, true);
  assert.equal(whale.passiveState.moveSpeedMultiplier, 1.2);
  assert.equal(whale.projectileSpeedMultiplier, 1.2);
  assert.equal(whale.passiveState.cooldownMultiplier, 0.8);
  assert.equal(whale.passiveState.thornsDamage, 18);
  assert.ok(Math.abs(Math.hypot(whale.vx, whale.vy) - 46 * 1.2) < 1e-9);
  assert.ok(render.effects.some((effect) => effect.type === 'abyssAwakening'));
  const echoIndex = ENEMY_DEFINITIONS.abyssalSpermWhale.attacks.findIndex((skill) => skill.id === 'abyssEcho');
  whale.nextSkillIndex = echoIndex;
  whale.cooldowns.abyssEcho = 0;
  updatePlayEnemies(whaleEnemies, whaleActor, 1 / 60, 0.1 + 1 / 60);
  assert.equal(whale.cooldowns.abyssEcho, 8 * 0.8);
  const projectileTime = advanceCombat(whaleEnemies, whaleActor, 0.34, { start: 0.1 + 1 / 60 });
  render = getPlayEnemyRenderState(whaleEnemies, projectileTime);
  assert.ok(render.projectiles.every((projectile) => projectile.speed === 170 * 1.2 * ENEMY_DAMAGE_BALANCE.projectileSpeedMultiplier));
});
