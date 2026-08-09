import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoryTypingSound } from '../src/story-typing-sound.js';

test('typing sound stays safe when Web Audio is unavailable', () => {
  const sound = createStoryTypingSound();
  assert.equal(sound.unlock(), false);
  assert.equal(sound.play(), false);
  sound.dispose();
});
