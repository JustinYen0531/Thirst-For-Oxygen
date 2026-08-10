import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../src/i18n.js';
import {
  EDITOR_LANGUAGE_STORAGE_KEY,
  createEditorI18n,
  editorT,
  normalizeEditorLanguage,
  translateEditorText,
} from '../src/i18n-editor.js';

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('editor language uses the shared English-default storage contract', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(EDITOR_LANGUAGE_STORAGE_KEY, LANGUAGE_STORAGE_KEY);
  assert.equal(normalizeEditorLanguage(null), 'en');
  assert.equal(normalizeEditorLanguage('zh-TW'), 'zh-Hant');

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const i18n = createEditorI18n({ storage });
  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.setLanguage('zh-Hant'), 'zh-Hant');
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'zh-Hant');
  assert.equal(i18n.getLanguage(), 'zh-Hant');
});
test('every static editor binding has English and Traditional Chinese copy', () => {
  const keys = [...indexSource.matchAll(/data-i18n(?:-aria-label|-title|-placeholder)?="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length > 40, 'expected the complete editor shell to be language-bound');
  for (const key of new Set(keys)) {
    assert.notEqual(editorT(key, {}, 'en'), key, `missing English copy for ${key}`);
    assert.notEqual(editorT(key, {}, 'zh-Hant'), key, `missing Traditional Chinese copy for ${key}`);
  }
  const visibleChinese = [...indexSource.matchAll(/>([^<]*[\u4e00-\u9fff][^<]*)</g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  assert.deepEqual(visibleChinese, [], 'editor shell should not duplicate the Settings language buttons');
});

test('editor topbar stays compact and mode controls live below the asset palette heading', () => {
  const topbarSource = indexSource.slice(0, indexSource.indexOf('<section class="workspace">'));
  assert.match(indexSource, /<a class="topbar-nav" href="\/home\.html" data-i18n="nav\.back">Back<\/a>/);
  assert.doesNotMatch(indexSource, /data-editor-language/);
  assert.match(indexSource, /<div class="palette-heading">[\s\S]*?<\/div>\s*<div class="editor-control-actions"[\s\S]*?id="fullscreen"/);
  assert.doesNotMatch(topbarSource, /class="topbar-actions"[\s\S]*?id="editor-mode"/);
});

test('dynamic editor tools, Inspector, validation, and events translate without losing Chinese', () => {
  const samples = [
    ['已選擇工具：重力', 'Selected tool: Gravity'],
    ['已建立 G2 連線；可繼續拖曳到其他門。', 'Linked G2; keep dragging to link more gates.'],
    ['群組 portal-a：3 條 Edge，尚未連接另一端。', 'Group portal-a: 3 Edge segment(s), not connected to another side.'],
    ['q2r4 已標記為條件通行門；按鈕可指定這個 Cell。', 'q2r4 is now a conditional gate that buttons can target.'],
    ['q2r4 的按鈕指定了不存在的門：q9r9。', 'q2r4 button targets a missing gate: q9r9.'],
    ['彈射初速度：320 px/s；能量 -2。氧氣改為時間倒數，滿氧約 40 秒。', 'Launch speed: 320 px/s; energy -2. Oxygen drains over time and lasts about 40 seconds when full.'],
  ];
  for (const [source, english] of samples) {
    assert.equal(translateEditorText(source, 'en'), english);
    assert.equal(translateEditorText(source, 'zh-Hant'), source);
  }
});

test('all fixed Chinese editor literals have an English translation route', () => {
  const fixedLiterals = [...mainSource.matchAll(/(['"])([^'"\r\n]*[\u4e00-\u9fff][^'"\r\n]*)\1/g)]
    .map((match) => match[2]);
  assert.ok(fixedLiterals.length > 70, 'expected broad dynamic editor-copy coverage');
  for (const literal of new Set(fixedLiterals)) {
    assert.notEqual(translateEditorText(literal, 'en'), literal, `untranslated editor literal: ${literal}`);
    assert.equal(translateEditorText(literal, 'zh-Hant'), literal, `Traditional Chinese source changed: ${literal}`);
  }
});
