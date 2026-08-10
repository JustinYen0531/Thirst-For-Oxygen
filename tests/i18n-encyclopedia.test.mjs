import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DEFAULT_ENCYCLOPEDIA_LOCALE,
  ENCYCLOPEDIA_LOCALE_STORAGE_KEY,
  formatEncyclopediaValue,
  getLocalizedEncyclopedia,
  getStoredEncyclopediaLocale,
  normalizeEncyclopediaLocale,
  setStoredEncyclopediaLocale,
} from '../src/i18n-encyclopedia.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u;

function assertNoCjk(value, label) {
  assert.doesNotMatch(JSON.stringify(value), CJK, `${label} must not contain CJK fallback copy`);
}

test('encyclopedia locale defaults to English and shares one storage key', () => {
  assert.equal(DEFAULT_ENCYCLOPEDIA_LOCALE, 'en');
  assert.equal(normalizeEncyclopediaLocale(undefined), 'en');
  assert.equal(normalizeEncyclopediaLocale('en-US'), 'en');
  assert.equal(normalizeEncyclopediaLocale('zh-TW'), 'zh-Hant');
  assert.equal(normalizeEncyclopediaLocale('zh_Hant'), 'zh-Hant');

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(getStoredEncyclopediaLocale(storage), 'en');
  assert.equal(setStoredEncyclopediaLocale('zh-TW', storage), 'zh-Hant');
  assert.equal(values.get(ENCYCLOPEDIA_LOCALE_STORAGE_KEY), 'zh-Hant');
  assert.equal(getStoredEncyclopediaLocale(storage), 'zh-Hant');
  assert.equal(setStoredEncyclopediaLocale('fr', storage), 'en');
});

test('English encyclopedia exhaustively localizes all authored content without CJK fallback', () => {
  const english = getLocalizedEncyclopedia('en');
  assert.equal(english.locale, 'en');
  assert.equal(english.enemies.length, 19);
  assert.equal(english.mapEntries.length, 30);
  assert.equal(new Set(english.mapEntries.map(({ placementId }) => placementId)).size, 30);
  assert.equal(english.weapons.length, 4);
  assert.equal(english.passives.length, 4);
  assert.equal(english.sections.length, 5);
  assert.equal(english.sections.at(-1).id, 'resonance');
  assert.equal(english.resonance.buffs.length, 19);
  assert.ok(english.resonance.title && english.resonance.role && english.resonance.description);
  assert.equal(english.resonance.steps.length, 4);
  assert.equal(english.resonance.rules.length, 5);
  assert.ok(english.resonance.buffs.every(({ name, description, maxStacks }) => name && description && maxStacks > 0));

  for (const enemy of english.enemies) {
    assert.ok(enemy.name && enemy.role && enemy.description && enemy.tierLabel, enemy.id);
    assert.deepEqual(Object.keys(enemy.lore).sort(), ['identification', 'scientificReference', 'visualSetting']);
    assert.ok(enemy.attacks.length >= 1, `${enemy.id} must retain authored skills`);
    for (const attack of enemy.attacks) {
      assert.ok(attack.name && attack.description && attack.typeLabel, `${enemy.id}:${attack.id}`);
      for (const key of Object.keys(attack).filter((key) => !['id', 'name', 'type', 'typeLabel', 'description'].includes(key))) {
        assert.ok(english.ui.attackValueLabels[key], `missing English attack value label: ${key}`);
      }
    }
  }
  for (const entry of english.mapEntries) {
    assert.ok(entry.group && entry.name && entry.placement && entry.description, entry.placementId);
    assert.equal(entry.details.length, 2, `${entry.placementId} must translate both authored detail rows`);
  }
  for (const weapon of english.weapons) {
    assert.ok(weapon.name && weapon.typeLabel && weapon.role && weapon.description, weapon.id);
    assert.equal(weapon.levels.length, 3);
    assert.ok(weapon.levels.every(({ summary }) => summary), weapon.id);
    for (const level of weapon.levels) {
      for (const [key, value] of Object.entries(level.values)) {
        if (key !== 'effect' && typeof value !== 'object') assert.ok(english.ui.entryValueLabels[key], `missing English weapon value label: ${key}`);
      }
    }
  }
  for (const passive of english.passives) {
    assert.ok(passive.name && passive.role && passive.description, passive.id);
    assert.equal(passive.levels.length, 3);
    assert.ok(passive.levels.every(({ summary }) => summary), passive.id);
    for (const level of passive.levels) {
      for (const [key, value] of Object.entries(level.values)) {
        if (typeof value !== 'object') assert.ok(english.ui.entryValueLabels[key], `missing English passive value label: ${key}`);
      }
    }
  }

  assertNoCjk(english, 'English encyclopedia');
});

test('Traditional Chinese remains available with the same stable ids and counts', () => {
  const english = getLocalizedEncyclopedia('en');
  const chinese = getLocalizedEncyclopedia('zh-Hant');
  assert.equal(chinese.locale, 'zh-Hant');
  assert.deepEqual(chinese.enemies.map(({ id }) => id), english.enemies.map(({ id }) => id));
  assert.deepEqual(chinese.mapEntries.map(({ placementId }) => placementId), english.mapEntries.map(({ placementId }) => placementId));
  assert.deepEqual(chinese.weapons.map(({ id }) => id), english.weapons.map(({ id }) => id));
  assert.deepEqual(chinese.passives.map(({ id }) => id), english.passives.map(({ id }) => id));
  assert.deepEqual(chinese.resonance.buffs.map(({ enemyId }) => enemyId), english.resonance.buffs.map(({ enemyId }) => enemyId));
  assert.match(chinese.resonance.title, CJK);
  assert.match(chinese.enemies[0].name, CJK);
  assert.match(chinese.ui.heading, CJK);
});

test('localized numeric formatting uses English labels and units', () => {
  const english = getLocalizedEncyclopedia('en');
  assert.equal(english.ui.attackValueLabels.cooldown, 'Cooldown');
  assert.equal(english.ui.entryValueLabels.damageMultiplier, 'Weapon damage');
  assert.equal(formatEncyclopediaValue('cooldown', 1.6, 'en'), '1.6 s');
  assert.equal(formatEncyclopediaValue('persistent', true, 'en'), 'Yes');
  assert.equal(formatEncyclopediaValue('gravityModes', ['reverse', 'low'], 'en'), 'reverse / low');
  assert.equal(formatEncyclopediaValue('cooldown', 1.6, 'zh-Hant'), '1.6 秒');
});

test('world field guide declares English as its initial document locale and uses runtime localization', () => {
  const html = readFileSync(path.join(ROOT, 'enemy-encyclopedia.html'), 'utf8');
  const page = readFileSync(path.join(ROOT, 'src', 'enemy-encyclopedia-page.js'), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Thirst for Oxygen — World Field Guide/);
  assert.match(page, /getStoredEncyclopediaLocale\(\)/);
  assert.match(page, /getLocalizedEncyclopedia/);
  assert.match(page, /document\.documentElement\.lang = locale/);
  assert.match(html, /<a class="back-link" href="\/home\.html" data-i18n="navHome">Back<\/a>/);
  assert.doesNotMatch(html, /afterimage-controls|afterimage-toggle|Enable authored afterimages/);
  assert.doesNotMatch(page, /afterimage-toggle|AFTERIMAGE_PROFILE|afterimageEnabled/);
  assert.match(page, /section\.id === 'resonance'/);
});
