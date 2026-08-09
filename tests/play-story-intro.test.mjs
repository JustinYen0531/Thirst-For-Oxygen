import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import test from 'node:test';
import {
  PLAY_STORY_INTRO_SLIDES,
  advancePlayStoryIntro,
  createPlayStoryIntroState,
  getPlayStoryIntroRenderState,
  skipPlayStoryIntro,
  stepPlayStoryIntro,
} from '../src/play-story-intro.js';

test('first descent story intro contains three external-text slides', () => {
  assert.equal(PLAY_STORY_INTRO_SLIDES.length, 3);
  assert.deepEqual(
    PLAY_STORY_INTRO_SLIDES.map(({ imagePath }) => imagePath),
    [
      '/assets/story/descent-part1/slide-01-oxygen-collapse.png',
      '/assets/story/descent-part1/slide-02-abyss-core.png',
      '/assets/story/descent-part1/slide-03-flesh-diver.png',
    ],
  );
  assert.match(PLAY_STORY_INTRO_SLIDES[0].narrator, /氧氣正在消失/);
  assert.match(PLAY_STORY_INTRO_SLIDES[1].narrator, /生命循環的核心/);
  assert.match(PLAY_STORY_INTRO_SLIDES[2].narrator, /活著的肉身/);
});

test('story slide raster assets are present and non-empty', () => {
  PLAY_STORY_INTRO_SLIDES.forEach(({ imagePath }) => {
    const filePath = new URL(`..\/public${imagePath}`, import.meta.url);
    assert.equal(existsSync(filePath), true, imagePath);
    assert.ok(statSync(filePath).size > 100_000, imagePath);
  });
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
