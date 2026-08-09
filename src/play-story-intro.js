export const PLAY_STORY_INTRO_TIMING = Object.freeze({
  charactersPerSecond: 38,
});

export const PLAY_STORY_INTRO_SLIDES = Object.freeze([
  Object.freeze({
    imagePath: '/assets/story/descent-part1/slide-01-oxygen-collapse.png',
    eyebrow: 'DEEP SEA RECORD / 01',
    title: '世界正在停止呼吸',
    narrator: '地表的氧氣正在消失。不是一座城市，也不是一片海域——是整個世界正在慢慢停止呼吸。',
  }),
  Object.freeze({
    imagePath: '/assets/story/descent-part1/slide-02-abyss-core.png',
    eyebrow: 'DEEP SEA RECORD / 02',
    title: '海溝最深處的核心',
    narrator: '海溝最深處，有一個維持生命循環的核心。機械無法靠近它，因為這片海會拒絕鋼鐵。',
  }),
  Object.freeze({
    imagePath: '/assets/story/descent-part1/slide-03-flesh-diver.png',
    eyebrow: 'DEEP SEA RECORD / 03',
    title: '只有肉身能夠共鳴',
    narrator: '只有活著的肉身能穿過共鳴。我的任務不是征服深海，而是抵達核心，帶回它的回應。',
  }),
]);

export function createPlayStoryIntroState({ enabled = true, reducedMotion = false } = {}) {
  return {
    active: Boolean(enabled),
    slideIndex: 0,
    typedCharacters: reducedMotion ? PLAY_STORY_INTRO_SLIDES[0].narrator.length : 0,
    reducedMotion: Boolean(reducedMotion),
  };
}

export function getPlayStoryIntroSlide(state) {
  const index = Math.min(
    PLAY_STORY_INTRO_SLIDES.length - 1,
    Math.max(0, Math.floor(Number(state?.slideIndex) || 0)),
  );
  return PLAY_STORY_INTRO_SLIDES[index] ?? PLAY_STORY_INTRO_SLIDES[0];
}

export function getPlayStoryIntroRenderState(state) {
  const slide = getPlayStoryIntroSlide(state);
  const typedCharacters = Math.min(
    slide.narrator.length,
    Math.max(0, Math.floor(Number(state?.typedCharacters) || 0)),
  );
  const active = Boolean(state?.active);
  return Object.freeze({
    active,
    blocksGameplay: active,
    slideIndex: Math.min(PLAY_STORY_INTRO_SLIDES.length - 1, Math.max(0, Math.floor(Number(state?.slideIndex) || 0))),
    slideNumber: Math.min(PLAY_STORY_INTRO_SLIDES.length, Math.max(1, Math.floor(Number(state?.slideIndex) || 0) + 1)),
    totalSlides: PLAY_STORY_INTRO_SLIDES.length,
    imagePath: slide.imagePath,
    eyebrow: slide.eyebrow,
    title: slide.title,
    narrator: slide.narrator,
    typedText: slide.narrator.slice(0, typedCharacters),
    typedCharacters,
    textComplete: typedCharacters >= slide.narrator.length,
    progress: (Math.min(PLAY_STORY_INTRO_SLIDES.length - 1, Math.max(0, Math.floor(Number(state?.slideIndex) || 0))) + 1) / PLAY_STORY_INTRO_SLIDES.length,
  });
}

export function stepPlayStoryIntro(state, elapsed, timing = PLAY_STORY_INTRO_TIMING) {
  if (!state?.active || state.reducedMotion) return getPlayStoryIntroRenderState(state);
  const slide = getPlayStoryIntroSlide(state);
  const charactersPerSecond = Math.max(1, Number(timing.charactersPerSecond) || PLAY_STORY_INTRO_TIMING.charactersPerSecond);
  state.typedCharacters = Math.min(
    slide.narrator.length,
    state.typedCharacters + Math.max(0, Number(elapsed) || 0) * charactersPerSecond,
  );
  return getPlayStoryIntroRenderState(state);
}

export function advancePlayStoryIntro(state) {
  if (!state?.active) return getPlayStoryIntroRenderState(state);
  const slide = getPlayStoryIntroSlide(state);
  if (state.typedCharacters < slide.narrator.length) {
    state.typedCharacters = slide.narrator.length;
    return getPlayStoryIntroRenderState(state);
  }
  if (state.slideIndex < PLAY_STORY_INTRO_SLIDES.length - 1) {
    state.slideIndex += 1;
    state.typedCharacters = state.reducedMotion
      ? getPlayStoryIntroSlide(state).narrator.length
      : 0;
    return getPlayStoryIntroRenderState(state);
  }
  state.active = false;
  return getPlayStoryIntroRenderState(state);
}

export function skipPlayStoryIntro(state) {
  if (state) state.active = false;
  return getPlayStoryIntroRenderState(state);
}
