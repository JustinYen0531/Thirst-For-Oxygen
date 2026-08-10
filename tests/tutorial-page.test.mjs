import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { renderMarkdown, slugifyHeading } from '../src/markdown-renderer.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('tutorial is a bundled Markdown entry with the requested long-form sections', () => {
  const page = read('../tutorial.html');
  const source = read('../GDD/06_體驗/教學.md');
  const englishSource = read('../GDD/06_體驗/教學.en.md');
  const viteConfig = read('../vite.config.js');

  assert.match(page, /id="tutorial-content"/);
  assert.match(page, /src="\/src\/tutorial-page\.js"/);
  assert.match(page, /href="\.\/home\.html"[^>]*>Back<\/a>/);
  assert.match(page, /data-tutorial-language="en"/);
  assert.match(page, /data-tutorial-language="zh-Hant"/);
  assert.match(page, /data-i18n="tutorial\.title">Complete How to Play<\/h1>/);
  assert.match(viteConfig, /tutorial: resolve\(process\.cwd\(\), 'tutorial\.html'\)/);
  ['操作與彈射移動', '氧氣來源：何時冒險、何時撤退', 'Resonance 共鳴：不必殺死所有敵人', '武器與 Build', '整個故事在講什麼', 'GDD 來源分區'].forEach((heading) => {
    assert.match(source, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(source, /\| 深淵抹香鯨 \| 深淵共鳴 \|/);
  assert.match(source, /\| --- \|/);
  assert.match(source, /^> /m);
  assert.match(source, /^---$/m);
  assert.match(source, /^```/m);
  ['Your First Dive: A Safe Learning Order', 'Controls and Elastic Movement', 'Oxygen, Energy, Health, and Experience', 'Water Gravity and Physics', 'Combat, Enemies, and Bosses', 'Resonance: Neutralize Instead of Kill', 'Weapons and Build', 'What the Story Is About', 'Version Notes: Confirmed and Still Tuning'].forEach((heading) => {
    assert.match(englishSource, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(englishSource, /\| Abyssal Sperm Whale \| Abyssal Resonance \|/);
  assert.doesNotMatch(englishSource, /[\u3400-\u9fff]/);
});

test('tutorial page keeps Chinese as an explicit alternate while defaulting to English', () => {
  const page = read('../src/tutorial-page.js');
  const i18n = read('../src/i18n.js');
  assert.match(page, /activeLanguage === 'zh-Hant' \? tutorialMarkdown : tutorialEnglishMarkdown/);
  assert.match(page, /renderTutorial\(getLanguage\(\)\)/);
  assert.match(i18n, /'tutorial\.title': Object\.freeze\(\{ en: 'Complete How to Play', 'zh-Hant': '完整遊玩教學' \}\)/);
  assert.match(i18n, /'tutorial\.languageChinese': Object\.freeze/);
});

test('Markdown renderer supports headings, tables, lists, quotes, code, and safe links', () => {
  const markdown = [
    '# Title',
    '',
    '> Keep breathing.',
    '',
    '| A | B |',
    '| --- | --- |',
    '| **one** | `two` |',
    '',
    '- first',
    '- [home](/home.html)',
    '',
    '```text',
    '<script>alert(1)</script>',
    '```',
  ].join('\n');
  const html = renderMarkdown(markdown);

  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<blockquote><p>Keep breathing\.<\/p><\/blockquote>/);
  assert.match(html, /<table>[\s\S]*<th>A<\/th>[\s\S]*<td><strong>one<\/strong><\/td>/);
  assert.match(html, /<ul>[\s\S]*<li>first<\/li>/);
  assert.match(html, /<a href="\/home\.html">home<\/a>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('all tutorial contents anchors resolve after punctuation normalization', () => {
  ['../GDD/06_體驗/教學.md', '../GDD/06_體驗/教學.en.md'].forEach((relativePath) => {
    const source = read(relativePath);
    const html = renderMarkdown(source);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id));
    const links = [...source.matchAll(/\]\(#([^)]+)\)/g)].map(([, href]) => href);
    links.forEach((href) => assert.ok(ids.has(slugifyHeading(href)), `${relativePath} has a broken contents link: ${href}`));
  });
});
