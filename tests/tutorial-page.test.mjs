import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { renderMarkdown } from '../src/markdown-renderer.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('tutorial is a bundled Markdown entry with the requested long-form sections', () => {
  const page = read('../tutorial.html');
  const source = read('../GDD/06_體驗/教學.md');
  const viteConfig = read('../vite.config.js');

  assert.match(page, /id="tutorial-content"/);
  assert.match(page, /src="\/src\/tutorial-page\.js"/);
  assert.match(page, /href="\/home\.html"[^>]*>Back<\/a>/);
  assert.match(viteConfig, /tutorial: resolve\(process\.cwd\(\), 'tutorial\.html'\)/);
  ['操作與彈射移動', '氧氣來源：何時冒險、何時撤退', '武器與 Build', '整個故事在講什麼', 'GDD 來源分區'].forEach((heading) => {
    assert.match(source, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(source, /\| --- \|/);
  assert.match(source, /^> /m);
  assert.match(source, /^---$/m);
  assert.match(source, /^```/m);
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
