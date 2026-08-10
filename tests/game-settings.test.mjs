import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AMBIENT_ENABLED_STORAGE_KEY,
  DAMAGE_REDUCTION_STORAGE_KEY,
  RESOURCE_COST_REDUCTION_STORAGE_KEY,
  getAmbientEnabled,
  getPlayerDamageReduction,
  getResourceCostReduction,
  setAmbientEnabled,
  setPlayerDamageReduction,
  setResourceCostReduction,
} from '../src/game-settings.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test('shared gameplay settings preserve defaults and accepted values', () => {
  const storage = createStorage();
  assert.equal(getPlayerDamageReduction(storage), 0.5);
  assert.equal(getResourceCostReduction(storage), 0.3);
  assert.equal(getAmbientEnabled(storage), true);

  setPlayerDamageReduction(0.75, storage);
  setResourceCostReduction(0.9, storage);
  setAmbientEnabled(false, storage);

  assert.equal(storage.values.get(DAMAGE_REDUCTION_STORAGE_KEY), '0.75');
  assert.equal(storage.values.get(RESOURCE_COST_REDUCTION_STORAGE_KEY), '0.9');
  assert.equal(storage.values.get(AMBIENT_ENABLED_STORAGE_KEY), 'false');
  assert.equal(getPlayerDamageReduction(storage), 0.75);
  assert.equal(getResourceCostReduction(storage), 0.9);
  assert.equal(getAmbientEnabled(storage), false);
});

test('shared gameplay settings reject invalid values without corrupting storage', () => {
  const storage = createStorage({
    [DAMAGE_REDUCTION_STORAGE_KEY]: 'invalid',
    [RESOURCE_COST_REDUCTION_STORAGE_KEY]: '0.42',
    [AMBIENT_ENABLED_STORAGE_KEY]: 'not-boolean',
  });

  assert.equal(getPlayerDamageReduction(storage), 0.5);
  assert.equal(getResourceCostReduction(storage), 0.3);
  assert.equal(getAmbientEnabled(storage), true);
  assert.equal(setPlayerDamageReduction(0.42, storage), 0.5);
  assert.equal(setResourceCostReduction(0.42, storage), 0.3);
  assert.equal(setAmbientEnabled('false', storage), true);
});

test('main-menu settings expose the same persistent controls without replacing formal play controls', () => {
  const home = read('../home.html');
  const play = read('../play.html');
  const page = read('../src/play-page.js');
  assert.match(home, /id="home-damage-reduction"/);
  assert.match(home, /id="home-resource-cost-reduction"/);
  assert.match(home, /id="home-ambient-toggle"/);
  assert.match(home, /id="home-ambient-volume"/);
  assert.match(home, /id="home-music-control"/);
  assert.match(play, /id="play-damage-reduction"/);
  assert.match(play, /id="play-resource-cost-reduction"/);
  assert.match(page, /getPlayerDamageReduction/);
  assert.match(page, /getResourceCostReduction/);
  assert.match(page, /getAmbientEnabled/);
});
