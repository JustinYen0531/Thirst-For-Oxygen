import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HOME_LENS_WARP,
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
  assert.match(html, /abandoned-diving-helmet-left-v2\.png/);
  assert.match(html, /下沉篇第一至第三部分真實地圖自動巡覽/);
  assert.match(html, /上浮篇 <small>地圖待接入<\/small>/);
  assert.doesNotMatch(html, /hero-player|T1 \/ L1|O₂ 72%/);
  assert.doesNotMatch(html, /helmet-sediment|abandoned-diving-helmet-map-frame/);
  assert.match(css, /\.helmet-lens/);
  assert.match(css, /helmet-lens-reflection/);
  assert.match(page, /attachHomeMapPreview/);
  assert.match(preview, /drawConvexMap/);
  assert.match(preview, /window\.advanceHomePreview/);
});

test('home helmet uses an unmistakable convex warp instead of a subtle zoom', () => {
  assert.equal(HOME_LENS_WARP.horizontalEdgeScale < 0.9, true);
  assert.equal(HOME_LENS_WARP.horizontalCenterScale > 1.1, true);
  assert.equal(HOME_LENS_WARP.verticalEdgeScale < 0.9, true);
  assert.equal(HOME_LENS_WARP.verticalCenterScale > 1.1, true);
});

test('home helmet asset is the isolated transparent cutout', () => {
  const helmetPath = fileURLToPath(new URL('../public/assets/home/abandoned-diving-helmet-left-v2.png', import.meta.url));
  const rejectedScenePath = fileURLToPath(new URL('../public/assets/home/abandoned-diving-helmet-map-frame.png', import.meta.url));
  const png = readFileSync(helmetPath);

  assert.equal(existsSync(rejectedScenePath), false);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1568);
  assert.equal(png.readUInt32BE(20), 1003);
  assert.equal(png[25], 6, 'PNG must preserve RGBA transparency');
});

test('home uses the prepared slow ping-pong abyss video behind a lower 1.2x helmet', () => {
  const html = read('../home.html');
  const css = read('../src/home.css');
  const videoPath = fileURLToPath(new URL('../public/assets/home/abyss-seafloor-ping-pong-067.mp4', import.meta.url));

  assert.match(html, /<video class="home-abyss-video" autoplay muted loop playsinline/);
  assert.match(html, /abyss-seafloor-ping-pong-067\.mp4/);
  assert.equal(existsSync(videoPath), true);
  assert.equal(readFileSync(videoPath).byteLength > 1_000_000, true);
  assert.match(css, /\.home-abyss-video/);
  assert.match(css, /transform: translate\(-5%, 7%\) scale\(1\.2\)/);
});
