import tutorialMarkdown from '../GDD/06_體驗/教學.md?raw';
import tutorialEnglishMarkdown from '../GDD/06_體驗/教學.en.md?raw';
import { applyDocumentLanguage, getLanguage, setLanguage, subscribeLanguage } from './i18n.js';
import { renderMarkdown } from './markdown-renderer.js';

if (typeof document !== 'undefined') {
  const content = document.querySelector('#tutorial-content');
  const languageButtons = [...document.querySelectorAll('[data-tutorial-language]')];

  const renderTutorial = (language = getLanguage()) => {
    const activeLanguage = applyDocumentLanguage(document, language);
    if (content) content.innerHTML = renderMarkdown(activeLanguage === 'zh-Hant' ? tutorialMarkdown : tutorialEnglishMarkdown);
    languageButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tutorialLanguage === activeLanguage));
    });
  };

  languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderTutorial(setLanguage(button.dataset.tutorialLanguage));
    });
  });
  subscribeLanguage((language) => renderTutorial(language));
  renderTutorial(getLanguage());
}
