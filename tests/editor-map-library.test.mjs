import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  EDITOR_PLAYABLE_MAPS,
  loadEditorPlayableMap,
  saveEditorPlayableMap,
} from '../src/editor-map-library.js';
import {
  getEditorMapFilePath,
  writeEditorMap,
} from '../scripts/editor-map-api.mjs';

const validMap = {
  cells: { '0,0': { q: 0, r: 0, terrain: 'water', gravityLevel: 'L0' } },
  edges: {},
  chapterStates: { chapter1: {} },
};

test('editor exposes the three playable descent maps', () => {
  assert.deepEqual(EDITOR_PLAYABLE_MAPS.map(({ id }) => id), ['descent-1', 'descent-2', 'descent-3']);
  assert.match(decodeURI(EDITOR_PLAYABLE_MAPS[0].url), /下沉篇-第1部分\.json$/u);
});

test('playable map loader requests the actual game map without cache', async () => {
  let request = null;
  const map = await loadEditorPlayableMap('descent-2', {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => validMap };
    },
  });
  assert.equal(map, validMap);
  assert.match(decodeURI(request.url), /下沉篇-第2部分\.json$/u);
  assert.equal(request.options.cache, 'no-store');
});

test('playable map saver targets the guarded local editor API', async () => {
  let request = null;
  await saveEditorPlayableMap('descent-3', validMap, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(request.url, '/api/editor/maps/descent-3');
  assert.equal(request.options.method, 'PUT');
  assert.deepEqual(JSON.parse(request.options.body), validMap);
});

test('local writer only writes allowlisted playable map paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tfo-editor-map-'));
  try {
    const filePath = await writeEditorMap(root, 'descent-1', validMap);
    assert.equal(filePath, getEditorMapFilePath(root, 'descent-1'));
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), validMap);
    assert.throws(() => getEditorMapFilePath(root, '../../outside'), /Unknown playable map/);
    await assert.rejects(writeEditorMap(root, 'descent-1', { cells: {} }), /Invalid map document/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('map editor hides gameplay HUD and renders playable-map controls', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="official-map-select"/);
  assert.match(html, /id="save-official-map"/);
  assert.match(css, /\.canvas-stage > \.visor-hud,[\s\S]*\.canvas-stage > \.hud-attempts \{ display: none !important; \}/);
});
