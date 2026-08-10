import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setLanguage } from '../src/i18n.js';
import { installLiveLocalization, translateGameplayText } from '../src/i18n-gameplay.js';
import { TUTORIAL_TASKS } from '../src/play-tutorial.js';

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
      assert.notEqual(english, source, `${file}: untranslated source for ${source}`);
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
    ['共鳴能力保留，前往上升篇・第一部分…', 'Resonance abilities preserved. Traveling to Ascent · Part I…'],
    ['RESONANCE 完成：螃蟹守衛成為中立夥伴，永久獲得「甲殼靜養」— 每層高氧高能時的生命恢復速度約 +4.77%。', 'RESONANCE complete: Crab Guard is now neutral. Permanent buff acquired: "Carapace Repose" — Per stack: Health recovery at high oxygen and energy approximately +4.77%.'],
    ['RESONANCE 完成：螃蟹守衛成為中立夥伴；此物種 Buff 已經持有。', 'RESONANCE complete: Crab Guard is now neutral; this species buff is already owned.'],
    ['RESONANCE 完成：爆腹燈籠魚成為中立夥伴；「冷光耐爆」提升至 3/9 層，不提供 EXP。', 'RESONANCE complete: Burst-Belly Anglerfish is now neutral; "Coldlight Blastproofing" advanced to stack 3/9. No EXP granted.'],
    ['RESONANCE 完成：爆腹燈籠魚成為中立夥伴；Buff 已達 9/9 層上限，不提供 EXP。', 'RESONANCE complete: Burst-Belly Anglerfish is now neutral; buff already capped at 9/9. No EXP granted.'],
  ];
  messages.forEach(([source, expected]) => assert.equal(translateGameplayText(source, 'en'), expected));
});

test('all First Breath task labels are translated in English', () => {
  TUTORIAL_TASKS.forEach(({ title }) => {
    const english = translateGameplayText(title, 'en');
    assert.equal(CJK_PATTERN.test(english), false, `untranslated First Breath task: ${title}`);
    assert.notEqual(english, title, `missing First Breath task translation: ${title}`);
  });
});

test('dynamic First Breath navigation copy stays English for any task count', () => {
  const cases = [
    ['操作：使用 ← / → 切換 20 個任務；完成任意 10 項即可解鎖 EXIT；Enter 可開啟 Skip Tutorial。', 'Control: Use ← / → to switch between 20 tasks; complete any 10 to unlock the EXIT; press Enter to open Skip Tutorial.'],
    ['操作：使用 ← / → 切換 14 個任務；完成任意 10 項即可解鎖 EXIT；Enter 可開啟 Skip Tutorial。', 'Control: Use ← / → to switch between 14 tasks; complete any 10 to unlock the EXIT; press Enter to open Skip Tutorial.'],
  ];
  cases.forEach(([source, expected]) => assert.equal(translateGameplayText(source, 'en'), expected));
});

test('First Breath control-box navigation copy translates as a standalone sentence', () => {
  assert.equal(
    translateGameplayText('操作：使用 ← / → 切換 First Breath 任務；完成任意 10 項即可解鎖 EXIT；Enter 可開啟 Skip Tutorial。', 'en'),
    'Control: Use ← / → to switch First Breath tasks; complete any 10 to unlock the EXIT; press Enter to open Skip Tutorial.',
  );
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
  const textNode = { nodeType: 3, nodeValue: '速度 0 m/s' };
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
  assert.equal(textNode.nodeValue, 'SPEED 0 m/s');

  textNode.nodeValue = '速度 12 m/s';
  observerCallback([{ type: 'characterData', target: textNode }]);
  assert.equal(textNode.nodeValue, '速度 12 m/s', 'mutation work must not run inside the observer microtask');
  assert.equal(callbacks.length, 1);
  callbacks.shift()();
  assert.equal(textNode.nodeValue, 'SPEED 12 m/s');

  cleanup();
  globalThis.MutationObserver = previousObserver;
});
