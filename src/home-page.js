import { attachHomeMapPreview } from './home-map-preview.js';
import {
  PLAY_ENEMY_FRAME_DURATION,
  PLAY_ENEMY_VISUAL_SETS,
  getPlayEnemyFramePaths,
} from './play-enemies.js';

export const HOME_HELMET_TURN_DURATION_MS = 1250;
export const HOME_HELMET_TURN_FRAME_COUNT = 4;
export const HOME_ENEMY_FRAME_DURATION_MS = PLAY_ENEMY_FRAME_DURATION * 1000;

export const HOME_ENEMY_SHOWCASE = Object.freeze([
  Object.freeze({ enemyId: 'crabGuard', label: '螃蟹守衛', actionId: 'clawSwipe', actionLabel: '螯擊' }),
  Object.freeze({ enemyId: 'lionfishGunner', label: '獅子魚砲手', actionId: 'spineScatter', actionLabel: '棘刺散射' }),
  Object.freeze({ enemyId: 'arcTideRay', label: '弧潮獵鰩', actionId: 'arcTideBombardment', actionLabel: '弧潮轟炸' }),
]);

export function getHomeHelmetTurnFrame(elapsedMs, durationMs = HOME_HELMET_TURN_DURATION_MS) {
  const safeDuration = Math.max(1, Number(durationMs) || HOME_HELMET_TURN_DURATION_MS);
  const progress = Math.min(1, Math.max(0, Number(elapsedMs) || 0) / safeDuration);
  return Math.min(HOME_HELMET_TURN_FRAME_COUNT - 1, Math.floor(progress * HOME_HELMET_TURN_FRAME_COUNT));
}

export function getHomeEnemyFrameIndex(elapsedMs, frameCount = 6, loop = true) {
  const safeFrameCount = Math.max(1, Math.floor(Number(frameCount) || 1));
  const rawIndex = Math.floor(Math.max(0, Number(elapsedMs) || 0) / HOME_ENEMY_FRAME_DURATION_MS);
  return loop ? rawIndex % safeFrameCount : Math.min(safeFrameCount - 1, rawIndex);
}

export function getHomeEnemyAnimationFrames(enemyId, actionId = null) {
  const visualSet = PLAY_ENEMY_VISUAL_SETS[enemyId];
  const animatedPath = actionId ? visualSet?.actions?.[actionId] : visualSet?.idle;
  return getPlayEnemyFramePaths(animatedPath);
}

export function attachHomeEnemyShowcase(root, options = {}) {
  const field = root?.querySelector('#home-enemy-field');
  if (!field) return null;

  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelFrame ?? window.cancelAnimationFrame.bind(window);
  let clockMs = 0;
  let lastFrameAt = performance.now();
  let animationFrame = 0;

  const enemies = HOME_ENEMY_SHOWCASE.map((config, index) => {
    const idleFrames = getHomeEnemyAnimationFrames(config.enemyId);
    const actionFrames = getHomeEnemyAnimationFrames(config.enemyId, config.actionId);
    const button = document.createElement('button');
    const image = document.createElement('img');
    button.type = 'button';
    button.className = `home-enemy home-enemy--${config.enemyId}`;
    button.dataset.enemyId = config.enemyId;
    button.style.setProperty('--enemy-index', String(index));
    button.setAttribute('aria-label', `${config.label}：播放${config.actionLabel}`);
    image.alt = '';
    image.draggable = false;
    image.src = idleFrames[0] ?? '';
    button.append(image);
    field.append(button);

    [...idleFrames, ...actionFrames].forEach((path) => {
      const preload = new Image();
      preload.src = path;
    });

    const state = {
      ...config,
      actionFrames,
      button,
      idleFrames,
      image,
      mode: 'idle',
      sequence: 0,
      startedAt: 0,
    };

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      state.mode = 'action';
      state.sequence += 1;
      state.startedAt = clockMs;
      button.classList.add('is-using-skill');
      button.dataset.animation = config.actionId;
    });
    return state;
  });

  function render() {
    enemies.forEach((enemy, index) => {
      if (enemy.mode === 'action' && clockMs - enemy.startedAt >= enemy.actionFrames.length * HOME_ENEMY_FRAME_DURATION_MS) {
        enemy.mode = 'idle';
        enemy.startedAt = clockMs;
        enemy.button.classList.remove('is-using-skill');
        enemy.button.dataset.animation = 'idle';
      }
      const frames = enemy.mode === 'action' ? enemy.actionFrames : enemy.idleFrames;
      const elapsedMs = enemy.mode === 'action'
        ? clockMs - enemy.startedAt
        : clockMs + index * HOME_ENEMY_FRAME_DURATION_MS * 1.7;
      const frameIndex = getHomeEnemyFrameIndex(elapsedMs, frames.length, enemy.mode === 'idle');
      const nextPath = frames[frameIndex];
      if (nextPath && enemy.image.dataset.framePath !== nextPath) {
        enemy.image.src = nextPath;
        enemy.image.dataset.framePath = nextPath;
      }
    });
  }

  function frame(now) {
    clockMs += Math.min(100, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;
    render();
    animationFrame = requestFrame(frame);
  }

  function trigger(enemyId) {
    const enemy = enemies.find((entry) => entry.enemyId === enemyId);
    if (!enemy) return false;
    enemy.button.click();
    render();
    return true;
  }

  render();
  animationFrame = requestFrame(frame);
  return {
    advance(ms) {
      clockMs += Math.max(0, Number(ms) || 0);
      render();
    },
    destroy() {
      cancelFrame(animationFrame);
    },
    getState: () => enemies.map((enemy) => ({
      actionId: enemy.mode === 'action' ? enemy.actionId : null,
      enemyId: enemy.enemyId,
      mode: enemy.mode,
      sequence: enemy.sequence,
    })),
    trigger,
  };
}

export function attachHomeFlashlight(root, options = {}) {
  if (!root) return null;
  const eventTarget = options.eventTarget ?? document;
  function moveLight(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    root.style.setProperty('--flashlight-x', `${event.clientX}px`);
    root.style.setProperty('--flashlight-y', `${event.clientY}px`);
    root.dataset.flashlightActive = 'true';
  }
  eventTarget.addEventListener('pointermove', moveLight, { passive: true });
  eventTarget.addEventListener('pointerdown', moveLight, { passive: true });
  return { moveLight };
}

export function attachHomeMusic(eventTarget = document) {
  let controllerPromise = null;
  let started = false;
  function getController() {
    controllerPromise ??= import('./music.js').then(({ MUSIC_TRACKS, createMusicController }) => (
      createMusicController({ ...MUSIC_TRACKS.mainMenu, startAt: 75 })
    ));
    return controllerPromise;
  }
  function startMusic() {
    if (started) return controllerPromise;
    started = true;
    getController().then((controller) => controller.start());
    eventTarget.removeEventListener('pointerdown', startMusic);
    eventTarget.removeEventListener('keydown', onKeyDown);
    return controllerPromise;
  }
  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') startMusic();
  }
  getController();
  eventTarget.addEventListener('pointerdown', startMusic);
  eventTarget.addEventListener('keydown', onKeyDown);
  return { start: startMusic };
}

export function attachHomeHelmetIntro(root, options = {}) {
  if (!root) return null;

  const eventTarget = options.eventTarget ?? document;
  const status = root.querySelector('#home-intro-status');
  const mainMenu = root.querySelector('#home-main-menu');
  const reducedMotion = options.reducedMotion
    ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ?? false;
  const durationMs = reducedMotion ? 1 : HOME_HELMET_TURN_DURATION_MS;
  let turnState = 'front';
  let elapsedMs = 0;
  let finishTimer = null;

  function renderState() {
    root.dataset.turnState = turnState;
    root.classList.toggle('is-turning', turnState === 'turning');
    root.classList.toggle('is-side', turnState === 'side');
    root.setAttribute('role', turnState === 'front' ? 'button' : 'main');
    root.tabIndex = turnState === 'front' ? 0 : -1;
    root.setAttribute('aria-label', turnState === 'front'
      ? '點擊任意位置，讓深海頭盔轉向側面'
      : '深海頭盔已轉向側面');
    if (mainMenu) {
      const menuVisible = turnState === 'side';
      mainMenu.toggleAttribute('inert', !menuVisible);
      mainMenu.setAttribute('aria-hidden', String(!menuVisible));
    }
    if (status) {
      status.textContent = turnState === 'front'
        ? '頭盔目前面向正前方。'
        : turnState === 'turning'
          ? '頭盔正在轉向側面。'
          : '頭盔已轉向側面。';
    }
  }

  function finishTurn() {
    if (turnState !== 'turning') return false;
    turnState = 'side';
    elapsedMs = durationMs;
    if (finishTimer !== null) clearTimeout(finishTimer);
    finishTimer = null;
    renderState();
    return true;
  }

  function turn() {
    if (turnState !== 'front') return false;
    turnState = 'turning';
    elapsedMs = 0;
    renderState();
    finishTimer = setTimeout(finishTurn, durationMs);
    return true;
  }

  function advance(ms) {
    if (turnState !== 'turning') return getHomeHelmetTurnFrame(elapsedMs, durationMs);
    elapsedMs += Math.max(0, Number(ms) || 0);
    if (elapsedMs >= durationMs) finishTurn();
    return getHomeHelmetTurnFrame(elapsedMs, durationMs);
  }

  function onPointerDown() {
    turn();
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (turnState !== 'front') return;
    event.preventDefault();
    turn();
  }

  eventTarget.addEventListener('pointerdown', onPointerDown, { once: true });
  root.addEventListener('keydown', onKeyDown);
  renderState();

  return {
    advance,
    finishTurn,
    getState: () => ({
      frame: getHomeHelmetTurnFrame(elapsedMs, durationMs),
      state: turnState,
    }),
    turn,
  };
}

if (typeof document !== 'undefined') {
  const homeRoot = document.querySelector('#home-intro');
  const intro = attachHomeHelmetIntro(homeRoot);
  if (intro) {
    const enemyShowcase = attachHomeEnemyShowcase(homeRoot);
    attachHomeFlashlight(homeRoot);
    attachHomeMapPreview(homeRoot);
    attachHomeMusic(document);
    window.advanceTime = (ms) => {
      intro.advance(ms);
      enemyShowcase?.advance(ms);
      window.advanceHomePreview?.(ms);
    };
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'DOM title screen; no gameplay coordinates',
      enemies: enemyShowcase?.getState() ?? [],
      helmet: intro.getState(),
      menuVisible: intro.getState().state === 'side',
      interaction: 'pointerdown anywhere turns the helmet; pointer position reveals enemies; clicking an enemy plays its skill',
    });
    window.render_home_enemies_to_text = () => JSON.stringify(enemyShowcase?.getState() ?? []);
    window.triggerHomeEnemySkill = (enemyId) => enemyShowcase?.trigger(enemyId) ?? false;
    window.turnHomeHelmet = () => intro.turn();
  }
}
