export const HOME_HELMET_TURN_DURATION_MS = 1250;
export const HOME_HELMET_TURN_FRAME_COUNT = 4;

export function getHomeHelmetTurnFrame(elapsedMs, durationMs = HOME_HELMET_TURN_DURATION_MS) {
  const safeDuration = Math.max(1, Number(durationMs) || HOME_HELMET_TURN_DURATION_MS);
  const progress = Math.min(1, Math.max(0, Number(elapsedMs) || 0) / safeDuration);
  return Math.min(HOME_HELMET_TURN_FRAME_COUNT - 1, Math.floor(progress * HOME_HELMET_TURN_FRAME_COUNT));
}

export function attachHomeHelmetIntro(root, options = {}) {
  if (!root) return null;

  const eventTarget = options.eventTarget ?? document;
  const status = root.querySelector('#home-intro-status');
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
    root.setAttribute('aria-label', turnState === 'front'
      ? '點擊任意位置，讓深海頭盔轉向側面'
      : '深海頭盔已轉向側面');
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
  const intro = attachHomeHelmetIntro(document.querySelector('#home-intro'));
  if (intro) {
    window.advanceTime = (ms) => intro.advance(ms);
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'DOM title screen; no gameplay coordinates',
      helmet: intro.getState(),
      interaction: 'pointerdown anywhere or Enter/Space turns the helmet from front to side',
    });
    window.turnHomeHelmet = () => intro.turn();
  }
}
