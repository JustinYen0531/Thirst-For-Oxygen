import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HOME_HELMET_TURN_DURATION_MS,
  HOME_HELMET_TURN_FRAME_COUNT,
  getHomeHelmetTurnFrame,
} from '../src/home-page.js';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

test('home is reduced to the dark video, centered helmet, logo and turn frames', () => {
  const html = read('../home.html');

  assert.match(html, /class="home-abyss-video" autoplay muted loop playsinline/);
  assert.match(html, /abyss-seafloor-ping-pong-067\.mp4/);
  assert.match(html, /id="home-intro"/);
  assert.match(html, /helmet-turn-00-front\.png/);
  assert.match(html, /helmet-turn-01\.png/);
  assert.match(html, /helmet-turn-02\.png/);
  assert.match(html, /abandoned-diving-helmet-left-v2\.png/);
  assert.match(html, /thirst-for-oxygen-logo-v2\.png/);
  assert.doesNotMatch(html, /home-topbar|hero-copy|destination-grid|home-status|home-music-control|home-map-preview/);
});

test('all homepage helmet and logo assets are RGBA PNG files', () => {
  const assetNames = [
    'helmet-turn-00-front.png',
    'helmet-turn-01.png',
    'helmet-turn-02.png',
    'abandoned-diving-helmet-left-v2.png',
    'thirst-for-oxygen-logo-v2.png',
  ];

  assetNames.forEach((assetName) => {
    const assetPath = fileURLToPath(new URL(`../public/assets/home/${assetName}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, assetName);
    const png = readFileSync(assetPath);
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', assetName);
    assert.equal(png[25], 6, `${assetName} must preserve RGBA transparency`);
  });
});

test('home keeps the abyss video dark while the front helmet starts largest', () => {
  const css = read('../src/home.css');

  assert.match(css, /\.home-abyss-video[\s\S]*opacity: 0\.42/);
  assert.match(css, /brightness\(0\.42\)/);
  assert.match(css, /\.home-helmet-stage[\s\S]*scale\(1\.1\)/);
  assert.match(css, /\.home-intro\.is-side \.home-helmet-stage[\s\S]*scale\(0\.9\)/);
});

test('helmet turn advances through four frames and ends on the side frame', () => {
  assert.equal(HOME_HELMET_TURN_FRAME_COUNT, 4);
  assert.equal(HOME_HELMET_TURN_DURATION_MS, 1250);
  assert.equal(getHomeHelmetTurnFrame(0), 0);
  assert.equal(getHomeHelmetTurnFrame(400), 1);
  assert.equal(getHomeHelmetTurnFrame(700), 2);
  assert.equal(getHomeHelmetTurnFrame(1250), 3);
  assert.equal(getHomeHelmetTurnFrame(5000), 3);
});

test('homepage supports click-anywhere, keyboard input and deterministic text state', () => {
  const page = read('../src/home-page.js');
  const css = read('../src/home.css');

  assert.match(page, /eventTarget\.addEventListener\('pointerdown'/);
  assert.match(page, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(page, /window\.advanceTime/);
  assert.match(page, /window\.render_game_to_text/);
  assert.match(css, /@keyframes helmet-frame-front/);
  assert.match(css, /@keyframes helmet-frame-one/);
  assert.match(css, /@keyframes helmet-frame-two/);
  assert.match(css, /@keyframes helmet-frame-side/);
  assert.match(css, /@keyframes helmet-visor-turn/);
});
