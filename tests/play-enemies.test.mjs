import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  PLAY_ENEMY_POOLS,
  PLAY_ENEMY_VISUALS,
  createPlayEnemies,
  getPlayEnemyPose,
  isPlayEnemyVisible,
} from '../src/play-enemies.js';

function cell(q, r, actors = []) {
  return {
    q,
    r,
    terrain: 'water',
    gravityLevel: 'L1',
    waterLayer: 'T1',
    overlays: [],
    objects: [],
    freeObjects: [],
    actors,
    chapter2: {},
  };
}

test('regular enemy markers become deterministic chapter-appropriate enemies', () => {
  const map = {
    cells: {
      '0,12': cell(0, 12, [{ kind: 'enemySpawn' }]),
      '0,3': cell(0, 3, [{ kind: 'enemySpawn' }]),
      '0,7': cell(0, 7, [{ kind: 'miniBossSpawn' }]),
      '0,9': cell(0, 9, [{ kind: 'enemySpawn' }]),
    },
  };
  const enemies = createPlayEnemies(map, 1, 'chapter1', { x: 10, y: 20 });

  assert.equal(enemies.length, 3);
  assert.deepEqual(enemies.map((enemy) => enemy.enemyId), PLAY_ENEMY_POOLS[1].slice(0, 3));
  assert.deepEqual(enemies.map((enemy) => enemy.spawnCellKey), ['0,3', '0,9', '0,12']);
  assert.ok(enemies.every((enemy) => enemy.visual && enemy.state === 'idle'));
});

test('an explicit regular enemy id overrides the chapter fallback but bosses do not', () => {
  const map = {
    cells: {
      '0,2': cell(0, 2, [{ kind: 'enemySpawn', enemyId: 'lionfishGunner' }]),
      '0,4': cell(0, 4, [{ kind: 'enemySpawn', enemyId: 'prismCrabGuardian' }]),
    },
  };
  const enemies = createPlayEnemies(map, 2);

  assert.equal(enemies[0].enemyId, 'lionfishGunner');
  assert.equal(enemies[1].enemyId, PLAY_ENEMY_POOLS[2][1]);
});

test('play enemy visuals exist and floating never changes the authored size', () => {
  Object.entries(PLAY_ENEMY_VISUALS).forEach(([enemyId, source]) => {
    assert.ok(source, `${enemyId} should have a play visual`);
    const assetPath = fileURLToPath(new URL(`../public${source}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${enemyId} visual should exist at ${source}`);
  });

  const enemy = { x: 100, y: 200, phase: 0, renderSize: 18 };
  const first = getPlayEnemyPose(enemy, 0);
  const later = getPlayEnemyPose(enemy, 1.5);
  assert.equal(enemy.renderSize, 18);
  assert.notDeepEqual(first, later);
  assert.equal(isPlayEnemyVisible(enemy, { x: 80, y: 160 }, { width: 100, height: 100 }), true);
  assert.equal(isPlayEnemyVisible(enemy, { x: 400, y: 400 }, { width: 100, height: 100 }), false);
});
