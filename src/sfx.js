import buttonClickSource from './assets/audio/sfx/ui/button-click.wav';
import menuSelectionSource from './assets/audio/sfx/ui/menu-selection.wav';
import scubaBubblesSource from './assets/audio/sfx/environment/scuba-bubbles.mp3';
import underwaterLoopSource from './assets/audio/sfx/environment/underwater-loop.wav';
import waterDropSource from './assets/audio/sfx/environment/water-drop-splash.aiff?url';
import launchWhooshSource from './assets/audio/sfx/movement/launch-whoosh.wav';
import impactWetSource from './assets/audio/sfx/collision/impact-wet.wav';
import teleportSource from './assets/audio/sfx/interaction/teleport-spacey.wav';
import retroExplosionSource from './assets/audio/sfx/combat/retro-explosion.mp3';
import laserSource from './assets/audio/sfx/combat/laser.ogg';
import gameOverSource from './assets/audio/sfx/player/game-over-explode.wav';

const SFX_VOLUME_KEY = 'thirst-for-oxygen:sfx-volume';
const DEFAULT_SFX_VOLUME = 0.65;

const SFX_SOURCES = Object.freeze({
  button: buttonClickSource,
  menuSelection: menuSelectionSource,
  scubaBubbles: scubaBubblesSource,
  underwaterLoop: underwaterLoopSource,
  waterDrop: waterDropSource,
  launch: launchWhooshSource,
  impactWet: impactWetSource,
  teleport: teleportSource,
  explosion: retroExplosionSource,
  laser: laserSource,
  gameOver: gameOverSource,
});

function clampVolume(value) { return Math.min(1, Math.max(0, Number(value) || 0)); }

function readStoredVolume() {
  try {
    return clampVolume(window.localStorage.getItem(SFX_VOLUME_KEY) ?? DEFAULT_SFX_VOLUME);
  } catch {
    return DEFAULT_SFX_VOLUME;
  }
}

function storeVolume(value) {
  try { window.localStorage.setItem(SFX_VOLUME_KEY, String(value)); } catch { /* storage is optional */ }
}

export function createSfxController() {
  let volume = readStoredVolume();
  const activePlayers = new Map();
  const ambientPlayers = new Map();
  const subscribers = new Set();

  function notify() {
    subscribers.forEach((subscriber) => subscriber({ volume }));
  }

  function play(id, { volumeMultiplier = 1, playbackRate = 1 } = {}) {
    const source = SFX_SOURCES[id];
    if (!source) return Promise.resolve(false);
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = clampVolume(volume * volumeMultiplier);
    audio.playbackRate = playbackRate;
    activePlayers.set(audio, volumeMultiplier);
    const cleanup = () => activePlayers.delete(audio);
    audio.addEventListener('ended', cleanup, { once: true });
    const request = audio.play();
    if (request?.catch) return request.then(() => true).catch(() => { cleanup(); return false; });
    return Promise.resolve(true);
  }

  function startAmbient(id, volumeMultiplier) {
    if (ambientPlayers.has(id) || !SFX_SOURCES[id]) return Promise.resolve(false);
    const audio = new Audio(SFX_SOURCES[id]);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = clampVolume(volume * volumeMultiplier);
    ambientPlayers.set(id, { audio, volumeMultiplier });
    const request = audio.play();
    if (request?.catch) return request.then(() => true).catch(() => { ambientPlayers.delete(id); return false; });
    return Promise.resolve(true);
  }

  function stopAmbient() {
    ambientPlayers.forEach(({ audio }) => { audio.pause(); audio.src = ''; });
    ambientPlayers.clear();
  }

  return {
    play,
    startAmbient() {
      // The loop is the primary diving bed; bubbles sit underneath it so the
      // water presence remains audible without competing with collision cues.
      return Promise.all([
        startAmbient('underwaterLoop', 0.42),
        startAmbient('scubaBubbles', 0.12),
      ]);
    },
    stopAmbient,
    setVolume(nextVolume) {
      volume = clampVolume(nextVolume);
      storeVolume(volume);
      activePlayers.forEach((volumeMultiplier, audio) => { audio.volume = clampVolume(volume * volumeMultiplier); });
      ambientPlayers.forEach(({ audio, volumeMultiplier }) => { audio.volume = clampVolume(volume * volumeMultiplier); });
      notify();
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber({ volume });
      return () => subscribers.delete(subscriber);
    },
  };
}

export function attachSfxVolumeControl(root, controller) {
  const label = document.createElement('label');
  label.className = 'settings-field';
  label.innerHTML = '<span>音效音量</span><input type="range" min="0" max="1" step="0.01" aria-label="音效音量" />';
  root.append(label);
  const input = label.querySelector('input');
  input.addEventListener('input', () => controller.setVolume(input.value));
  controller.subscribe(({ volume }) => { input.value = String(volume); });
  return label;
}
