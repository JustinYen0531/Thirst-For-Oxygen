import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createEmptyMap } from '../src/map-model.js';
import {
  createPlayRenderIndex,
  createPlayUpdateGate,
  getVisiblePlayCells,
  getVisiblePlayEdges,
} from '../src/play-performance.js';
import { createTestActor, stepPhysics } from '../src/physics.js';
import { createPlayCombatState, getPlayCombatHudState } from '../src/play-combat.js';
import {
  getPlayEnemyAssetPaths,
  getPlayEnemyRenderState,
  getPlayEnemyRenderView,
  updatePlayEnemies,
} from '../src/play-enemies.js';
import { PLAY_BASE_IMAGE_ASSET_PATHS, PLAY_IMAGE_ASSET_PATHS } from '../src/play-preload.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('the long first map renders only the camera neighbourhood instead of all map cells', () => {
  const map = JSON.parse(readFileSync(`${ROOT}\\maps\\下沉篇\\下沉篇-第1部分.json`, 'utf8'));
  const index = createPlayRenderIndex(map, { x: 36, y: 36 });
  const viewport = { width: 400, height: 225 };
  const camera = { x: 0, y: 900 };
  const visibleCells = getVisiblePlayCells(index, camera, viewport);
  const visibleEdges = getVisiblePlayEdges(index, camera, viewport);

  assert.equal(index.cells.length, Object.keys(map.cells).length);
  assert.ok(visibleCells.length > 0);
  assert.ok(visibleCells.length < index.cells.length * 0.15);
  assert.ok(visibleEdges.length > 0);
  assert.ok(visibleEdges.length < index.edges.length * 0.15);
});

test('formal Play boots a bounded base set and requests only the current enemy roster', () => {
  const partOneEnemyPaths = getPlayEnemyAssetPaths(['explodingLanternfish', 'juvenileSeahorseCaller', 'crabGuard']);
  assert.ok(PLAY_BASE_IMAGE_ASSET_PATHS.length < PLAY_IMAGE_ASSET_PATHS.length);
  assert.ok(partOneEnemyPaths.length > 0);
  assert.ok(partOneEnemyPaths.length < PLAY_IMAGE_ASSET_PATHS.length);
  assert.ok(partOneEnemyPaths.every((path) => PLAY_IMAGE_ASSET_PATHS.includes(path)));
});

test('steady enemy simulation returns events without cloning its render tree', () => {
  const enemies = [{
    instanceId: 'performance-enemy', enemyId: 'crabGuard', x: 0, y: 0, homeX: 0, homeY: 0,
    radius: 8, health: 100, maxHealth: 100, moveSpeed: 0, cooldowns: {}, activeEffects: {}, linkedTargets: [],
    nextSkillIndex: 0, phase: 0, resonanceProgress: 0, resonanceRequired: 100,
  }];
  const actor = { x: 500, y: 500, radius: 6, health: 100, oxygen: 100, energy: 100, dead: false, invulnerability: 0 };
  const result = updatePlayEnemies(enemies, actor, 1 / 60, 1 / 60);
  const view = getPlayEnemyRenderView(enemies, 1 / 60);
  const snapshot = getPlayEnemyRenderState(enemies, 1 / 60);
  assert.deepEqual(Object.keys(result), ['resonanceEvents']);
  assert.equal(view.enemies, enemies);
  assert.equal(view.enemyIndex.get('performance-enemy'), enemies[0]);
  assert.notEqual(snapshot.enemies[0], enemies[0]);
});

test('HUD update gate keeps gameplay simulation at full rate while limiting DOM refreshes', () => {
  const gate = createPlayUpdateGate(50);
  assert.equal(gate.shouldUpdate(0), true);
  assert.equal(gate.shouldUpdate(16), false);
  assert.equal(gate.shouldUpdate(49), false);
  assert.equal(gate.shouldUpdate(50), true);
  gate.reset();
  assert.equal(gate.shouldUpdate(51), true);
});

test('HUD snapshot avoids cloning projectiles and effects that are unrelated to its readouts', () => {
  const hud = getPlayCombatHudState(createPlayCombatState());
  assert.ok(hud.progression);
  assert.ok(hud.resonance);
  assert.equal(Object.hasOwn(hud, 'projectiles'), false);
  assert.equal(Object.hasOwn(hud, 'effects'), false);
});

test('formal Play consumes the indexed camera slice and cached background layer', () => {
  const source = readFileSync(`${ROOT}\\src\\play-page.js`, 'utf8');
  const renderBody = source.slice(source.indexOf('function render()'), source.indexOf('function updateHud()'));
  assert.match(source, /createPlayRenderIndex\(map, origin\)/);
  assert.match(renderBody, /visibleRenderCells\.forEach/);
  assert.doesNotMatch(renderBody, /Object\.entries\(map\.cells\)/);
  assert.match(source, /backgroundLayer = buildBackgroundLayer\(\)/);
  assert.match(source, /updateHudIfDue\(now\)/);
  assert.match(source, /WATER_MOTION_FPS = 30/);
  assert.match(source, /cacheOutlinedSprite/);
  assert.match(source, /discoveryUpdateGate = createPlayUpdateGate\(120\)/);
  assert.doesNotMatch(source, /ensureImageAssets\(PLAY_IMAGE_ASSET_PATHS\)/);
});

test('steady physics steps reuse the object cache without enumerating every map cell again', () => {
  const map = createEmptyMap({ width: 18, height: 160 });
  let enumerations = 0;
  map.cells = new Proxy(map.cells, {
    ownKeys(target) {
      enumerations += 1;
      return Reflect.ownKeys(target);
    },
  });
  const actor = createTestActor({ x: 36, y: 36 });
  stepPhysics({ map, actor, origin: { x: 36, y: 36 } });
  const warmedEnumerationCount = enumerations;
  stepPhysics({ map, actor, origin: { x: 36, y: 36 } });
  assert.equal(enumerations, warmedEnumerationCount);
});
