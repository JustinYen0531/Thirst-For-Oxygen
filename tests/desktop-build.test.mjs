import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const main = readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');

test('desktop build emits both an x64 NSIS installer and portable ZIP', () => {
  assert.equal(packageJson.main, 'desktop/main.cjs');
  assert.equal(packageJson.scripts['package:desktop'], 'npm run package:itch && electron-builder --win --x64');
  assert.deepEqual(packageJson.build.win.target.map(({ target }) => target), ['nsis', 'zip']);
  packageJson.build.win.target.forEach(({ arch }) => assert.deepEqual(arch, ['x64']));
  assert.equal(packageJson.build.extraResources[0].to, 'web');
});

test('desktop host serves media over localhost with byte ranges', () => {
  assert.match(main, /server\.listen\(0, '127\.0\.0\.1'/);
  assert.match(main, /'Accept-Ranges': 'bytes'/);
  assert.match(main, /'Content-Range'/);
  assert.match(main, /response\.writeHead\(206/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /sandbox: true/);
});
