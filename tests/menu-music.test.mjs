import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

test('editor, sandbox, and encyclopedia attach the shared main-menu music', () => {
  const main = read('../src/main.js');
  const sandbox = read('../src/sandbox-page.js');
  const encyclopedia = read('../src/enemy-encyclopedia-page.js');
  [main, sandbox, encyclopedia].forEach((source) => {
    assert.match(source, /import \{ attachMenuMusic \} from ['"]\.\/music\.js['"];/);
    assert.match(source, /attachMenuMusic\(document\);/);
  });
});

test('shared menu music starts on autoplay when allowed and retries on a user gesture', () => {
  const music = read('../src/music.js');
  assert.match(music, /export function attachMenuMusic\(eventTarget = document, options = \{\}\)/);
  assert.match(music, /MUSIC_TRACKS\.mainMenu/);
  assert.match(music, /eventTarget\.addEventListener\('pointerdown', unlock/);
  assert.match(music, /eventTarget\.addEventListener\('keydown', onKeyDown\)/);
  assert.match(music, /void unlock\(\);/);
});
