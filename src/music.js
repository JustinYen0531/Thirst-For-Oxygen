import mainMenuSource from './assets/audio/music/main-menu.mp3';
import tutorialSource from './assets/audio/music/tutorial.mp3';
import phase1BossSource from './assets/audio/music/phase-1-boss.mp3';
import phase1BossAscentSource from './assets/audio/music/phase-1-boss-2.0.mp3';
import phase1NormalSource from './assets/audio/music/phase-1-normal.mp3';
import phase1NormalAscentSource from './assets/audio/music/phase-1-normal-2.0.mp3';
import phase2BossSource from './assets/audio/music/phase-2-boss.mp3';
import phase2NormalSource from './assets/audio/music/phase-2-normal.mp3';
import phase2NormalAscentSource from './assets/audio/music/phase-2-normal-2.0.mp3';
import phase3BossSource from './assets/audio/music/phase-3-boss.mp3';
import phase3BossAscentSource from './assets/audio/music/phase-3-boss-2.0.mp3';
import phase3NormalSource from './assets/audio/music/phase-3-normal.mp3';
import phase3NormalAscentSource from './assets/audio/music/phase-3-normal-2.0.mp3';

const MUSIC_VOLUME_KEY = 'thirst-for-oxygen:music-volume';
const DEFAULT_VOLUME = 0.65;
const LOOP_DELAY_MS = 2600;
const FADE_IN_MS = 1800;
const FADE_OUT_MS = 1800;

function phaseTrack(label, source) {
  return Object.freeze({ label, source });
}

export const MUSIC_TRACKS = Object.freeze({
  mainMenu: phaseTrack('Main Menu', mainMenuSource),
  tutorial: phaseTrack('Tutorial', tutorialSource),
  descent: Object.freeze({
    1: Object.freeze({
      normal: phaseTrack('Phase 1 / Normal', phase1NormalSource),
      boss: phaseTrack('Phase 1 / Boss', phase1BossSource),
    }),
    2: Object.freeze({
      normal: phaseTrack('Phase 2 / Normal', phase2NormalSource),
      boss: phaseTrack('Phase 2 / Boss', phase2BossSource),
    }),
    3: Object.freeze({
      normal: phaseTrack('Phase 3 / Normal', phase3NormalSource),
      boss: phaseTrack('Phase 3 / Boss', phase3BossSource),
    }),
  }),
  ascent20: Object.freeze({
    1: Object.freeze({
      normal: phaseTrack('Phase 1 / Normal 2.0', phase1NormalAscentSource),
      boss: phaseTrack('Phase 1 / Boss 2.0', phase1BossAscentSource),
    }),
    2: Object.freeze({
      normal: phaseTrack('Phase 2 / Normal 2.0', phase2NormalAscentSource),
      boss: phaseTrack('Phase 2 / Boss 2.0（音檔待提供）', null),
    }),
    3: Object.freeze({
      normal: phaseTrack('Phase 3 / Normal 2.0', phase3NormalAscentSource),
      boss: phaseTrack('Phase 3 / Boss 2.0', phase3BossAscentSource),
    }),
  }),
});

export function getMusicTrack({ arc = 'descent', part = 3, mode = 'normal' } = {}) {
  if (arc === 'tutorial') return MUSIC_TRACKS.tutorial;
  const trackGroup = arc === 'ascent20' ? MUSIC_TRACKS.ascent20 : MUSIC_TRACKS.descent;
  return trackGroup[Number(part)]?.[mode] ?? null;
}

function clampVolume(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function readStoredVolume() {
  try {
    return clampVolume(window.localStorage.getItem(MUSIC_VOLUME_KEY) ?? DEFAULT_VOLUME);
  } catch {
    return DEFAULT_VOLUME;
  }
}

function storeVolume(value) {
  try {
    window.localStorage.setItem(MUSIC_VOLUME_KEY, String(value));
  } catch {
    // Private browsing or a blocked storage policy should not disable music.
  }
}

export function createMusicController(initialTrack) {
  const audio = new Audio();
  audio.preload = 'auto';
  let track = initialTrack ?? null;
  let targetVolume = readStoredVolume();
  let fadeTimer = null;
  let loopTimer = null;
  let generation = 0;
  let active = false;
  let looping = false;
  let started = false;
  const subscribers = new Set();
  audio.src = track?.source ?? '';

  function notify(status) {
    const state = {
      available: Boolean(track?.source),
      label: track?.label ?? '未選取音樂',
      playing: active,
      status,
      volume: targetVolume,
    };
    subscribers.forEach((subscriber) => subscriber(state));
  }

  function clearFade() {
    if (fadeTimer !== null) window.clearInterval(fadeTimer);
    fadeTimer = null;
  }

  function clearLoop() {
    if (loopTimer !== null) window.clearTimeout(loopTimer);
    loopTimer = null;
  }

  function fadeTo(target, duration, callback) {
    clearFade();
    const destination = clampVolume(target);
    const initial = audio.volume;
    if (duration <= 0 || Math.abs(destination - initial) < 0.001) {
      audio.volume = destination;
      callback?.();
      return;
    }
    const startedAt = performance.now();
    fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      audio.volume = initial + (destination - initial) * progress;
      if (progress >= 1) {
        clearFade();
        callback?.();
      }
    }, 32);
  }

  function setInitialPosition() {
    if (!started && track?.startAt) {
      try {
        audio.currentTime = track.startAt;
      } catch {
        audio.addEventListener('loadedmetadata', () => {
          if (!started && track?.startAt) audio.currentTime = track.startAt;
        }, { once: true });
      }
    }
    started = true;
  }

  function playCurrent({ fromLoop = false } = {}) {
    if (!track?.source) {
      notify('此曲目尚未提供音檔。');
      return Promise.resolve(false);
    }
    if (fromLoop) audio.currentTime = 0;
    setInitialPosition();
    active = true;
    const playRequest = audio.play();
    if (playRequest?.catch) {
      return playRequest.then(() => {
        fadeTo(targetVolume, FADE_IN_MS);
        notify('播放中');
        return true;
      }).catch(() => {
        active = false;
        notify('請點擊播放按鈕以開始音樂。');
        return false;
      });
    }
    fadeTo(targetVolume, FADE_IN_MS);
    notify('播放中');
    return Promise.resolve(true);
  }

  function scheduleLoop() {
    if (!active || looping || !track?.source) return;
    looping = true;
    const loopGeneration = ++generation;
    fadeTo(0, FADE_OUT_MS, () => {
      audio.pause();
      loopTimer = window.setTimeout(() => {
        if (!active || loopGeneration !== generation) return;
        looping = false;
        playCurrent({ fromLoop: true });
      }, LOOP_DELAY_MS);
    });
    notify('淡出中，準備循環');
  }

  function monitorEnd() {
    if (!active || looping || !Number.isFinite(audio.duration)) return;
    if (audio.duration - audio.currentTime <= FADE_OUT_MS / 1000) scheduleLoop();
  }

  audio.addEventListener('timeupdate', monitorEnd);
  audio.addEventListener('ended', scheduleLoop);

  return {
    start() {
      clearLoop();
      looping = false;
      generation += 1;
      return playCurrent();
    },
    pause() {
      if (!track?.source) return;
      active = false;
      looping = false;
      generation += 1;
      clearLoop();
      fadeTo(0, FADE_OUT_MS, () => audio.pause());
      notify('已暫停');
    },
    stop() {
      active = false;
      looping = false;
      generation += 1;
      clearLoop();
      clearFade();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
      started = false;
      notify('已停止');
    },
    setVolume(value) {
      targetVolume = clampVolume(value);
      storeVolume(targetVolume);
      if (active && !looping) audio.volume = targetVolume;
      notify(active ? '播放中' : '已暫停');
    },
    setTrack(nextTrack) {
      const wasActive = active;
      this.stop();
      track = nextTrack ?? null;
      audio.src = track?.source ?? '';
      audio.load();
      notify(track?.source ? '待播放' : '此曲目尚未提供音檔。');
      if (wasActive) return this.start();
      return Promise.resolve(false);
    },
    getTrack() { return track; },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber({ available: Boolean(track?.source), label: track?.label ?? '未選取音樂', playing: active, status: '待播放', volume: targetVolume });
      return () => subscribers.delete(subscriber);
    },
  };
}

export function attachMenuMusic(eventTarget = document, options = {}) {
  if (!eventTarget?.addEventListener) return null;
  const controller = createMusicController({
    ...MUSIC_TRACKS.mainMenu,
    startAt: options.startAt ?? 75,
  });
  let started = false;
  let attempting = false;

  function cleanup() {
    eventTarget.removeEventListener('pointerdown', unlock);
    eventTarget.removeEventListener('keydown', onKeyDown);
  }

  async function unlock() {
    if (started || attempting) return false;
    attempting = true;
    const didStart = await controller.start();
    attempting = false;
    if (didStart) {
      started = true;
      cleanup();
    }
    return didStart;
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') void unlock();
  }

  eventTarget.addEventListener('pointerdown', unlock, { passive: true });
  eventTarget.addEventListener('keydown', onKeyDown);
  void unlock();
  return {
    controller,
    start: unlock,
    stop() {
      cleanup();
      controller.stop();
    },
  };
}

export function attachMusicControls(root, controller) {
  const panel = document.createElement('section');
  panel.className = 'music-control';
  panel.setAttribute('aria-label', '音樂控制');
  panel.innerHTML = `
    <div class="music-control-heading"><span>音樂</span><strong data-music-label></strong></div>
    <div class="music-control-actions">
      <button type="button" data-music-toggle>▶ 播放</button>
      <label><span>音量</span><input type="range" min="0" max="1" step="0.01" data-music-volume /></label>
    </div>
    <small data-music-status>待播放</small>
  `;
  root.append(panel);
  const toggle = panel.querySelector('[data-music-toggle]');
  const volume = panel.querySelector('[data-music-volume]');
  const label = panel.querySelector('[data-music-label]');
  const status = panel.querySelector('[data-music-status]');
  toggle.addEventListener('click', () => {
    if (toggle.dataset.playing === 'true') controller.pause();
    else controller.start();
  });
  volume.addEventListener('input', () => controller.setVolume(volume.value));
  controller.subscribe((state) => {
    label.textContent = state.label;
    volume.value = String(state.volume);
    status.textContent = state.status;
    toggle.dataset.playing = String(state.playing);
    toggle.textContent = state.playing ? 'Ⅱ 暫停' : '▶ 播放';
    toggle.disabled = !state.available;
  });
  return panel;
}
