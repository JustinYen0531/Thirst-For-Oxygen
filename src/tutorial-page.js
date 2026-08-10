import tutorialMarkdown from '../GDD/06_體驗/教學.md?raw';
import { renderMarkdown } from './markdown-renderer.js';

if (typeof document !== 'undefined') {
  const content = document.querySelector('#tutorial-content');
  if (content) content.innerHTML = renderMarkdown(tutorialMarkdown);
}
