import buttonClickSource from './assets/audio/sfx/ui/button-click.wav';
import menuSelectionSource from './assets/audio/sfx/ui/menu-selection.wav';
import scubaBubblesSource from './assets/audio/sfx/environment/scuba-bubbles.mp3';
import underwaterLoopSource from './assets/audio/sfx/environment/underwater-loop.mp3';
import waterDropSource from './assets/audio/sfx/environment/water-drop-splash.aiff?url';
import launchWhooshSource from './assets/audio/sfx/movement/launch-whoosh.wav';
import impactWetSource from './assets/audio/sfx/collision/impact-wet.wav';
import teleportSource from './assets/audio/sfx/interaction/teleport-spacey.wav';
import retroExplosionSource from './assets/audio/sfx/combat/retro-explosion.mp3';
import laserSource from './assets/audio/sfx/combat/laser.ogg';
import gameOverSource from './assets/audio/sfx/player/game-over-explode.wav';

const SFX_VOLUME_KEY = 'thirst-for-oxygen:sfx-volume';
const DEFAULT_SFX_VOLUME = 0.75;
const MAX_SFX_VOLUME = 1.5;

export const AMBIENT_AUDIO_MIX = Object.freeze({
  // The ambient gain is intentionally allowed above the HTMLAudioElement
  // volume ceiling. These values are 50% above the previous diving mix.
  underwaterLoop: 1.845,
  scubaBubbles: 0.54,
});

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

function clampVolume(value) { return Math.min(MAX_SFX_VOLUME, Math.max(0, Number(value) || 0)); }
function clampAudioVolume(value) { return Math.min(1, Math.max(0, Number(value) || 0)); }

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
  let ambientAudioContext = null;

  function getAmbientAudioContext() {
    const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof AudioContextConstructor !== 'function') return null;
    try {
      ambientAudioContext ??= new AudioContextConstructor();
      return ambientAudioContext;
    } catch {
      return null;
    }
  }

  function notify() {
    subscribers.forEach((subscriber) => subscriber({ volume }));
  }

  function play(id, { volumeMultiplier = 1, playbackRate = 1 } = {}) {
    const source = SFX_SOURCES[id];
    if (!source) return Promise.resolve(false);
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = clampAudioVolume(volume * volumeMultiplier);
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
    const context = getAmbientAudioContext();
    let gain = null;
    let source = null;
    if (context) {
      try {
        source = context.createMediaElementSource(audio);
        gain = context.createGain();
        source.connect(gain);
        gain.connect(context.destination);
        gain.gain.value = volume * volumeMultiplier;
        audio.volume = 1;
      } catch {
        gain = null;
        source = null;
        audio.volume = clampAudioVolume(volume * volumeMultiplier);
      }
    } else {
      audio.volume = clampAudioVolume(volume * volumeMultiplier);
    }
    const output = {
      gain,
      disconnect() {
        source?.disconnect();
        gain?.disconnect();
      },
    };
    ambientPlayers.set(id, { audio, volumeMultiplier, output });
    const resumeRequest = context?.resume?.();
    if (resumeRequest?.catch) resumeRequest.catch(() => {});
    const request = audio.play();
    if (request?.catch) return request.then(() => true).catch(() => { output.disconnect(); ambientPlayers.delete(id); return false; });
    return Promise.resolve(true);
  }

  function stopAmbient() {
    ambientPlayers.forEach(({ audio, output }) => { audio.pause(); audio.src = ''; output.disconnect(); });
    ambientPlayers.clear();
  }

  return {
    play,
    startAmbient() {
      // The loop is the primary diving bed; bubbles sit underneath it so the
      // water presence remains audible without competing with collision cues.
      return Promise.all([
        startAmbient('underwaterLoop', AMBIENT_AUDIO_MIX.underwaterLoop),
        startAmbient('scubaBubbles', AMBIENT_AUDIO_MIX.scubaBubbles),
      ]);
    },
    stopAmbient,
    setVolume(nextVolume) {
      volume = clampVolume(nextVolume);
      storeVolume(volume);
      activePlayers.forEach((volumeMultiplier, audio) => { audio.volume = clampAudioVolume(volume * volumeMultiplier); });
      ambientPlayers.forEach(({ audio, volumeMultiplier, output }) => {
        if (output.gain) output.gain.gain.value = volume * volumeMultiplier;
        else audio.volume = clampAudioVolume(volume * volumeMultiplier);
      });
      notify();
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber({ volume });
      return () => subscribers.delete(subscriber);
    },
  };
}

export function attachSfxVolumeControl(root, controller, { labelText = '潛水環境音音量' } = {}) {
  if (!root) return null;
  const field = document.createElement('label');
  field.className = 'settings-field';
  field.innerHTML = `<span>${labelText}</span><input type="range" min="0" max="1.5" step="0.01" aria-label="${labelText}" />`;
  root.append(field);
  const input = field.querySelector('input');
  input.addEventListener('input', () => controller.setVolume(input.value));
  controller.subscribe(({ volume }) => { input.value = String(volume); });
  return field;
}
