import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {
  ENEMY_ENCYCLOPEDIA,
  MAP_ENCYCLOPEDIA,
  MAP_PLACEMENT_COUNT,
  MAP_UNIQUE_ELEMENT_COUNT,
  PASSIVE_ENCYCLOPEDIA,
  WEAPON_ENCYCLOPEDIA,
} from '../src/enemy-encyclopedia.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const publicPath = (url) => path.join(ROOT, 'public', url.replace(/^\//, ''));

function allVisualUrls(enemy) {
  if (!enemy.visuals) return [];
  return [
    enemy.visuals.idle,
    ...Object.values(enemy.visuals.actions),
    enemy.visuals.afterimageIdle,
    ...Object.values(enemy.visuals.afterimageActions),
  ];
}

test('world encyclopedia exposes 19 honest enemy entries and every declared visual exists', () => {
  assert.equal(ENEMY_ENCYCLOPEDIA.length, 19);
  const pendingVisuals = ENEMY_ENCYCLOPEDIA.filter(({ visuals }) => !visuals).map(({ id }) => id);
  assert.deepEqual(pendingVisuals, []);

  ENEMY_ENCYCLOPEDIA.forEach((enemy) => {
    allVisualUrls(enemy).forEach((url) => {
      assert.equal(existsSync(publicPath(url)), true, `${enemy.id} visual should exist at ${url}`);
    });
    const attackIds = new Set(enemy.attacks.map(({ id }) => id));
    Object.keys(enemy.visuals?.actions ?? {}).forEach((actionId) => {
      assert.equal(attackIds.has(actionId), true, `${enemy.id} should not declare unknown action ${actionId}`);
    });
  });
});

test('all Mini Boss and Final Boss attacks have authored skill animations', () => {
  const bossIds = [
    'prismCrabGuardian',
    'tideLawNautilus',
    'mutantPrismCrabGuardian',
    'mutantTideLawNautilus',
    'abyssalSpermWhale',
  ];
  bossIds.forEach((id) => {
    const enemy = ENEMY_ENCYCLOPEDIA.find((entry) => entry.id === id);
    assert.ok(enemy?.visuals?.idle);
    assert.deepEqual(
      Object.keys(enemy.visuals.actions).sort(),
      enemy.attacks.map(({ id: attackId }) => attackId).sort(),
      `${id} should expose one animation for every authored attack`,
    );
  });
});

test('map encyclopedia distinguishes 29 placements from 27 unique element ids', () => {
  assert.equal(MAP_PLACEMENT_COUNT, 29);
  assert.equal(MAP_ENCYCLOPEDIA.length, 29);
  assert.equal(MAP_UNIQUE_ELEMENT_COUNT, 27);
  assert.equal(new Set(MAP_ENCYCLOPEDIA.map(({ placementId }) => placementId)).size, 29);

  for (const id of ['seaweed', 'coralCluster']) {
    const placements = MAP_ENCYCLOPEDIA.filter((entry) => entry.id === id);
    assert.deepEqual(placements.map(({ placementKind }) => placementKind), ['cell', 'edge']);
    assert.notEqual(placements[0].placement, placements[1].placement);
  }
});

test('weapon and passive encyclopedia entries reuse all 24 authored level icons', () => {
  assert.equal(WEAPON_ENCYCLOPEDIA.length, 4);
  assert.equal(PASSIVE_ENCYCLOPEDIA.length, 4);
  const levels = [...WEAPON_ENCYCLOPEDIA, ...PASSIVE_ENCYCLOPEDIA].flatMap(({ levels: entries }) => entries);
  assert.equal(levels.length, 24);
  levels.forEach(({ icon }) => assert.equal(existsSync(publicPath(icon)), true, `icon should exist at ${icon}`));
});

test('runtime literal asset scan has no broken artwork references', () => {
  const sourceFiles = readdirSync(path.join(ROOT, 'src'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(ROOT, 'src', name));
  const htmlFiles = readdirSync(ROOT)
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(ROOT, name));
  const references = [];
  const literalAsset = /['"](\/assets\/[^'"?${}]+)['"]/g;
  [...sourceFiles, ...htmlFiles].forEach((file) => {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(literalAsset)) references.push(match[1]);
  });
  const missing = [...new Set(references.filter((url) => !existsSync(publicPath(url))))].sort();
  assert.deepEqual(missing, []);
});

test('public navigation starts the full descent route and labels unfinished previews honestly', () => {
  const home = readFileSync(path.join(ROOT, 'home.html'), 'utf8');
  const sandbox = readFileSync(path.join(ROOT, 'sandbox.html'), 'utf8');
  const encyclopedia = readFileSync(path.join(ROOT, 'enemy-encyclopedia.html'), 'utf8');
  const sandboxPage = readFileSync(path.join(ROOT, 'src', 'sandbox-page.js'), 'utf8');

  assert.match(home, /從第一部分進入完整下沉航線/);
  assert.match(home, /已有素材可切換演示/);
  assert.match(home, /尚未完成的動畫會清楚標示待補/);
  assert.doesNotMatch(home, /範本地圖|每一隻敵人[^。]*正式殘影演示/);
  assert.match(sandbox, /href="\/play\.html">遊玩地圖<\/a>/);
  assert.match(encyclopedia, /href="\/play\.html">遊玩地圖<\/a>/);
  assert.doesNotMatch(`${sandbox}\n${encyclopedia}`, /play\.html\?part=3/);
  assert.match(sandbox, /href="\/enemy-encyclopedia\.html">世界圖鑑<\/a>/);
  assert.match(sandboxPage, /Build 已即時同步/);
  assert.doesNotMatch(sandboxPage, /重新套用 Build/);
});

test('declared animated visuals and repaired GDD previews retain alpha without a connected black matte', () => {
  const declaredAssets = ENEMY_ENCYCLOPEDIA.flatMap(allVisualUrls).map(publicPath);
  const repairedGddCopies = [
    'GDD/05_內容/敵人/等級4/變異蝦蛄戰將/重構素材/preview_gifs/reconstructed-preview__skill-beacon-afterimage.gif',
    'GDD/05_內容/敵人/等級4/變異鸚鵡螺祭司/重構素材/preview_gifs/reconstructed-preview__skill-360-core-scatter.gif',
    'GDD/05_內容/敵人/等級4/變異鸚鵡螺祭司/重構素材/preview_gifs/reconstructed-preview__skill-everlasting-core.gif',
  ].map((relativePath) => path.join(ROOT, relativePath));
  const repairedLegacyPublicCopies = [
    'public/assets/enemies/mutantNautilusOracle/reconstructed-preview__skill-360-core-scatter.gif',
    'public/assets/enemies/mutantNautilusOracle/reconstructed-preview__skill-everlasting-core.gif',
  ].map((relativePath) => path.join(ROOT, relativePath));
  const checker = path.join(ROOT, 'scripts', 'check-transparent-assets.py');
  const result = spawnSync('python', [checker, '--stdin-json'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: JSON.stringify([...new Set([...declaredAssets, ...repairedGddCopies, ...repairedLegacyPublicCopies])]),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.failures.length, 0);
  assert.equal(report.checked > 90, true);
});
