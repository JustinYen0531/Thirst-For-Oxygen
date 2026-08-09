export const LANGUAGE_STORAGE_KEY = 'thirst-for-oxygen-language';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'zh-Hant']);

const TRANSLATIONS = Object.freeze({
  'home.documentTitle': Object.freeze({ en: 'Thirst for Oxygen', 'zh-Hant': 'Thirst for Oxygen' }),
  'home.intro.frontAria': Object.freeze({ en: 'Click anywhere to turn the deep-sea helmet sideways', 'zh-Hant': '點擊任意位置，讓深海頭盔轉向側面' }),
  'home.intro.sideAria': Object.freeze({ en: 'The deep-sea helmet is facing sideways', 'zh-Hant': '深海頭盔已轉向側面' }),
  'home.enemyFieldAria': Object.freeze({ en: 'Enemies hidden in the deep sea', 'zh-Hant': '隱藏在深海中的敵人' }),
  'home.helmet.frontAlt': Object.freeze({ en: 'An ancient deep-sea diving helmet facing the player', 'zh-Hant': '正面朝向玩家的古老深海潛水頭盔' }),
  'home.mapLensAria': Object.freeze({ en: 'Playable map route inside the helmet visor', 'zh-Hant': '頭盔面罩中的正式遊戲地圖巡覽' }),
  'home.mapCanvasAria': Object.freeze({ en: 'Descent map tour from Part One to Part Three', 'zh-Hant': '下沉篇第一至第三部分地圖巡覽' }),
  'home.map.noSignal': Object.freeze({ en: 'NO SIGNAL', 'zh-Hant': '無訊號' }),
  'home.map.loading': Object.freeze({ en: 'Loading playable maps…', 'zh-Hant': '正在讀取遊戲地圖…' }),
  'home.map.partOne': Object.freeze({ en: 'Part One | Deep-Sea Forest Entrance', 'zh-Hant': '第一部分｜深海森林入口' }),
  'home.map.autoDive': Object.freeze({ en: 'Automatic descent', 'zh-Hant': '自動下潛' }),
  'home.map.pause': Object.freeze({ en: 'Ⅱ Pause tour', 'zh-Hant': 'Ⅱ 暫停巡覽' }),
  'home.map.loadFailed': Object.freeze({ en: 'Playable map failed to load', 'zh-Hant': '真實地圖讀取失敗' }),
  'home.signalAria': Object.freeze({ en: 'Tap the helmet visor', 'zh-Hant': '敲一下頭盔面罩' }),
  'home.menuPanelAria': Object.freeze({ en: 'Thirst for Oxygen main menu', 'zh-Hant': 'Thirst for Oxygen 主選單' }),
  'home.mainMenuAria': Object.freeze({ en: 'Main menu', 'zh-Hant': '主選單' }),
  'home.menu.play': Object.freeze({ en: 'Start Game', 'zh-Hant': '開始遊玩' }),
  'home.menu.encyclopedia': Object.freeze({ en: 'World Encyclopedia', 'zh-Hant': '世界圖鑑' }),
  'home.menu.sandbox': Object.freeze({ en: 'Enemy Sandbox', 'zh-Hant': '敵人沙盒' }),
  'home.menu.editor': Object.freeze({ en: 'Map Editor', 'zh-Hant': '地圖編輯器' }),
  'home.menu.settings': Object.freeze({ en: 'Settings', 'zh-Hant': '設定' }),
  'home.tapPrompt': Object.freeze({ en: 'Tap anywhere to begin', 'zh-Hant': '點擊任意位置開始' }),
  'home.status.front': Object.freeze({ en: 'The helmet is facing forward.', 'zh-Hant': '頭盔目前面向正前方。' }),
  'home.status.turning': Object.freeze({ en: 'The helmet is turning sideways.', 'zh-Hant': '頭盔正在轉向側面。' }),
  'home.status.side': Object.freeze({ en: 'The helmet is now facing sideways.', 'zh-Hant': '頭盔已轉向側面。' }),
  'home.enemy.actionAria': Object.freeze({ en: '{enemy}: play {action}', 'zh-Hant': '{enemy}：播放{action}' }),
  'home.enemy.explodingLanternfish': Object.freeze({ en: 'Exploding Lanternfish', 'zh-Hant': '爆炸燈籠魚' }),
  'home.enemy.juvenileSeahorseCaller': Object.freeze({ en: 'Juvenile Seahorse', 'zh-Hant': '幼年海馬' }),
  'home.enemy.crabGuard': Object.freeze({ en: 'Crab Guard', 'zh-Hant': '螃蟹守衛' }),
  'home.enemy.lobsterSoldier': Object.freeze({ en: 'Lobster Soldier', 'zh-Hant': '龍蝦士兵' }),
  'home.enemy.lionfishGunner': Object.freeze({ en: 'Lionfish Gunner', 'zh-Hant': '獅子魚砲手' }),
  'home.enemy.squidAssassin': Object.freeze({ en: 'Squid Assassin', 'zh-Hant': '烏賊刺客' }),
  'home.enemy.mantisShrimpBrute': Object.freeze({ en: 'Mantis Shrimp Brute', 'zh-Hant': '螳螂蝦猛將' }),
  'home.enemy.arcTideRay': Object.freeze({ en: 'Arc-Tide Ray', 'zh-Hant': '弧潮獵鰩' }),
  'home.action.contactExplosion': Object.freeze({ en: 'Contact Explosion', 'zh-Hant': '接觸爆炸' }),
  'home.action.callForHelp': Object.freeze({ en: 'Call for Help', 'zh-Hant': '呼喚援軍' }),
  'home.action.clawSwipe': Object.freeze({ en: 'Claw Swipe', 'zh-Hant': '螯擊' }),
  'home.action.spearThrow': Object.freeze({ en: 'Spear Throw', 'zh-Hant': '長槍投擲' }),
  'home.action.spineScatter': Object.freeze({ en: 'Spine Scatter', 'zh-Hant': '棘刺散射' }),
  'home.action.inkShadowSlash': Object.freeze({ en: 'Ink Shadow Slash', 'zh-Hant': '墨影斬' }),
  'home.action.punch': Object.freeze({ en: 'Heavy Punch', 'zh-Hant': '重拳' }),
  'home.action.arcTideBombardment': Object.freeze({ en: 'Arc-Tide Bombardment', 'zh-Hant': '弧潮轟炸' }),
  'home.settings.dialogAria': Object.freeze({ en: 'Settings', 'zh-Hant': '設定' }),
  'home.settings.eyebrow': Object.freeze({ en: 'SYSTEM / SETTINGS', 'zh-Hant': '系統／設定' }),
  'home.settings.title': Object.freeze({ en: 'Settings', 'zh-Hant': '設定' }),
  'home.settings.description': Object.freeze({ en: 'Changes apply immediately and are saved on this device.', 'zh-Hant': '變更會立即生效，並儲存在這台裝置上。' }),
  'home.settings.close': Object.freeze({ en: 'Close', 'zh-Hant': '關閉' }),
  'home.settings.closeAria': Object.freeze({ en: 'Close settings', 'zh-Hant': '關閉設定' }),
  'home.settings.language': Object.freeze({ en: 'Language', 'zh-Hant': '語言' }),
  'home.settings.languageGroupAria': Object.freeze({ en: 'Choose language', 'zh-Hant': '選擇語言' }),
  'home.settings.english': Object.freeze({ en: 'English', 'zh-Hant': '英文' }),
  'home.settings.traditionalChinese': Object.freeze({ en: 'Traditional Chinese', 'zh-Hant': '繁體中文' }),
  'home.settings.selectEnglishAria': Object.freeze({ en: 'Switch language to English', 'zh-Hant': '切換語言為英文' }),
  'home.settings.selectTraditionalChineseAria': Object.freeze({ en: 'Switch language to Traditional Chinese', 'zh-Hant': '切換語言為繁體中文' }),
  'home.settings.currentLanguage': Object.freeze({ en: 'Current language: {language}', 'zh-Hant': '目前語言：{language}' }),
});

const ATTRIBUTE_BINDINGS = Object.freeze([
  Object.freeze(['data-i18n-aria-label', 'aria-label']),
  Object.freeze(['data-i18n-alt', 'alt']),
  Object.freeze(['data-i18n-title', 'title']),
  Object.freeze(['data-i18n-placeholder', 'placeholder']),
]);
const listeners = new Set();
let activeLanguage = DEFAULT_LANGUAGE;

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredLanguage(storage) {
  try {
    const stored = storage?.getItem?.(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function getLanguage(storage = undefined) {
  const resolvedStorage = storage === undefined ? defaultStorage() : storage;
  const stored = readStoredLanguage(resolvedStorage);
  if (stored) {
    if (storage === undefined) activeLanguage = stored;
    return stored;
  }
  return storage === undefined ? activeLanguage : DEFAULT_LANGUAGE;
}

export function setLanguage(language, storage = undefined) {
  const nextLanguage = normalizeLanguage(language);
  const previousLanguage = activeLanguage;
  const resolvedStorage = storage === undefined ? defaultStorage() : storage;
  try {
    resolvedStorage?.setItem?.(LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch {
    // Language switching still works for the current page when storage is unavailable.
  }
  activeLanguage = nextLanguage;
  if (nextLanguage !== previousLanguage) {
    listeners.forEach((listener) => listener(nextLanguage, previousLanguage));
  }
  return nextLanguage;
}

export function translateText(text, language = getLanguage()) {
  const entry = TRANSLATIONS[text];
  if (!entry) return text;
  return entry[normalizeLanguage(language)] ?? entry[DEFAULT_LANGUAGE] ?? text;
}

function translatableNodes(root) {
  if (!root) return [];
  const selector = ['[data-i18n]', ...ATTRIBUTE_BINDINGS.map(([dataAttribute]) => `[${dataAttribute}]`)].join(',');
  const nodes = [];
  if (typeof root.getAttribute === 'function') nodes.push(root);
  if (typeof root.querySelectorAll === 'function') nodes.push(...root.querySelectorAll(selector));
  return [...new Set(nodes)];
}

export function applyDocumentLanguage(root = globalThis.document, language = getLanguage()) {
  if (!root) return normalizeLanguage(language);
  const nextLanguage = normalizeLanguage(language);
  const documentRoot = root.nodeType === 9 ? root : root.ownerDocument ?? null;
  const html = documentRoot?.documentElement
    ?? (String(root.tagName).toLowerCase() === 'html' ? root : null);
  html?.setAttribute?.('lang', nextLanguage);
  const titleKey = html?.getAttribute?.('data-i18n-document-title');
  if (titleKey && documentRoot) documentRoot.title = translateText(titleKey, nextLanguage);

  translatableNodes(root).forEach((element) => {
    const textKey = element.getAttribute('data-i18n');
    if (textKey) element.textContent = translateText(textKey, nextLanguage);
    ATTRIBUTE_BINDINGS.forEach(([dataAttribute, attribute]) => {
      const key = element.getAttribute(dataAttribute);
      if (key) element.setAttribute(attribute, translateText(key, nextLanguage));
    });
  });
  return nextLanguage;
}

export function subscribeLanguage(listener) {
  if (typeof listener !== 'function') throw new TypeError('Language listener must be a function.');
  listeners.add(listener);
  return () => listeners.delete(listener);
}
