import { getLanguage, translateText } from './i18n.js';

export const HOME_BACKGROUND_VIDEO_VOLUME = 0.82;
export const HOME_LOADING_VIDEO_VOLUME = 0.9;
export const HOME_LOADING_CONCURRENCY = 8;

function isImagePath(path) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(path);
}

export async function loadHomeGameAsset(path, options = {}) {
  const ImageCtor = options.ImageCtor ?? globalThis.Image;
  if (isImagePath(path) && typeof ImageCtor === 'function') {
    const image = new ImageCtor();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error(`Failed to preload ${path}`)), { once: true });
      image.src = path;
    });
    if (typeof image.decode === 'function') {
      try { await image.decode(); } catch { /* The load event already proved the image is usable. */ }
    }
    return path;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error(`No loader available for ${path}`);
  const response = await fetchImpl(path, { cache: 'force-cache' });
  if (!response?.ok) throw new Error(`Failed to preload ${path}`);
  await response.arrayBuffer();
  return path;
}

export async function preloadHomeGameAssets(paths, options = {}) {
  const uniquePaths = [...new Set((paths ?? []).filter(Boolean))];
  const total = uniquePaths.length;
  const loadAsset = options.loadAsset ?? ((path) => loadHomeGameAsset(path, options));
  const concurrency = Math.max(1, Math.min(total || 1, Number(options.concurrency) || HOME_LOADING_CONCURRENCY));
  let cursor = 0;
  let completed = 0;
  const failures = [];

  const report = () => {
    const state = Object.freeze({
      completed,
      failed: failures.length,
      failures: Object.freeze([...failures]),
      ratio: total === 0 ? 1 : completed / total,
      total,
    });
    options.onProgress?.(state);
    return state;
  };

  report();
  async function worker() {
    while (cursor < total) {
      const path = uniquePaths[cursor];
      cursor += 1;
      try {
        await loadAsset(path);
      } catch {
        failures.push(path);
      }
      completed += 1;
      report();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return report();
}

export function attachHomeBackgroundVideoAudio(video, eventTarget = globalThis.document, options = {}) {
  if (!video || !eventTarget?.addEventListener) return null;
  const volume = Math.max(0, Math.min(1, Number(options.volume) || HOME_BACKGROUND_VIDEO_VOLUME));
  let unlocked = false;

  function cleanup() {
    eventTarget.removeEventListener('pointerdown', onPointerDown);
    eventTarget.removeEventListener('keydown', onKeyDown);
  }

  async function unlock() {
    if (unlocked) return true;
    video.volume = volume;
    video.muted = false;
    try {
      await Promise.resolve(video.play?.());
      unlocked = true;
      cleanup();
      return true;
    } catch {
      video.muted = true;
      return false;
    }
  }

  function onPointerDown() {
    void unlock();
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') void unlock();
  }

  eventTarget.addEventListener('pointerdown', onPointerDown);
  eventTarget.addEventListener('keydown', onKeyDown);
  return {
    stop() {
      cleanup();
      video.muted = true;
      video.pause?.();
    },
    unlock,
  };
}

function playLoadingVideo(video, options = {}) {
  if (!video) return Promise.resolve('missing');
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 20000);
  video.currentTime = 0;
  video.volume = Math.max(0, Math.min(1, Number(options.volume) || HOME_LOADING_VIDEO_VOLUME));
  video.muted = false;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout?.(timeoutId);
      video.removeEventListener?.('ended', onEnded);
      video.removeEventListener?.('error', onError);
      resolve(result);
    };
    const onEnded = () => finish('ended');
    const onError = () => finish('error');
    const timeoutId = globalThis.setTimeout?.(() => finish('timeout'), timeoutMs);
    video.addEventListener?.('ended', onEnded, { once: true });
    video.addEventListener?.('error', onError, { once: true });
    try {
      const request = video.play?.();
      if (request?.catch) request.catch(onError);
    } catch {
      onError();
    }
  });
}

export function attachHomeStartLoading(root, options = {}) {
  if (!root) return null;
  const startLink = root.querySelector('#home-start-game');
  const loadingLayer = root.querySelector('#home-start-loading');
  const loadingVideo = root.querySelector('#home-start-loading-video');
  const progress = root.querySelector('#home-start-loading-progress');
  const progressFill = root.querySelector('[data-home-loading-fill]');
  const percentage = root.querySelector('#home-start-loading-percentage');
  const status = root.querySelector('#home-start-loading-status');
  const mainMenu = root.querySelector('#home-main-menu');
  if (!startLink || !loadingLayer || !loadingVideo || !progress || !progressFill || !percentage || !status) return null;

  const destination = startLink.getAttribute('href') || '/play.html';
  const navigate = options.navigate ?? ((href) => globalThis.location?.assign?.(href));
  let active = false;
  let state = Object.freeze({ active: false, completed: 0, failed: 0, ratio: 0, total: 0, video: 'idle' });

  function renderProgress(nextState) {
    state = Object.freeze({ ...state, ...nextState });
    const percent = Math.round(Math.max(0, Math.min(1, state.ratio || 0)) * 100);
    progress.setAttribute('aria-valuenow', String(percent));
    progressFill.style.width = `${percent}%`;
    percentage.textContent = `${percent}%`;
  }

  async function start(event) {
    event?.preventDefault?.();
    if (active) return false;
    active = true;
    root.classList.add('is-starting-game');
    root.setAttribute('aria-busy', 'true');
    loadingLayer.hidden = false;
    loadingLayer.setAttribute('aria-hidden', 'false');
    mainMenu?.setAttribute('inert', '');
    startLink.setAttribute('aria-disabled', 'true');
    options.beforeStart?.();
    renderProgress({ active: true, ratio: 0, video: 'playing' });

    const videoPromise = (options.playVideo ?? playLoadingVideo)(loadingVideo, options.videoOptions);
    const assetPaths = options.assetPaths ?? (await import('./play-preload.js')).PLAY_STARTUP_ASSET_PATHS;
    const assetsPromise = preloadHomeGameAssets(assetPaths, {
      concurrency: options.concurrency,
      loadAsset: options.loadAsset,
      onProgress: renderProgress,
    });
    const [videoResult, assetResult] = await Promise.all([videoPromise, assetsPromise]);
    const language = getLanguage();
    status.textContent = translateText(
      assetResult.failed > 0 ? 'home.loading.readyWithFallbacks' : 'home.loading.ready',
      language,
    ).replace('{count}', String(assetResult.failed));
    root.classList.add('is-start-ready');
    root.removeAttribute('aria-busy');
    state = Object.freeze({ ...state, ...assetResult, active: true, video: videoResult });
    navigate(destination);
    return true;
  }

  startLink.addEventListener('click', start);
  return { getState: () => state, start };
}
