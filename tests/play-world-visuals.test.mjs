import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {
  CELL_OBJECT_TYPES,
  EDGE_TYPES,
  OVERLAY_TYPES,
} from '../src/map-model.js';
import {
  PLAY_EDGE_VISUALS,
  PLAY_OBJECT_VISUALS,
  PLAY_OVERLAY_VISUALS,
  getPlayEdgeVisual,
  getPlayObjectVisual,
  getPlayOverlayVisual,
  getPlayWorldAssetPaths,
  getPlayWorldVisual,
} from '../src/play-world-visuals.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const publicPath = (url) => path.join(ROOT, 'public', url.replace(/^\//, ''));
const entries = (collection) => Object.values(collection);

test('formal play visual contract covers every Cell object, overlay, and non-erase Edge', () => {
  assert.deepEqual(Object.keys(PLAY_OBJECT_VISUALS), [...CELL_OBJECT_TYPES]);
  assert.deepEqual(Object.keys(PLAY_OVERLAY_VISUALS), [...OVERLAY_TYPES]);
  assert.deepEqual(Object.keys(PLAY_EDGE_VISUALS), EDGE_TYPES.filter((type) => type !== 'none'));
  entries(PLAY_OBJECT_VISUALS).forEach((entry) => assert.equal(entry.edgeAttached, false));
  entries(PLAY_OVERLAY_VISUALS).forEach((entry) => assert.equal(entry.overlay, true));
  entries(PLAY_EDGE_VISUALS).forEach((entry) => assert.equal(entry.edgeAttached, true));
});

test('every declared bitmap exists and every available world bitmap is reused', () => {
  const visuals = [
    ...entries(PLAY_OBJECT_VISUALS),
    ...entries(PLAY_OVERLAY_VISUALS),
    ...entries(PLAY_EDGE_VISUALS),
  ];
  const declaredPaths = new Set(visuals.flatMap(({ assetPath, componentAssetPaths }) => [assetPath, ...componentAssetPaths]).filter(Boolean));
  declaredPaths.forEach((assetPath) => {
    assert.equal(existsSync(publicPath(assetPath)), true, `formal play asset should exist at ${assetPath}`);
  });

  const availablePaths = [
    ...readdirSync(path.join(ROOT, 'public/assets/editor/objects')).map((name) => `/assets/editor/objects/${name}`),
    ...readdirSync(path.join(ROOT, 'public/assets/editor/edges')).map((name) => `/assets/editor/edges/${name}`),
  ];
  assert.deepEqual([...declaredPaths].sort(), availablePaths.sort());
});

test('button and ink have deterministic programmatic fallbacks without a broken button path', () => {
  const button = getPlayObjectVisual('button');
  assert.equal(button.assetPath, null);
  assert.equal(button.usesProgrammaticFallback, true);
  assert.equal(button.shape, 'button-glyph');
  assert.equal(button.label, '⏺');
  assert.equal(JSON.stringify(button).includes('button.png'), false);

  const ink = getPlayOverlayVisual('ink');
  assert.equal(ink.shape, 'ink-cloud');
  assert.equal(ink.overlay, true);
  assert.ok(ink.label);
});

test('current is a cyan programmatic mechanism and never borrows the red spike visual', () => {
  const current = getPlayEdgeVisual('current');
  const spike = getPlayEdgeVisual('spike');
  assert.equal(current.assetPath, null);
  assert.equal(current.usesProgrammaticFallback, true);
  assert.equal(current.shape, 'current-chevrons');
  assert.match(current.color, /^#52d9ff$/i);
  assert.notEqual(current.assetPath, spike.assetPath);
  assert.notEqual(current.shape, spike.shape);
  assert.notEqual(current.color, spike.color);
});

test('barrier and spike stay visually and semantically distinct', () => {
  const barrier = getPlayEdgeVisual('barrier');
  const spike = getPlayEdgeVisual('spike');
  assert.equal(barrier.hazardous, false);
  assert.equal(spike.hazardous, true);
  assert.equal(barrier.blocksPassage, true);
  assert.equal(spike.blocksPassage, true);
  assert.notEqual(barrier.assetPath, spike.assetPath);
  assert.notEqual(barrier.shape, spike.shape);
  assert.notEqual(barrier.color, spike.color);
});

test('lookup API returns frozen contracts and reports unknown ids', () => {
  assert.equal(getPlayWorldVisual('object', 'oxygen'), PLAY_OBJECT_VISUALS.oxygen);
  assert.equal(getPlayWorldVisual('overlay', 'ink'), PLAY_OVERLAY_VISUALS.ink);
  assert.equal(getPlayWorldVisual('edge', 'current'), PLAY_EDGE_VISUALS.current);
  assert.equal(Object.isFrozen(PLAY_EDGE_VISUALS.current), true);
  assert.throws(() => getPlayWorldVisual('edge', 'none'), /Unknown edge visual/);
  assert.throws(() => getPlayWorldVisual('terrain', 'water'), /Unknown play world visual category/);
  assert.equal(getPlayWorldAssetPaths().length, 15);
});
