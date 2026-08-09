const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const smoothstep = (value) => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

export const PLAY_AWAKENING_TIMING = Object.freeze({
  shutterCloseDuration: 0.85,
  shutterClosedHold: 0.65,
  routeLightDuration: 0.65,
  routeHoldDuration: 1.15,
  shutterOpenDuration: 1.45,
  finalOpenHold: 0.2,
});

export const PLAY_DESCENT_ROUTE_STAGES = Object.freeze([
  Object.freeze({ part: 1, chapterLabel: '下沉篇・第一部分', title: '深海森林入口' }),
  Object.freeze({ part: 2, chapterLabel: '下沉篇・第二部分', title: '穿越熱泉' }),
  Object.freeze({ part: 3, chapterLabel: '下沉篇・第三部分', title: '深淵遺跡' }),
]);

export function getPlayAwakeningDuration(timing = PLAY_AWAKENING_TIMING) {
  return timing.shutterCloseDuration
    + timing.shutterClosedHold
    + timing.routeLightDuration
    + timing.routeHoldDuration
    + timing.shutterOpenDuration
    + timing.finalOpenHold;
}

export function getPlayShutterHalfDrawRect({
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  topHalf,
  openRatio,
}) {
  const sourceWidth = Math.max(1, Number(imageWidth) || 1);
  const sourceHeight = Math.max(1, Number(imageHeight) || 1) * .5;
  const destinationWidth = Math.max(1, Number(canvasWidth) || 1);
  const destinationHeight = Math.max(1, Number(canvasHeight) || 1) * .5;
  const travel = Math.max(1, Number(canvasHeight) || 1) * .56 * clamp01(openRatio);
  return Object.freeze({
    sx: 0,
    sy: topHalf ? 0 : sourceHeight,
    sw: sourceWidth,
    sh: sourceHeight,
    dx: 0,
    dy: topHalf ? (travel > 0 ? -travel : 0) : destinationHeight + travel,
    dw: destinationWidth,
    dh: destinationHeight,
  });
}

export function getPlayAttemptState(actor) {
  const maximum = Math.max(1, Math.floor(Number(actor?.maxLives) || 1));
  const remaining = Math.min(maximum, Math.max(0, Math.floor(Number(actor?.lives) || 0)));
  return Object.freeze({ remaining, maximum, label: `ATTEMPT ${remaining}/${maximum}` });
}

export function createPlayAwakeningState({ enabled = true, reducedMotion = false, part = 1 } = {}) {
  return {
    active: false,
    awaitingTrigger: Boolean(enabled),
    elapsed: 0,
    reducedMotion: Boolean(reducedMotion),
    activeRouteIndex: Math.min(2, Math.max(0, Math.floor(Number(part) || 1) - 1)),
  };
}

export function beginPlayAwakening(state, timing = PLAY_AWAKENING_TIMING) {
  if (!state?.awaitingTrigger) return getPlayAwakeningRenderState(state, timing);
  state.awaitingTrigger = false;
  state.active = true;
  state.elapsed = 0;
  return getPlayAwakeningRenderState(state, timing);
}

export function getPlayAwakeningRenderState(state, timing = PLAY_AWAKENING_TIMING) {
  const enabled = Boolean(state?.active);
  const awaitingTrigger = Boolean(state?.awaitingTrigger);
  const elapsed = Math.max(0, Number(state?.elapsed) || 0);
  const duration = getPlayAwakeningDuration(timing);
  const activeRouteIndex = Math.min(2, Math.max(0, Math.floor(Number(state?.activeRouteIndex) || 0)));
  if (awaitingTrigger) {
    return Object.freeze({
      active: false,
      awaitingTrigger: true,
      blocksGameplay: true,
      phase: 'ready',
      elapsed: 0,
      duration,
      attemptOpacity: 1,
      hudOpacity: 1,
      routeLightRatio: 0,
      routeOpacity: 0,
      shutterOpenRatio: 1,
      activeRouteIndex,
      maskVisible: false,
    });
  }
  if (!enabled || elapsed >= duration) {
    return Object.freeze({
      active: false,
      awaitingTrigger: false,
      blocksGameplay: false,
      phase: 'complete',
      elapsed: Math.min(elapsed, duration),
      duration,
      attemptOpacity: 1,
      hudOpacity: 1,
      routeLightRatio: 1,
      routeOpacity: 0,
      shutterOpenRatio: 1,
      activeRouteIndex,
      maskVisible: false,
    });
  }

  const shutterCloseEnd = timing.shutterCloseDuration;
  const routeLightStart = shutterCloseEnd + timing.shutterClosedHold;
  const shutterOpenStart = routeLightStart + timing.routeLightDuration + timing.routeHoldDuration;
  const shutterOpenEnd = shutterOpenStart + timing.shutterOpenDuration;
  const routeLightRatio = smoothstep((elapsed - routeLightStart) / timing.routeLightDuration);
  const shutterOpenRatio = elapsed < shutterCloseEnd
    ? 1 - smoothstep(elapsed / timing.shutterCloseDuration)
    : smoothstep((elapsed - shutterOpenStart) / timing.shutterOpenDuration);
  const routeOpacity = routeLightRatio * (1 - smoothstep(shutterOpenRatio * 1.65));
  const phase = elapsed < shutterCloseEnd
    ? 'shutter-close'
    : elapsed < routeLightStart
      ? 'shutter-closed'
    : elapsed < shutterOpenStart
      ? 'route-lock'
      : elapsed < shutterOpenEnd
        ? 'shutter-open'
        : 'final-open';

  return Object.freeze({
    active: true,
    awaitingTrigger: false,
    blocksGameplay: true,
    phase,
    elapsed,
    duration,
    attemptOpacity: 1,
    hudOpacity: 1,
    routeLightRatio,
    routeOpacity,
    shutterOpenRatio,
    activeRouteIndex,
    maskVisible: true,
  });
}

export function stepPlayAwakening(state, elapsed, timing = PLAY_AWAKENING_TIMING) {
  if (!state?.active || state.awaitingTrigger) return getPlayAwakeningRenderState(state, timing);
  const duration = getPlayAwakeningDuration(timing);
  const speed = state.reducedMotion ? 6 : 1;
  state.elapsed = Math.min(duration, state.elapsed + Math.max(0, Number(elapsed) || 0) * speed);
  if (state.elapsed >= duration) state.active = false;
  return getPlayAwakeningRenderState(state, timing);
}
