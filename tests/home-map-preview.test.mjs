import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HOME_ENEMY_SHOWCASE,
  HOME_ENEMY_SWIM_DURATION_MS,
  HOME_HELMET_TURN_DURATION_MS,
  HOME_HELMET_TURN_FRAME_COUNT,
  HOME_NO_SIGNAL_DURATION_MS,
  getHomeEnemyAnimationFrames,
  getHomeEnemyFrameIndex,
  getHomeEnemySwimPosition,
  getHomeHelmetTurnFrame,
} from '../src/home-page.js';
import { HOME_PREVIEW_ROUTES } from '../src/home-map-preview.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

test('home contains the dark video, helmet turn, movable logo and final menu', () => {
  const html = read('../home.html');

  assert.match(html, /class="home-abyss-video" id="home-abyss-video" autoplay muted loop playsinline/);
  assert.match(html, /abyss-seafloor-ping-pong-v3-audio-067\.mp4/);
  assert.match(html, /id="home-intro"/);
  assert.match(html, /helmet-turn-00-front\.png/);
  assert.match(html, /helmet-turn-01\.png/);
  assert.match(html, /helmet-turn-02\.png/);
  assert.match(html, /abandoned-diving-helmet-left-v2\.png/);
  assert.match(html, /thirst-for-oxygen-logo-v2\.png/);
  assert.match(html, /id="home-main-menu"/);
  assert.match(html, /id="home-enemy-field"/);
  assert.match(html, /id="home-map-preview"/);
  assert.match(html, /id="home-no-signal"/);
  assert.match(html, /id="home-helmet-signal-trigger"/);
  assert.match(html, /Tap anywhere to begin/);
  assert.match(html, /href="\/play\.html"/);
  assert.match(html, /href="\/enemy-encyclopedia\.html"/);
  assert.match(html, /href="\/sandbox\.html"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/tutorial\.html"/);
  assert.doesNotMatch(html, /home-topbar|hero-copy|destination-grid|home-status/);
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

test('home brightens the abyss video and shrinks the helmet from front to side', () => {
  const css = read('../src/home.css');

  assert.match(css, /\.home-abyss-video[\s\S]*opacity: 0\.76/);
  assert.match(css, /brightness\(0\.68\)/);
  assert.match(css, /\.home-helmet-stage[\s\S]*scale\(0\.88\)/);
  assert.match(css, /\.home-intro\.is-side \.home-helmet-stage[\s\S]*translate3d\(27vw, 20vh, 0\) scale\(0\.72\)/);
  assert.match(css, /\.home-helmet-frame[\s\S]*brightness\(0\.5\)[\s\S]*saturate\(0\.55\)/);
  assert.match(css, /#home-map-preview[\s\S]*brightness\(0\.48\)[\s\S]*saturate\(0\.56\)/);
  assert.match(css, /\.home-menu-panel[\s\S]*top: 55\.5%/);
  assert.doesNotMatch(css, /\.home-logo-viewport\s*{[^}]*repeating-linear-gradient/);
  assert.match(css, /\.home-logo-viewport[\s\S]*radial-gradient\(circle at 50% 45%/);
  assert.match(css, /\.home-intro:not\(\.is-turning\):not\(\.is-side\)::before\s*{\s*opacity: 0/);
  assert.match(css, /\.home-intro:not\(\.is-turning\):not\(\.is-side\) \.home-helmet-stage[\s\S]*drop-shadow\(0 0 3px rgba\(255, 255, 255, 0\.92\)\)[\s\S]*drop-shadow\(0 0 46px/);
  assert.match(css, /\.home-logo-viewport img[\s\S]*top: 57%/);
  assert.match(css, /\.home-intro\.is-side \.home-logo-viewport[\s\S]*background: transparent/);
  assert.match(css, /@keyframes home-helmet-breathe-front[\s\S]*scale\(0\.887\)/);
  assert.match(css, /@keyframes home-helmet-breathe-side[\s\S]*scale\(0\.723\)/);
});

test('helmet map preview uses all three authored descent maps', () => {
  assert.deepEqual(HOME_PREVIEW_ROUTES.descent.map((route) => route.part), [1, 2, 3]);
  HOME_PREVIEW_ROUTES.descent.forEach((route) => {
    assert.equal(existsSync(`${ROOT}${decodeURIComponent(route.path).replaceAll('/', '\\')}`), true, route.path);
  });
});

test('helmet map preview exposes all three authored ascent maps', () => {
  assert.deepEqual(HOME_PREVIEW_ROUTES.ascent.map((route) => route.part), [1, 2, 3]);
  HOME_PREVIEW_ROUTES.ascent.forEach((route) => {
    assert.equal(existsSync(`${ROOT}${decodeURIComponent(route.path).replaceAll('/', '\\')}`), true, route.path);
  });
});

test('background enemies use real six-frame idle and skill animations', () => {
  assert.equal(HOME_ENEMY_SHOWCASE.length, 8);
  assert.equal(new Set(HOME_ENEMY_SHOWCASE.map((enemy) => enemy.enemyId)).size, 8);
  HOME_ENEMY_SHOWCASE.forEach((enemy) => {
    const idleFrames = getHomeEnemyAnimationFrames(enemy.enemyId);
    const actionFrames = getHomeEnemyAnimationFrames(enemy.enemyId, enemy.actionId);
    assert.equal(idleFrames.length, 6, `${enemy.enemyId} idle`);
    assert.equal(actionFrames.length, 6, `${enemy.enemyId} action`);
    [...idleFrames, ...actionFrames].forEach((assetPath) => {
      assert.equal(existsSync(`${ROOT}\\public${assetPath.replaceAll('/', '\\')}`), true, assetPath);
    });
  });
  assert.equal(getHomeEnemyFrameIndex(0), 0);
  assert.equal(getHomeEnemyFrameIndex(180), 1);
  assert.equal(getHomeEnemyFrameIndex(1080), 0);
});

test('eight left-facing swimmers travel right-to-left at three distinct speeds', () => {
  assert.equal(HOME_ENEMY_SWIM_DURATION_MS, 32000);
  assert.deepEqual(
    [...new Set(HOME_ENEMY_SHOWCASE.map((enemy) => enemy.swimDurationMs))].sort((a, b) => a - b),
    [26000, 34000, 44000],
  );
  HOME_ENEMY_SHOWCASE.forEach((_, index) => {
    const start = getHomeEnemySwimPosition(0, index, HOME_ENEMY_SHOWCASE.length);
    const later = getHomeEnemySwimPosition(1000, index, HOME_ENEMY_SHOWCASE.length);
    assert.equal(start.direction, 'left');
    assert.ok(later.xVw < start.xVw, `enemy ${index} should move left`);
  });
  for (let elapsedMs = 0; elapsedMs <= 600000; elapsedMs += 1000) {
    const positions = HOME_ENEMY_SHOWCASE.map((_, index) => (
      getHomeEnemySwimPosition(elapsedMs, index, HOME_ENEMY_SHOWCASE.length)
    ));
    const visibleCount = positions.filter(({ xVw }) => xVw >= -12 && xVw <= 100).length;
    assert.ok(visibleCount >= 5, `${elapsedMs}ms should retain at least five swimmers, got ${visibleCount}`);
  }
});

test('helmet no-signal easter egg stays brief and leaves the map underneath', () => {
  const html = read('../home.html');
  const css = read('../src/home.css');
  assert.equal(HOME_NO_SIGNAL_DURATION_MS, 950);
  assert.match(html, /<canvas id="home-map-preview"[\s\S]*id="home-no-signal"/);
  assert.match(css, /\.home-helmet-stage[\s\S]*pointer-events: none/);
  assert.match(css, /\.home-intro\.is-side \.home-helmet-signal-trigger:not\(:disabled\)[\s\S]*pointer-events: auto/);
});

test('homepage focus feedback does not draw frames around settings or the helmet', () => {
  const homeCss = read('../src/home.css');
  const settingsCss = read('../src/settings.css');

  assert.match(homeCss, /\.home-helmet-signal-trigger:focus-visible\s*{\s*outline: none;/);
  assert.doesNotMatch(homeCss, /\.home-helmet-signal-trigger:focus-visible\s*{[^}]*outline-offset/);
  assert.match(settingsCss, /\.home-menu-button\s*{[^}]*border: 0;/);
  assert.match(settingsCss, /\.home-menu-button:focus-visible\s*{\s*outline: none;\s*box-shadow: inset 3px 0/);
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
  assert.match(page, /mainMenu\.toggleAttribute\('inert'/);
  assert.match(page, /attachHomeMapPreview\(homeRoot\)/);
  assert.match(page, /attachHomeMusic\(document, \{ controlsRoot:/);
  assert.match(page, /eventTarget\.addEventListener\('pointermove'/);
  assert.match(page, /window\.triggerHomeEnemySkill/);
  assert.match(page, /window\.triggerHomeNoSignal/);
  assert.match(css, /mask-image: radial-gradient\(circle 250px at var\(--flashlight-x\) var\(--flashlight-y\)/);
  assert.match(css, /@keyframes helmet-frame-front/);
  assert.match(css, /@keyframes helmet-frame-one/);
  assert.match(css, /@keyframes helmet-frame-two/);
  assert.match(css, /@keyframes helmet-frame-side/);
  assert.match(css, /@keyframes home-menu-reveal/);
  assert.match(css, /@keyframes home-map-lens-reveal/);
  assert.match(css, /@keyframes home-no-signal-static/);
  assert.match(css, /@keyframes home-tap-pulse/);
});
