const DEFAULT_VOLUME = 0.028;
const MIN_INTERVAL_SECONDS = 0.034;

export function createStoryTypingSound({ volume = DEFAULT_VOLUME } = {}) {
  let audioContext = null;
  let unlocked = false;
  let lastPlayedAt = -Infinity;

  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContext ??= new AudioContextCtor();
    return audioContext;
  }

  function unlock() {
    const context = getAudioContext();
    if (!context) return false;
    unlocked = true;
    if (context.state === 'suspended') void context.resume();
    return true;
  }

  function play() {
    const context = getAudioContext();
    if (!context || !unlocked) return false;
    const now = context.currentTime;
    if (now - lastPlayedAt < MIN_INTERVAL_SECONDS) return false;
    lastPlayedAt = now;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(540 + Math.random() * 180, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.026);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, Number(volume) || DEFAULT_VOLUME), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.035);
    return true;
  }

  function dispose() {
    if (audioContext && audioContext.state !== 'closed') void audioContext.close();
    audioContext = null;
    unlocked = false;
  }

  return Object.freeze({ unlock, play, dispose });
}
