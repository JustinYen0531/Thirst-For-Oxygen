export const PLAY_STORY_INTRO_TIMING = Object.freeze({
  charactersPerSecond: 38,
});

export const PLAY_STORY_INTRO_SLIDES_BY_PART = Object.freeze({
  1: Object.freeze([
  Object.freeze({
    videoPath: '/assets/story/descent-part1/ZH1-1.mp4',
    imagePath: '/assets/story/descent-part1/slide-01-oxygen-collapse.png',
    eyebrow: 'DEEP SEA RECORD / 01',
    title: '世界正在停止呼吸',
    narrator: '地表的氧氣正在消失。不是一座城市，也不是一片海域——是整個世界正在慢慢停止呼吸。',
  }),
  Object.freeze({
    videoPath: '/assets/story/descent-part1/ZH1-2.mp4',
    imagePath: '/assets/story/descent-part1/slide-02-abyss-core.png',
    eyebrow: 'DEEP SEA RECORD / 02',
    title: '海溝最深處的核心',
    narrator: '海溝最深處，有一個維持生命循環的核心。機械無法靠近它，因為這片海會拒絕鋼鐵。',
  }),
  Object.freeze({
    videoPath: '/assets/story/descent-part1/ZH1-3.mp4',
    imagePath: '/assets/story/descent-part1/slide-03-flesh-diver.png',
    eyebrow: 'DEEP SEA RECORD / 03',
    title: '只有肉身能夠共鳴',
    narrator: '只有活著的肉身能穿過共鳴。我的任務不是征服深海，而是抵達核心，帶回它的回應。',
  }),
  ]),
  2: Object.freeze([
    Object.freeze({
      videoPath: '/assets/story/descent-part2/CH2-1.mp4',
      imagePath: '/assets/story/descent-part2/slide-01-forgotten-breath.png',
      eyebrow: 'DEEP SEA RECORD / 04',
      title: '不再需要氧氣的生命',
      narrator: '越往下，越少生物需要氧氣。牠們不是適應了死亡，而是被迫學會忘記呼吸。',
    }),
    Object.freeze({
      videoPath: '/assets/story/descent-part2/CH2-2.mp4',
      imagePath: '/assets/story/descent-part2/slide-02-sealed-wound.png',
      eyebrow: 'DEEP SEA RECORD / 05',
      title: '核心也封住了傷口',
      narrator: '熱泉的脈動告訴我：核心不只污染生命，也堵住了海床深處的裂口。拔出它，傷口也會醒來。',
    }),
    Object.freeze({
      videoPath: '/assets/story/descent-part2/CH2-3.mp4',
      imagePath: '/assets/story/descent-part2/slide-03-no-harmless-answer.png',
      eyebrow: 'DEEP SEA RECORD / 06',
      title: '沒有無害的答案',
      narrator: '我仍必須向下。若留下核心，世界會慢慢窒息；若帶走它，深海會立刻流血。',
    }),
  ]),
  3: Object.freeze([
    Object.freeze({
      videoPath: '/assets/story/descent-part3/CH3-1.mp4',
      imagePath: '/assets/story/descent-part3/slide-01-ruins-remember.png',
      eyebrow: 'DEEP SEA RECORD / 07',
      title: '遺跡記得第一次墜落',
      narrator: '石壁留下的不是祭祀，而是警告。這顆核心從來不是海洋的心臟，而是終止人類戰爭的異文明武器。',
    }),
    Object.freeze({
      videoPath: '/assets/story/descent-part3/CH3-2.mp4',
      imagePath: '/assets/story/descent-part3/slide-02-sleeping-guardian.png',
      eyebrow: 'DEEP SEA RECORD / 08',
      title: '守護者仍在沉睡',
      narrator: '遺跡深處，有某種巨大生命與裂口一同呼吸。牠守護的不是寶藏，而是這個勉強維持的封印。',
    }),
    Object.freeze({
      videoPath: '/assets/story/descent-part3/CH3-3.mp4',
      imagePath: '/assets/story/descent-part3/slide-03-atonement-choice.png',
      eyebrow: 'DEEP SEA RECORD / 09',
      title: '謝罪不是得到原諒',
      narrator: '我已抵達核心。拔出它不會洗清人類的罪，只會把選擇的後果交到我的手上。',
    }),
  ]),
});

export const PLAY_STORY_INTRO_SLIDES = PLAY_STORY_INTRO_SLIDES_BY_PART[1];

const normalizeStoryPart = (part) => Math.min(3, Math.max(1, Math.floor(Number(part) || 1)));

export function getPlayStoryIntroSlides(part = 1) {
  return PLAY_STORY_INTRO_SLIDES_BY_PART[normalizeStoryPart(part)];
}

export function createPlayStoryIntroState({ enabled = true, reducedMotion = false, part = 1 } = {}) {
  const normalizedPart = normalizeStoryPart(part);
  const slides = getPlayStoryIntroSlides(normalizedPart);
  return {
    active: Boolean(enabled),
    part: normalizedPart,
    slideIndex: 0,
    typedCharacters: reducedMotion ? slides[0].narrator.length : 0,
    reducedMotion: Boolean(reducedMotion),
  };
}

export function getPlayStoryIntroSlide(state) {
  const slides = getPlayStoryIntroSlides(state?.part);
  const index = Math.min(
    slides.length - 1,
    Math.max(0, Math.floor(Number(state?.slideIndex) || 0)),
  );
  return slides[index] ?? slides[0];
}

export function getPlayStoryIntroRenderState(state) {
  const slide = getPlayStoryIntroSlide(state);
  const typedCharacters = Math.min(
    slide.narrator.length,
    Math.max(0, Math.floor(Number(state?.typedCharacters) || 0)),
  );
  const active = Boolean(state?.active);
  const slides = getPlayStoryIntroSlides(state?.part);
  const slideIndex = Math.min(slides.length - 1, Math.max(0, Math.floor(Number(state?.slideIndex) || 0)));
  return Object.freeze({
    active,
    blocksGameplay: active,
    part: normalizeStoryPart(state?.part),
    slideIndex,
    slideNumber: slideIndex + 1,
    totalSlides: slides.length,
    videoPath: slide.videoPath,
    imagePath: slide.imagePath,
    eyebrow: slide.eyebrow,
    title: slide.title,
    narrator: slide.narrator,
    typedText: slide.narrator.slice(0, typedCharacters),
    typedCharacters,
    textComplete: typedCharacters >= slide.narrator.length,
    progress: (slideIndex + 1) / slides.length,
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
  const slides = getPlayStoryIntroSlides(state.part);
  if (state.slideIndex < slides.length - 1) {
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
