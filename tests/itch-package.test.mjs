import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('itch packaging uses a relative Vite base and a repeatable package command', () => {
  const viteConfig = read('../vite.config.js');
  const packageJson = JSON.parse(read('../package.json'));

  assert.match(viteConfig, /base:\s*'\.\/'/);
  assert.equal(
    packageJson.scripts['package:itch'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-itch.ps1',
  );
});

test('itch packaging promotes the helmet home to index and keeps the editor separate', () => {
  const script = read('../scripts/package-itch.ps1');

  assert.match(script, /Move-Item[\s\S]*\$editorPath/);
  assert.match(script, /href="\.\/index\.html[\s\S]*href="\.\/editor\.html/);
  assert.match(script, /id=\"home-intro\"/);
  assert.match(script, /ZIP root index\.html is not the authored helmet title screen/);
});

test('itch packaging normalizes and verifies ZIP paths including Unicode names', () => {
  const script = read('../scripts/package-itch.ps1');

  assert.ok(script.includes(".Replace('\\', '/')"));
  assert.match(script, /Encoding\]::UTF8/);
  assert.match(script, /Unsafe ZIP entry name/);
  assert.match(script, /Expected at least one Unicode filename/);
  assert.match(script, /Compare-Object -ReferenceObject \$expectedEntries -DifferenceObject \$actualEntries/);
});

test('all player-facing page navigation is relative for itch subpath hosting', () => {
  const htmlFiles = [
    '../index.html',
    '../home.html',
    '../play.html',
    '../sandbox.html',
    '../enemy-encyclopedia.html',
    '../tutorial.html',
  ];

  htmlFiles.forEach((file) => {
    const html = read(file);
    assert.doesNotMatch(html, /<a\b[^>]*\bhref="\//, file);
  });
  assert.match(read('../src/home-start-loading.js'), /\|\| '\.\/play\.html'/);
  assert.doesNotMatch(read('../src/play-page.js'), /window\.location\.href = '\/home\.html'/);
  assert.doesNotMatch(read('../src/enemy-encyclopedia-page.js'), /href="\/sandbox\.html"/);
});
