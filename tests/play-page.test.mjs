import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const page = read('../src/play-page.js');
const html = read('../play.html');
const home = read('../home.html');

test('formal play connects the shared combat build instead of a hard-coded HUD showcase', () => {
  assert.match(page, /createPlayCombatState\(\)/);
  assert.match(page, /stepPlayCombat\(combatState/);
  assert.match(page, /getPlayerHudSlots\(combatState\.build\)/);
  assert.match(page, /recordPlayEnemyDefeats\(combatState, enemies, actor\)/);
  assert.doesNotMatch(page, /const PLAYER_LEVEL|const PLAYER_EXPERIENCE|PLAYER_HUD_LOADOUT/);
});

test('formal play renders and reports stationary experience orbs, projectiles, and upgrades', () => {
  assert.match(page, /drawExperienceOrbs\(\)/);
  assert.match(page, /drawCombatProjectiles\(\)/);
  assert.match(page, /choosePlayUpgradeCategory/);
  assert.match(page, /choosePlayUpgrade\(combatState/);
  assert.match(html, /id="play-upgrade-overlay"/);
  assert.match(html, /id="play-upgrade-categories"/);
  assert.match(html, /id="play-upgrade-choices"/);
});

test('the public play entry starts at Part 1 and stage exits preserve the run', () => {
  assert.match(page, /let mapPart = 1;/);
  assert.match(page, /loadMap\(nextPart, \{ preserveRun: true \}\)/);
  assert.match(page, /getPlayStageExitState\(\{ map, mapPart, actor, enemies, origin \}\)/);
  assert.match(html, /<option value="1" selected>/);
  assert.doesNotMatch(home, /play\.html\?part=3/);
  assert.match(home, /下沉篇三部分已串接/);
});

test('formal play uses honest programmatic fallbacks instead of broken or wrong assets', () => {
  assert.doesNotMatch(page, /button\.png/);
  assert.doesNotMatch(page, /current:\s*['"]\/assets\/editor\/edges\/edge-spike-barrier\.png/);
  assert.match(page, /getPlayWorldAssetPaths\(\)/);
  assert.match(page, /drawProgrammaticEdge/);
});
