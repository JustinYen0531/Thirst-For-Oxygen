import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HOME_BACKGROUND_VIDEO_VOLUME,
  HOME_LOADING_VIDEO_START_SECONDS,
  HOME_LOADING_VIDEO_VOLUME,
  HOME_LOADING_VISUAL_DURATION_MS,
  HOME_MENU_EXIT_DURATION_MS,
  attachHomeBackgroundVideoAudio,
  attachHomeStartLoading,
  getHomeLoadingDisplayRatio,
  playHomeLoadingVideo,
  preloadHomeGameAssets,
} from '../src/home-start-loading.js';
import {
  PLAY_IMAGE_ASSET_PATHS,
  PLAY_MAP_ASSET_URLS,
  PLAY_STARTUP_ASSET_PATHS,
  PLAY_TILE_ASSETS,
} from '../src/play-preload.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

test('Start Game owns a cinematic loading layer with real progress semantics', () => {
  const html = read('../home.html');
  const css = read('../src/home.css');
  const page = read('../src/home-page.js');

  assert.match(html, /id="home-start-game" href="\/play\.html"/);
  assert.match(html, /id="home-start-loading-video"[\s\S]*start-game-descent-loading\.mp4/);
  assert.match(html, /id="home-start-loading-progress" role="progressbar"[\s\S]*aria-valuenow="0"/);
  assert.match(html, /id="home-submission-badge"[\s\S]*Submission to Ultimate AI-Powered Game Jam #2[\s\S]*Topic: Dive &amp; Buddy/);
  assert.match(html, /id="home-creator-badge"[\s\S]*Made By Ratio &amp; AIs/);
  assert.match(css, /\.home-intro\.is-starting-game \.home-menu-panel[\s\S]*opacity: 0;[\s\S]*translateX\(-48px\)/);
  assert.match(css, /\.home-intro\.is-starting-game \.home-menu-panel[\s\S]*z-index: 8;[\s\S]*home-menu-start-exit 900ms/);
  assert.match(css, /\.home-intro\.is-starting-game \.home-start-loading[\s\S]*opacity: 1/);
  assert.match(css, /\.home-intro\.is-starting-game \.home-submission-badge[\s\S]*opacity: 1/);
  assert.match(page, /attachHomeStartLoading\(homeRoot/);
});

test('homepage ambient and loading movies both preserve authored audio files', () => {
  const html = read('../home.html');
  assert.match(html, /abyss-seafloor-ping-pong-v3-audio-067\.mp4/);
  assert.equal(existsSync(`${ROOT}\\public\\assets\\home\\abyss-seafloor-ping-pong-v3-audio-067.mp4`), true);
  assert.equal(existsSync(`${ROOT}\\public\\assets\\home\\start-game-descent-loading.mp4`), true);
  assert.ok(HOME_BACKGROUND_VIDEO_VOLUME >= 0.8);
  assert.ok(HOME_LOADING_VIDEO_VOLUME >= 0.85);
  assert.equal(HOME_LOADING_VIDEO_START_SECONDS, 3);
  assert.equal(HOME_MENU_EXIT_DURATION_MS, 900);
  assert.equal(HOME_LOADING_VISUAL_DURATION_MS, 12000);
});

test('visual loading progress reaches 100% only at the twelve-second mark', () => {
  assert.equal(getHomeLoadingDisplayRatio(1, 0), 0);
  assert.equal(getHomeLoadingDisplayRatio(1, 3000), 0.25);
  assert.equal(getHomeLoadingDisplayRatio(1, 6000), 0.5);
  assert.equal(getHomeLoadingDisplayRatio(1, 11900) < 1, true);
  assert.equal(getHomeLoadingDisplayRatio(1, 12000), 1);
  assert.equal(getHomeLoadingDisplayRatio(0.4, 12000), 0.4);
});

test('loading movie skips its slow opening and begins at the authored third second', async () => {
  class FakeVideo extends EventTarget {
    constructor() {
      super();
      this.currentTime = 0;
      this.muted = true;
      this.readyState = 1;
      this.volume = 0;
    }
    play() {
      queueMicrotask(() => this.dispatchEvent(new Event('ended')));
      return Promise.resolve();
    }
  }
  const video = new FakeVideo();
  assert.equal(await playHomeLoadingVideo(video, { timeoutMs: 1000 }), 'ended');
  assert.equal(video.currentTime, 3);
  assert.equal(video.muted, false);
});

test('formal Play knows every runtime image while homepage startup warms only the critical reveal assets', () => {
  assert.ok(PLAY_IMAGE_ASSET_PATHS.length > 300);
  assert.equal(new Set(PLAY_STARTUP_ASSET_PATHS).size, PLAY_STARTUP_ASSET_PATHS.length);
  assert.ok(PLAY_STARTUP_ASSET_PATHS.length < 24, 'homepage must not decode hundreds of animation frames before navigation');
  assert.ok(PLAY_STARTUP_ASSET_PATHS.includes(PLAY_MAP_ASSET_URLS.descent[1]));
  assert.equal(PLAY_STARTUP_ASSET_PATHS.some((path) => path.includes('/enemies-afterimage/')), false);
  assert.equal(PLAY_STARTUP_ASSET_PATHS.filter((path) => path.includes('/actors/player/swim/')).length, 6);
  Object.values(PLAY_TILE_ASSETS).forEach((path) => assert.ok(PLAY_IMAGE_ASSET_PATHS.includes(path), path));
  PLAY_IMAGE_ASSET_PATHS.forEach((path) => {
    assert.equal(existsSync(`${ROOT}\\public${decodeURIComponent(path).replaceAll('/', '\\')}`), true, path);
  });
  assert.equal(existsSync(fileURLToPath(PLAY_MAP_ASSET_URLS.descent[1])), true);
});

test('asset progress advances only when real load attempts settle and records fallbacks', async () => {
  const snapshots = [];
  const result = await preloadHomeGameAssets(['/a.png', '/b.png', '/a.png', '/c.json'], {
    concurrency: 2,
    loadAsset: async (path) => {
      if (path === '/b.png') throw new Error('missing');
      return path;
    },
    onProgress: (state) => snapshots.push(state),
  });

  assert.equal(result.total, 3);
  assert.equal(result.completed, 3);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.failures, ['/b.png']);
  assert.equal(result.ratio, 1);
  assert.equal(snapshots[0].completed, 0);
  assert.equal(snapshots.at(-1).completed, 3);
});

test('main-menu movie unlocks strong audio on the first player gesture', async () => {
  class FakeVideo {
    constructor() {
      this.muted = true;
      this.volume = 0;
      this.playCount = 0;
      this.pauseCount = 0;
    }
    play() { this.playCount += 1; return Promise.resolve(); }
    pause() { this.pauseCount += 1; }
  }
  const target = new EventTarget();
  const video = new FakeVideo();
  const audio = attachHomeBackgroundVideoAudio(video, target);
  target.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();

  assert.equal(video.muted, false);
  assert.equal(video.volume, HOME_BACKGROUND_VIDEO_VOLUME);
  assert.equal(video.playCount, 1);
  audio.stop();
  assert.equal(video.muted, true);
  assert.equal(video.pauseCount, 1);
});

test('Start Game waits for both the movie and asset work before navigating', async () => {
  class FakeElement extends EventTarget {
    constructor(attributes = {}) {
      super();
      this.attributes = new Map(Object.entries(attributes));
      this.classNames = new Set();
      this.classList = { add: (...names) => names.forEach((name) => this.classNames.add(name)) };
      this.hidden = true;
      this.pauseCount = 0;
      this.style = {};
      this.textContent = '';
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    pause() { this.pauseCount += 1; }
  }

  const startLink = new FakeElement({ href: '/play.html' });
  const loadingLayer = new FakeElement();
  const loadingVideo = new FakeElement();
  const progress = new FakeElement();
  const progressFill = new FakeElement();
  const percentage = new FakeElement();
  const status = new FakeElement();
  const mainMenu = new FakeElement();
  const elements = new Map([
    ['#home-start-game', startLink],
    ['#home-start-loading', loadingLayer],
    ['#home-start-loading-video', loadingVideo],
    ['#home-start-loading-progress', progress],
    ['[data-home-loading-fill]', progressFill],
    ['#home-start-loading-percentage', percentage],
    ['#home-start-loading-status', status],
    ['#home-main-menu', mainMenu],
  ]);
  const root = new FakeElement();
  root.querySelector = (selector) => elements.get(selector) ?? null;
  const navigation = [];
  let finishVideo;
  const videoResult = new Promise((resolve) => { finishVideo = () => resolve('ended'); });
  let loadedAssets = 0;
  const controller = attachHomeStartLoading(root, {
    assetPaths: ['/player.png', '/map.json'],
    loadAsset: async () => { loadedAssets += 1; return true; },
    navigate: (href) => navigation.push(href),
    playVideo: () => videoResult,
    minimumExitMs: 0,
    visualDurationMs: 0,
  });

  const startPromise = controller.start({ preventDefault() {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(loadedAssets, 2);
  assert.deepEqual(navigation, []);
  finishVideo();
  await startPromise;
  assert.equal(loadingLayer.hidden, false);
  assert.equal(progress.getAttribute('aria-valuenow'), '100');
  assert.equal(progressFill.style.width, '100%');
  assert.equal(percentage.textContent, '100%');
  assert.deepEqual(navigation, ['/play.html']);
  assert.equal(loadingVideo.pauseCount, 1);
  assert.deepEqual(controller.getState(), {
    active: true,
    completed: 2,
    failed: 0,
    failures: [],
    ratio: 1,
    total: 2,
    video: 'ended',
  });
});
