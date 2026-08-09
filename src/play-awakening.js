const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const smoothstep = (value) => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

export const PLAY_AWAKENING_TIMING = Object.freeze({
  blackHold: 0.6,
  attemptFadeDuration: 0.75,
  hudFadeStart: 1.05,
  hudFadeDuration: 1.25,
  blinkStart: 2.45,
  blinkDuration: 0.7,
  blinkCount: 3,
  finalOpenDuration: 1.1,
  finalOpenHold: 0.2,
});

export function getPlayAwakeningDuration(timing = PLAY_AWAKENING_TIMING) {
  return timing.blinkStart
    + timing.blinkDuration * timing.blinkCount
    + timing.finalOpenDuration
    + timing.finalOpenHold;
}

export function getPlayAttemptState(actor) {
  const maximum = Math.max(1, Math.floor(Number(actor?.maxLives) || 1));
  const remaining = Math.min(maximum, Math.max(0, Math.floor(Number(actor?.lives) || 0)));
  return Object.freeze({ remaining, maximum, label: `ATTEMPT ${remaining}-${maximum}` });
}

export function createPlayAwakeningState({ enabled = true, reducedMotion = false } = {}) {
  return {
    active: Boolean(enabled),
    elapsed: 0,
    reducedMotion: Boolean(reducedMotion),
  };
}

export function getPlayAwakeningRenderState(state, timing = PLAY_AWAKENING_TIMING) {
  const enabled = Boolean(state?.active);
  const elapsed = Math.max(0, Number(state?.elapsed) || 0);
  const duration = getPlayAwakeningDuration(timing);
  if (!enabled || elapsed >= duration) {
    return Object.freeze({
      active: false,
      blocksGameplay: false,
      phase: 'complete',
      elapsed: Math.min(elapsed, duration),
      duration,
      attemptOpacity: 1,
      hudOpacity: 1,
      eyeOpenRatio: 1,
      blinkIndex: timing.blinkCount,
      maskVisible: false,
    });
  }

  const attemptOpacity = smoothstep((elapsed - timing.blackHold) / timing.attemptFadeDuration);
  const hudOpacity = smoothstep((elapsed - timing.hudFadeStart) / timing.hudFadeDuration);
  const blinkEnd = timing.blinkStart + timing.blinkDuration * timing.blinkCount;
  let phase = elapsed < timing.blackHold
    ? 'black'
    : elapsed < timing.hudFadeStart
      ? 'attempt'
      : elapsed < timing.blinkStart
        ? 'hud'
        : 'blink';
  let eyeOpenRatio = 0;
  let blinkIndex = 0;

  if (elapsed >= timing.blinkStart && elapsed < blinkEnd) {
    const blinkProgress = (elapsed - timing.blinkStart) / timing.blinkDuration;
    blinkIndex = Math.min(timing.blinkCount, Math.floor(blinkProgress) + 1);
    eyeOpenRatio = Math.sin((blinkProgress % 1) * Math.PI);
    phase = `blink-${blinkIndex}`;
  } else if (elapsed >= blinkEnd) {
    blinkIndex = timing.blinkCount;
    eyeOpenRatio = smoothstep((elapsed - blinkEnd) / timing.finalOpenDuration);
    phase = 'final-open';
  }

  return Object.freeze({
    active: true,
    blocksGameplay: true,
    phase,
    elapsed,
    duration,
    attemptOpacity,
    hudOpacity,
    eyeOpenRatio,
    blinkIndex,
    maskVisible: true,
  });
}

export function stepPlayAwakening(state, elapsed, timing = PLAY_AWAKENING_TIMING) {
  if (!state?.active) return getPlayAwakeningRenderState(state, timing);
  const duration = getPlayAwakeningDuration(timing);
  const speed = state.reducedMotion ? 6 : 1;
  state.elapsed = Math.min(duration, state.elapsed + Math.max(0, Number(elapsed) || 0) * speed);
  if (state.elapsed >= duration) state.active = false;
  return getPlayAwakeningRenderState(state, timing);
}
