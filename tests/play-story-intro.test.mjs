import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import test from 'node:test';
import {
  PLAY_STORY_INTRO_SLIDES,
  PLAY_STORY_INTRO_SLIDES_BY_PART,
  advancePlayStoryIntro,
  advancePlayStoryIntroAfterVideo,
  createPlayStoryIntroState,
  getPlayStoryIntroNarratorText,
  getPlayStoryIntroRenderState,
  getPlayStoryIntroSlides,
  skipPlayStoryIntro,
  stepPlayStoryIntro,
} from '../src/play-story-intro.js';

test('first descent story intro contains three external-text slides', () => {
  assert.equal(PLAY_STORY_INTRO_SLIDES.length, 3);
  assert.deepEqual(
    PLAY_STORY_INTRO_SLIDES.map(({ videoPath }) => videoPath),
    [
      './assets/story/descent-part1/ZH1-1.mp4',
      './assets/story/descent-part1/ZH1-2.mp4',
      './assets/story/descent-part1/ZH1-3.mp4',
    ],
  );
  assert.deepEqual(
    PLAY_STORY_INTRO_SLIDES.map(({ imagePath }) => imagePath),
    [
      './assets/story/descent-part1/slide-01-oxygen-collapse.png',
      './assets/story/descent-part1/slide-02-abyss-core.png',
      './assets/story/descent-part1/slide-03-flesh-diver.png',
    ],
  );
  assert.match(PLAY_STORY_INTRO_SLIDES[0].narrator, /氧氣正在消失/);
  assert.match(PLAY_STORY_INTRO_SLIDES[1].narrator, /生命循環的核心/);
  assert.match(PLAY_STORY_INTRO_SLIDES[2].narrator, /活著的肉身/);
});

test('each descent part owns three story slides and continues the same causal thread', () => {
  assert.deepEqual(Object.keys(PLAY_STORY_INTRO_SLIDES_BY_PART), ['1', '2', '3']);
  assert.deepEqual([1, 2, 3].map((part) => getPlayStoryIntroSlides(part).length), [3, 3, 3]);
  assert.match(getPlayStoryIntroSlides(2)[0].narrator, /忘記呼吸/);
  assert.match(getPlayStoryIntroSlides(2)[1].narrator, /堵住了海床深處的裂口/);
  assert.match(getPlayStoryIntroSlides(3)[0].narrator, /異文明武器/);
  assert.match(getPlayStoryIntroSlides(3)[1].narrator, /守護的不是寶藏/);
});

test('story slide raster assets are present and non-empty', () => {
  Object.values(PLAY_STORY_INTRO_SLIDES_BY_PART).flat().forEach(({ imagePath }) => {
    const filePath = new URL(`../public/${imagePath.replace(/^\.?\//, '')}`, import.meta.url);
    assert.equal(existsSync(filePath), true, imagePath);
    assert.ok(statSync(filePath).size > 100_000, imagePath);
  });
});

test('story state selects the matching descent part without mixing its slides', () => {
  const partTwo = getPlayStoryIntroRenderState(createPlayStoryIntroState({ part: 2, reducedMotion: true }));
  const partThree = getPlayStoryIntroRenderState(createPlayStoryIntroState({ part: 3, reducedMotion: true }));
  assert.equal(partTwo.part, 2);
  assert.equal(partTwo.imagePath, './assets/story/descent-part2/slide-01-forgotten-breath.png');
  assert.equal(partThree.part, 3);
  assert.equal(partThree.imagePath, './assets/story/descent-part3/slide-01-ruins-remember.png');
});

test('all three descent parts use their authored chapter videos', () => {
  const expectedVideoPaths = [
    './assets/story/descent-part1/ZH1-1.mp4',
    './assets/story/descent-part1/ZH1-2.mp4',
    './assets/story/descent-part1/ZH1-3.mp4',
    './assets/story/descent-part2/CH2-1.mp4',
    './assets/story/descent-part2/CH2-2.mp4',
    './assets/story/descent-part2/CH2-3.mp4',
    './assets/story/descent-part3/CH3-1.mp4',
    './assets/story/descent-part3/CH3-2.mp4',
    './assets/story/descent-part3/CH3-3.mp4',
  ];
  const actualVideoPaths = Object.values(PLAY_STORY_INTRO_SLIDES_BY_PART)
    .flat()
    .map(({ videoPath }) => videoPath);
  assert.deepEqual(actualVideoPaths, expectedVideoPaths);
  actualVideoPaths.forEach((videoPath) => {
    const filePath = new URL(`../public/${videoPath.replace(/^\.?\//, '')}`, import.meta.url);
    assert.equal(existsSync(filePath), true, videoPath);
    assert.ok(statSync(filePath).size > 100_000, videoPath);
  });
});

test('story slides with authored diver footage use suit-free framing', () => {
  assert.deepEqual(
    Object.values(PLAY_STORY_INTRO_SLIDES_BY_PART).flat().map(({ mediaFraming }) => mediaFraming ?? 'standard'),
    ['standard', 'standard', 'suit-free-right', 'suit-free-right', 'standard', 'suit-free-right', 'suit-free-right', 'standard', 'suit-free-left'],
  );
});

test('narrator types, first activation completes text, then advances slides', () => {
  const state = createPlayStoryIntroState();
  let render = getPlayStoryIntroRenderState(state);
  assert.equal(render.slideNumber, 1);
  assert.equal(render.typedText, '');
  stepPlayStoryIntro(state, .5);
  render = getPlayStoryIntroRenderState(state);
  assert.ok(render.typedCharacters > 0);
  assert.ok(render.typedCharacters < render.narrator.length);

  advancePlayStoryIntro(state);
  render = getPlayStoryIntroRenderState(state);
  assert.equal(render.textComplete, true);
  advancePlayStoryIntro(state);
  render = getPlayStoryIntroRenderState(state);
  assert.equal(render.slideNumber, 2);
  assert.equal(render.textComplete, false);
});

test('narrator typing translates the complete sentence before slicing progress', () => {
  const state = createPlayStoryIntroState();
  stepPlayStoryIntro(state, .25);
  const render = getPlayStoryIntroRenderState(state);
  const english = getPlayStoryIntroNarratorText(state, (value) => (
    value === render.narrator ? 'The complete translated narration.' : 'unexpected fallback'
  ));
  assert.notEqual(english, 'unexpected fallback');
  assert.ok(english.length > 0);
  assert.ok(english.length < 'The complete translated narration.'.length);
});

test('video completion advances directly instead of replaying the ended slide', () => {
  const state = createPlayStoryIntroState();
  const firstVideo = getPlayStoryIntroRenderState(state).videoPath;
  const next = advancePlayStoryIntroAfterVideo(state);
  assert.equal(next.slideNumber, 2);
  assert.equal(next.typedCharacters, 0);
  assert.notEqual(next.videoPath, firstVideo);
});

test('the final video completion closes the story intro', () => {
  const state = createPlayStoryIntroState({ reducedMotion: true });
  advancePlayStoryIntroAfterVideo(state);
  advancePlayStoryIntroAfterVideo(state);
  const render = advancePlayStoryIntroAfterVideo(state);
  assert.equal(render.active, false);
  assert.equal(render.blocksGameplay, false);
});

test('final slide closes the story intro and releases gameplay', () => {
  const state = createPlayStoryIntroState({ reducedMotion: true });
  advancePlayStoryIntro(state);
  advancePlayStoryIntro(state);
  const render = advancePlayStoryIntro(state);
  assert.equal(render.active, false);
  assert.equal(render.blocksGameplay, false);
});

test('skip closes the story without mutating the authored slide list', () => {
  const state = createPlayStoryIntroState();
  const render = skipPlayStoryIntro(state);
  assert.equal(render.active, false);
  assert.equal(render.slideNumber, 1);
  assert.equal(PLAY_STORY_INTRO_SLIDES.length, 3);
});
