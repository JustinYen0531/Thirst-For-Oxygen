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
  PLAY_ENEMY_TARGETS,
  PLAY_ENEMY_VISUALS,
  createPlayEnemies,
  getPlayEnemyPose,
  isPlayEnemyVisible,
} from '../src/play-enemies.js';

const PART_MAP_PATHS = [
  '../maps/下沉篇/下沉篇-第1部分.json',
  '../maps/下沉篇/下沉篇-第2部分.json',
  '../maps/下沉篇/下沉篇-第3部分.json',
];

function readMap(relativePath) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'));
}

test('all descent map parts expand encounter anchors to the required population', () => {
  const allEnemyIds = new Set();
  PART_MAP_PATHS.forEach((relativePath, index) => {
    const part = index + 1;
    const enemies = createPlayEnemies(readMap(relativePath), part, 'chapter1', { x: 36, y: 36 });
    assert.equal(enemies.length, PLAY_ENEMY_TARGETS[part], `Part ${part} should reach its authored population`);
    assert.equal(new Set(enemies.map((enemy) => enemy.spawnCellKey)).size, enemies.length, `Part ${part} should spread enemies across distinct water cells`);
    enemies.forEach((enemy) => {
      assert.equal(DESCENT_ENEMY_ROSTER.includes(enemy.enemyId), true, `${enemy.enemyId} must belong to Chapter 1: Descent`);
      allEnemyIds.add(enemy.enemyId);
    });
  });
  assert.deepEqual(new Set(DESCENT_ENEMY_ROSTER), allEnemyIds, 'the three descent parts should use the complete documented nine-enemy roster');
});

test('enemy progression follows the configuration document instead of a made-up tier per map', () => {
  const part1 = createPlayEnemies(readMap(PART_MAP_PATHS[0]), 1, 'chapter1', { x: 36, y: 36 });
  const part2 = createPlayEnemies(readMap(PART_MAP_PATHS[1]), 2, 'chapter1', { x: 36, y: 36 });
  const part3 = createPlayEnemies(readMap(PART_MAP_PATHS[2]), 3, 'chapter1', { x: 36, y: 36 });
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
  const enemies = createPlayEnemies(map, 2, 'chapter1', { x: 36, y: 36 });
  const anchors = [...new Set(enemies.map((enemy) => enemy.anchorCellKey))];

  assert.ok(enemies.filter((enemy) => enemy.anchorCellKey === anchors[0]).every((enemy) => enemy.enemyId === 'lionfishGunner'));
  assert.ok(enemies.filter((enemy) => enemy.anchorCellKey === anchors[1]).every((enemy) => enemy.enemyId !== 'splitLanternfish'));
});

test('all nine descent visuals exist and enemy display size is at least doubled', () => {
  Object.entries(PLAY_ENEMY_VISUALS).forEach(([enemyId, source]) => {
    assert.ok(source, `${enemyId} should have a play visual`);
    const assetPath = fileURLToPath(new URL(`../public${source}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${enemyId} visual should exist at ${source}`);
  });
  assert.equal(Object.keys(PLAY_ENEMY_VISUALS).length, 9);
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
