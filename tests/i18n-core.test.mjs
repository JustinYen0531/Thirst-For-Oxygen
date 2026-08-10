import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
  getLanguage,
  setLanguage,
  subscribeLanguage,
  translateText,
} from '../src/i18n.js';
import { HOME_ENEMY_SHOWCASE } from '../src/home-page.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

function createElement(attributes = {}) {
  const values = new Map(Object.entries(attributes));
  return {
    textContent: '',
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, String(value)),
    values,
  };
}

test('language defaults to English and persists the two supported choices', () => {
  const emptyStorage = createStorage();
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(getLanguage(emptyStorage), 'en');

  assert.equal(setLanguage('zh-Hant', emptyStorage), 'zh-Hant');
  assert.equal(emptyStorage.values.get(LANGUAGE_STORAGE_KEY), 'zh-Hant');
  assert.equal(getLanguage(emptyStorage), 'zh-Hant');

  assert.equal(setLanguage('unsupported', emptyStorage), 'en');
  assert.equal(emptyStorage.values.get(LANGUAGE_STORAGE_KEY), 'en');
});

test('known text translates in both directions while unknown text stays untouched', () => {
  assert.equal(translateText('home.menu.play', 'en'), 'Start Game');
  assert.equal(translateText('home.menu.play', 'zh-Hant'), '開始遊玩');
  assert.equal(translateText('dynamic-value-42', 'zh-Hant'), 'dynamic-value-42');
});

test('language subscribers receive same-page changes and can unsubscribe', () => {
  const storage = createStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
  setLanguage('en', storage);
  const events = [];
  const unsubscribe = subscribeLanguage((language, previousLanguage) => events.push([language, previousLanguage]));
  setLanguage('zh-Hant', storage);
  unsubscribe();
  setLanguage('en', storage);
  assert.deepEqual(events, [['zh-Hant', 'en']]);
});

test('document language application touches only explicitly marked text and attributes', () => {
  const html = createElement({ 'data-i18n-document-title': 'home.documentTitle' });
  const text = createElement({ 'data-i18n': 'home.menu.settings' });
  const aria = createElement({ 'data-i18n-aria-label': 'home.signalAria' });
  const untouched = createElement();
  untouched.textContent = 'HP 42';
  const documentRoot = {
    nodeType: 9,
    documentElement: html,
    title: '',
    querySelectorAll: () => [text, aria],
  };

  assert.equal(applyDocumentLanguage(documentRoot, 'zh-Hant'), 'zh-Hant');
  assert.equal(html.values.get('lang'), 'zh-Hant');
  assert.equal(documentRoot.title, 'Thirst for Oxygen');
  assert.equal(text.textContent, '設定');
  assert.equal(aria.values.get('aria-label'), '敲一下頭盔面罩');
  assert.equal(untouched.textContent, 'HP 42');
});

test('home starts in English and exposes a bilingual tutorial item above sixth Settings item', () => {
  const html = read('../home.html');
  const page = read('../src/home-page.js');
  const css = read('../src/settings.css');
  const markedKeys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);

  assert.match(html, /<html lang="en"/);
  assert.match(html, /href="\/src\/settings\.css"/);
  assert.match(html, /href="\.\/tutorial\.html"[\s\S]*?<span>05<\/span>[\s\S]*?data-i18n="home\.menu\.tutorial"/);
  assert.match(html, /id="home-settings-open"[\s\S]*?<span>06<\/span>[\s\S]*?>Settings<\/strong>/);
  assert.match(html, /id="home-settings-panel"[\s\S]*?role="dialog"[\s\S]*?hidden/);
  assert.match(html, /data-language-option="en"/);
  assert.match(html, /data-language-option="zh-Hant"/);
  assert.match(page, /subscribeLanguage\(applyHomeLanguage\)/);
  assert.match(page, /setLanguage\(languageButton\.dataset\.languageOption\)/);
  assert.match(page, /event\.key === 'Escape'/);
  assert.match(css, /\.home-settings-panel\[hidden\]/);

  assert.ok(markedKeys.length > 20);
  markedKeys.forEach((key) => {
    assert.notEqual(translateText(key, 'en'), key, `${key} needs English`);
    assert.notEqual(translateText(key, 'zh-Hant'), key, `${key} needs Traditional Chinese`);
  });
  HOME_ENEMY_SHOWCASE.forEach(({ labelKey, actionLabelKey }) => {
    assert.notEqual(translateText(labelKey, 'en'), labelKey);
    assert.notEqual(translateText(labelKey, 'zh-Hant'), labelKey);
    assert.notEqual(translateText(actionLabelKey, 'en'), actionLabelKey);
    assert.notEqual(translateText(actionLabelKey, 'zh-Hant'), actionLabelKey);
  });
});
