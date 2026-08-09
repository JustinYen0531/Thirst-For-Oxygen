import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HOME_PREVIEW_ROUTES,
  getHomePreviewDurations,
  getHomePreviewPlaybackState,
} from '../src/home-map-preview.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

test('home helmet preview uses the authored descent maps in walkthrough order', () => {
  assert.deepEqual(HOME_PREVIEW_ROUTES.descent.map((route) => route.part), [1, 2, 3]);
  HOME_PREVIEW_ROUTES.descent.forEach((route) => {
    const filePath = `${ROOT}${decodeURIComponent(route.path).replaceAll('/', '\\')}`;
    assert.equal(existsSync(filePath), true, route.path);
    assert.equal(route.url.startsWith('file:') || route.url.startsWith('http'), true);
  });
  assert.deepEqual(HOME_PREVIEW_ROUTES.ascent, []);
});

test('home walkthrough moves down each map before advancing to the next part', () => {
  const routes = HOME_PREVIEW_ROUTES.descent.map((route, index) => ({
    ...route,
    height: [160, 88, 117][index],
  }));
  const durations = getHomePreviewDurations(routes);
  assert.equal(durations[0].moveSeconds > durations[1].moveSeconds, true);

  const part1Middle = getHomePreviewPlaybackState(durations[0].moveSeconds / 2, routes);
  assert.equal(part1Middle.partIndex, 0);
  assert.equal(part1Middle.progress > 0.45 && part1Middle.progress < 0.55, true);

  const part2StartAt = durations[0].moveSeconds + durations[0].transitionSeconds + 0.01;
  const part2Start = getHomePreviewPlaybackState(part2StartAt, routes);
  assert.equal(part2Start.partIndex, 1);
  assert.equal(part2Start.progress < 0.01, true);
});

test('home markup replaces the old placeholder with a convex real-map helmet player', () => {
  const html = read('../home.html');
  const css = read('../src/home.css');
  const page = read('../src/home-page.js');
  const preview = read('../src/home-map-preview.js');

  assert.match(html, /id="home-map-preview"/);
  assert.match(html, /abandoned-diving-helmet-map-frame\.png/);
  assert.match(html, /下沉篇第一至第三部分真實地圖自動巡覽/);
  assert.match(html, /上浮篇 <small>地圖待接入<\/small>/);
  assert.doesNotMatch(html, /hero-player|T1 \/ L1|O₂ 72%/);
  assert.match(css, /\.helmet-lens/);
  assert.match(css, /helmet-lens-reflection/);
  assert.match(page, /attachHomeMapPreview/);
  assert.match(preview, /drawConvexMap/);
  assert.match(preview, /window\.advanceHomePreview/);
});
