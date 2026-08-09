import { MUSIC_TRACKS, attachMusicControls, createMusicController } from './music.js';
import { attachHomeMapPreview } from './home-map-preview.js';

const musicController = createMusicController({ ...MUSIC_TRACKS.mainMenu, startAt: 75 });
attachMusicControls(document.querySelector('#home-music-control'), musicController);

function startFromUserGesture() {
  musicController.start();
  window.removeEventListener('pointerdown', startFromUserGesture);
  window.removeEventListener('keydown', startFromUserGesture);
}

musicController.start();
window.addEventListener('pointerdown', startFromUserGesture, { once: true });
window.addEventListener('keydown', startFromUserGesture, { once: true });

attachHomeMapPreview(document.querySelector('#home-helmet-preview'));
