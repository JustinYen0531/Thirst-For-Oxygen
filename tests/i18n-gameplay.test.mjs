import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setLanguage } from '../src/i18n.js';
import { installLiveLocalization, translateGameplayText } from '../src/i18n-gameplay.js';

const CJK_PATTERN = /[\u3400-\u9fff]/;

function visibleChineseCopy(html) {
  const values = [];
  for (const match of html.matchAll(/>([^<>]+)</g)) {
    const value = match[1].trim();
    if (CJK_PATTERN.test(value)) values.push(value);
  }
  for (const match of html.matchAll(/(?:aria-label|aria-valuetext|title|alt)="([^"]*[\u3400-\u9fff][^"]*)"/g)) {
    values.push(match[1]);
  }
  return [...new Set(values)];
}

test('play and sandbox static copy has a meaningful English translation', () => {
  for (const file of ['play.html', 'sandbox.html']) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    visibleChineseCopy(html).forEach((source) => {
      const english = translateGameplayText(source, 'en');
      assert.equal(CJK_PATTERN.test(english), false, `${file}: untranslated CJK in ${source}`);
      assert.notEqual(english, 'English copy pending review', `${file}: generic fallback for ${source}`);
    });
  }
});

test('representative dynamic combat messages retain their meaning in English', () => {
  const messages = [
    ['受到 18 傷害 · 毒刺持續傷害', 'Took 18 damage · Venom Damage over Time'],
    ['氧氣礦石：撞擊後釋放 24 O₂。', 'Oxygen Ore released 24 O₂ after impact.'],
    ['已選取 變異弧潮獵鰩。', 'Selected Mutant Arc-Tide Ray.'],
    ['三叉戟 冷卻中：1.2 秒。', 'Trident cooldown: 1.2s.'],
    ['下一個放置：爆腹燈籠魚。', 'Next placement: Burst-Belly Anglerfish.'],
    ['Build 已更新：武士刀 Lv.2。', 'Build updated: Katana Lv.2.'],
    ['深淵抹香鯨已擊敗：下沉篇完成。', 'Abyssal Sperm Whale defeated: Descent complete.'],
  ];
  messages.forEach(([source, expected]) => assert.equal(translateGameplayText(source, 'en'), expected));
});

test('play settings exposes the shared language selector', () => {
  const html = fs.readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../src/play-page.js', import.meta.url), 'utf8');
  assert.match(html, /id="play-language"/);
  assert.match(html, /value="en"/);
  assert.match(html, /value="zh-Hant"/);
  assert.match(source, /bindLanguageSelect\(document\.querySelector\('#play-language'\)\)/);
  assert.match(source, /installLiveLocalization\(document\)/);
});

test('live gameplay copy batches HUD mutations into one animation frame', () => {
  const callbacks = [];
  let observerCallback = null;
  const previousObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class FakeMutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  };
  const textNode = { nodeType: 3, nodeValue: '速度 0' };
  const root = {
    childNodes: [textNode],
    documentElement: { lang: '' },
    defaultView: {
      requestAnimationFrame(callback) { callbacks.push(callback); return callbacks.length; },
      cancelAnimationFrame() {},
    },
    querySelectorAll() { return []; },
  };
  setLanguage('en', null);
  const cleanup = installLiveLocalization(root);
  assert.equal(textNode.nodeValue, 'SPEED 0');

  textNode.nodeValue = '速度 12';
  observerCallback([{ type: 'characterData', target: textNode }]);
  assert.equal(textNode.nodeValue, '速度 12', 'mutation work must not run inside the observer microtask');
  assert.equal(callbacks.length, 1);
  callbacks.shift()();
  assert.equal(textNode.nodeValue, 'SPEED 12');

  cleanup();
  globalThis.MutationObserver = previousObserver;
});
