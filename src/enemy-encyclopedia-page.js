import { AFTERIMAGE_PROFILE } from './afterimage.js';
import {
  formatEncyclopediaValue,
  getLocalizedEncyclopedia,
  getStoredEncyclopediaLocale,
} from './i18n-encyclopedia.js';
import { attachMenuMusic } from './music.js';

attachMenuMusic(document);

const encyclopedia = getLocalizedEncyclopedia(getStoredEncyclopediaLocale());
const {
  enemies: ENEMY_ENCYCLOPEDIA,
  locale,
  mapEntries: MAP_ENCYCLOPEDIA,
  passives: PASSIVE_ENCYCLOPEDIA,
  sections: ENCYCLOPEDIA_SECTIONS,
  ui,
  weapons: WEAPON_ENCYCLOPEDIA,
} = encyclopedia;

document.documentElement.lang = locale;
document.title = ui.pageTitle;
document.querySelectorAll('[data-i18n]').forEach((element) => {
  const value = ui[element.dataset.i18n];
  if (typeof value === 'string') element.textContent = value;
});
document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
  const value = ui[element.dataset.i18nAria];
  if (typeof value === 'string') element.setAttribute('aria-label', value);
});
[
  ['/home.html', ui.navHome],
  ['/play.html', ui.navPlay],
  ['/', ui.navEditor],
  ['/sandbox.html', ui.navSandbox],
].forEach(([href, label]) => {
  const link = document.querySelector(`.encyclopedia-header a[href="${href}"]`);
  if (link) link.textContent = label;
});

const sectionFilters = document.querySelector('#section-filters');
const tierFilters = document.querySelector('#tier-filters');
const sectionSummary = document.querySelector('#section-summary');
const enemyGrid = document.querySelector('#enemy-grid');
const afterimageControls = document.querySelector('.afterimage-controls');
const afterimageToggle = document.querySelector('#afterimage-toggle');
const tierOrder = ['all', 1, 2, 3, 4, 'miniBoss', 'mutatedMiniBoss', 'finalBoss'];
const tierLabels = ui.tierLabels;
const tierDescriptions = ui.tierDescriptions;
const weaponTypeLabels = ui.weaponTypeLabels;
const entryValueLabels = ui.entryValueLabels;
let activeSection = 'enemies';
let activeTier = 'all';
let afterimageEnabled = afterimageToggle?.checked ?? false;

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function attackValues(attack) {
  return Object.entries(attack)
    .filter(([key, value]) => !['id', 'name', 'type', 'description'].includes(key) && value !== undefined)
    .map(([key, value]) => `<span><b>${escapeHtml(ui.attackValueLabels[key] ?? key)}</b>${escapeHtml(formatEncyclopediaValue(key, value, locale))}</span>`)
    .join('');
}

function formatEntryValue(key, value) {
  if (key.endsWith('Multiplier')) {
    const percent = Math.round((value - 1) * 100);
    return `${percent > 0 ? '+' : ''}${percent}%`;
  }
  if (key.endsWith('Ratio')) return `${Math.round(value * 100)}%`;
  if (typeof value === 'number' && (key.toLowerCase().includes('cooldown') || key.toLowerCase().includes('interval') || key.toLowerCase().includes('duration'))) return `${value} ${ui.seconds}`;
  if (typeof value === 'boolean') return value ? ui.yes : ui.no;
  return String(value);
}

function entryValues(values) {
  return Object.entries(values)
    .filter(([key, value]) => value !== undefined && value !== null && typeof value !== 'object')
    .map(([key, value]) => `<span><b>${escapeHtml(entryValueLabels[key] ?? key)}</b>${escapeHtml(formatEntryValue(key, value))}</span>`)
    .join('');
}

function lorePanel(lore) {
  return `<section class="lore-panel" data-lore-panel hidden>
    <div class="lore-panel-heading"><h3>${escapeHtml(ui.loreHeading)}</h3><span>${escapeHtml(ui.loreSubheading)}</span></div>
    <dl class="lore-grid">
      <div><dt>${escapeHtml(ui.scientificReference)}</dt><dd>${escapeHtml(lore.scientificReference)}</dd></div>
      <div><dt>${escapeHtml(ui.identification)}</dt><dd>${escapeHtml(lore.identification)}</dd></div>
      <div><dt>${escapeHtml(ui.visualSetting)}</dt><dd>${escapeHtml(lore.visualSetting)}</dd></div>
    </dl>
    <p class="lore-note">${escapeHtml(ui.loreNote)}</p>
  </section>`;
}

function getPreviewSource(enemy, attackId) {
  const normalSource = attackId ? enemy.visuals?.actions?.[attackId] : enemy.visuals?.idle;
  const trailSource = attackId ? enemy.visuals?.afterimageActions?.[attackId] : enemy.visuals?.afterimageIdle;
  const showingAfterimage = afterimageEnabled && Boolean(trailSource);
  return { source: showingAfterimage ? trailSource : normalSource, showingAfterimage };
}

function enemyCard(enemy) {
  const hasIdle = Boolean(enemy.visuals?.idle);
  const { source: previewSource, showingAfterimage } = getPreviewSource(enemy);
  const preview = hasIdle
    ? `<img class="enemy-preview-image" src="${previewSource}" alt="${escapeHtml(enemy.name)} ${escapeHtml(ui.naturalDrift)}" data-preview-image />`
    : `<div class="enemy-preview-placeholder"><span>GIF</span><small>${escapeHtml(ui.animationPending)}</small></div>`;
  const actions = enemy.attacks.map((attack) => {
    const hasAnimation = Boolean(enemy.visuals?.actions?.[attack.id]);
    return `<button class="action-button${hasAnimation ? '' : ' is-unavailable'}" type="button" data-action-id="${escapeHtml(attack.id)}" ${hasAnimation ? '' : 'aria-disabled="true"'}>${escapeHtml(attack.name)}${hasAnimation ? '' : ` · ${escapeHtml(ui.materialPending)}`}</button>`;
  }).join('');
  return `<article class="enemy-card" data-tier="${escapeHtml(enemy.tier)}" data-enemy-id="${escapeHtml(enemy.id)}" data-selected-action="idle">
    <div class="enemy-card-heading">
      <div><span class="tier-chip">${escapeHtml(enemy.tierLabel)}</span><h2>${escapeHtml(enemy.name)}</h2></div>
      <div class="enemy-heading-meta"><span class="role-label">${escapeHtml(enemy.role)}</span><button class="lore-button" type="button" data-lore-toggle aria-expanded="false">${escapeHtml(ui.loreButton)}</button></div>
    </div>
    <div class="enemy-preview" data-preview-panel>${preview}<p data-preview-caption>${hasIdle ? `${escapeHtml(ui.naturalDrift)}${showingAfterimage ? ` · ${escapeHtml(ui.authoredAfterimage)}` : ''}` : escapeHtml(ui.noPreview)}</p></div>
    <div class="preview-actions">${actions}</div>
    <dl class="enemy-stats"><div><dt>${escapeHtml(ui.health)}</dt><dd>${enemy.maxHealth}</dd></div><div><dt>${escapeHtml(ui.moveSpeed)}</dt><dd>${enemy.moveSpeed}</dd></div><div><dt>${escapeHtml(ui.skills)}</dt><dd>${enemy.attacks.length}</dd></div></dl>
    <section class="enemy-description" data-enemy-description><h3>${escapeHtml(ui.ecology)}</h3><p>${escapeHtml(enemy.description)}</p></section>
    <section class="selected-skill-panel" data-skill-panel hidden></section>
    ${lorePanel(enemy.lore)}
  </article>`;
}

function mapCard(entry) {
  return `<article class="entry-card map-card" data-placement-id="${escapeHtml(entry.placementId)}">
    <div class="entry-card-heading"><div><span class="tier-chip">${escapeHtml(entry.group)}</span><h2>${escapeHtml(entry.name)}</h2></div><span class="placement-label">${escapeHtml(entry.placement)}</span></div>
    <p class="entry-description">${escapeHtml(entry.description)}</p>
    <dl class="entry-details">${entry.details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
  </article>`;
}

function levelList(entry) {
  return `<ol class="level-list">${entry.levels.map((level) => `<li><img class="level-icon" src="${escapeHtml(level.icon)}" alt="${escapeHtml(entry.name)} Lv.${level.level} ${escapeHtml(ui.levelIcon)}" /><div class="level-content"><div class="level-heading"><strong>Lv.${level.level}</strong><span>${escapeHtml(level.summary)}</span></div><div class="entry-values">${entryValues(level.values)}</div></div></li>`).join('')}</ol>`;
}

function weaponCard(weapon) {
  return `<article class="entry-card build-card">
    <div class="entry-card-heading"><div><span class="tier-chip">${escapeHtml(ui.weapon)} · ${escapeHtml(weapon.typeLabel ?? weaponTypeLabels[weapon.type] ?? weapon.type)}</span><h2>${escapeHtml(weapon.name)}</h2></div><span class="role-label">${escapeHtml(ui.maximum)} Lv.${weapon.maxLevel}</span></div>
    <p class="entry-role"><b>${escapeHtml(ui.role)}</b>${escapeHtml(weapon.role)}</p>
    <p class="entry-description">${escapeHtml(weapon.description)}</p>
    ${levelList(weapon)}
    <a class="sandbox-entry-link" href="/sandbox.html">${escapeHtml(ui.openSandbox)}</a>
  </article>`;
}

function passiveCard(passive) {
  return `<article class="entry-card build-card">
    <div class="entry-card-heading"><div><span class="tier-chip">${escapeHtml(ui.passive)}</span><h2>${escapeHtml(passive.name)}</h2></div><span class="role-label">${escapeHtml(ui.maximum)} Lv.${passive.maxLevel}</span></div>
    <p class="entry-role"><b>${escapeHtml(ui.role)}</b>${escapeHtml(passive.role)}</p>
    <p class="entry-description">${escapeHtml(passive.description)}</p>
    ${levelList(passive)}
  </article>`;
}

function renderEnemyCards() {
  enemyGrid.innerHTML = ENEMY_ENCYCLOPEDIA
    .filter((enemy) => activeTier === 'all' || String(enemy.tier) === String(activeTier))
    .map(enemyCard)
    .join('');
}

function renderSection(sectionId) {
  activeSection = sectionId;
  const section = ENCYCLOPEDIA_SECTIONS.find(({ id }) => id === sectionId) ?? ENCYCLOPEDIA_SECTIONS[0];
  sectionFilters.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.section === section.id));
  sectionSummary.innerHTML = `<strong>${escapeHtml(section.label)}</strong><span>${escapeHtml(section.description)}</span>`;
  const isEnemySection = section.id === 'enemies';
  tierFilters.hidden = !isEnemySection;
  afterimageControls.hidden = !isEnemySection;
  if (section.id === 'map') enemyGrid.innerHTML = MAP_ENCYCLOPEDIA.map(mapCard).join('');
  if (section.id === 'weapons') enemyGrid.innerHTML = WEAPON_ENCYCLOPEDIA.map(weaponCard).join('');
  if (section.id === 'passives') enemyGrid.innerHTML = PASSIVE_ENCYCLOPEDIA.map(passiveCard).join('');
  if (isEnemySection) renderEnemyCards();
}

function setActiveTier(tier) {
  activeTier = tier;
  tierFilters.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.filter === String(tier)));
  sectionSummary.innerHTML = `<strong>${escapeHtml(tierLabels[tier])}</strong><span>${escapeHtml(tierDescriptions[tier])}</span>`;
  renderEnemyCards();
}

sectionFilters.innerHTML = ENCYCLOPEDIA_SECTIONS
  .map((section) => `<button type="button" data-section="${escapeHtml(section.id)}">${escapeHtml(section.label)}</button>`)
  .join('');
tierFilters.innerHTML = tierOrder.map((tier) => `<button type="button" data-filter="${tier}">${tierLabels[tier]}</button>`).join('');

sectionFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-section]');
  if (button) renderSection(button.dataset.section);
});

tierFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (button) setActiveTier(button.dataset.filter);
});

afterimageToggle.checked = afterimageEnabled;
afterimageToggle.addEventListener('change', () => {
  afterimageEnabled = afterimageToggle.checked;
  if (activeSection !== 'enemies') return;
  enemyGrid.querySelectorAll('.enemy-card').forEach((card) => {
    const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
    if (enemy) updatePreview(card, enemy, card.dataset.selectedAction === 'idle' ? undefined : card.dataset.selectedAction);
  });
});

function updatePreview(card, enemy, attackId) {
  const image = card.querySelector('[data-preview-image]');
  const caption = card.querySelector('[data-preview-caption]');
  const { source, showingAfterimage } = getPreviewSource(enemy, attackId);
  const attack = enemy.attacks.find(({ id }) => id === attackId);
  const enemyDescription = card.querySelector('[data-enemy-description]');
  const skillPanel = card.querySelector('[data-skill-panel]');
  if (source && image) {
    image.hidden = false;
    image.src = source;
    image.alt = `${enemy.name} ${attack?.name ?? ui.naturalDrift}`;
    caption.textContent = `${attack?.name ?? ui.naturalDrift}${showingAfterimage ? ` · ${ui.authoredAfterimage}` : ''}`;
  } else {
    if (image) {
      image.removeAttribute('src');
      image.hidden = true;
      image.alt = '';
    }
    caption.textContent = attack ? `${attack.name}: ${ui.valuesAvailable}` : ui.noPreview;
  }
  if (attack) {
    enemyDescription.hidden = true;
    skillPanel.hidden = false;
    skillPanel.innerHTML = `<h3>${escapeHtml(attack.name)}</h3><p class="skill-type">${escapeHtml(attack.typeLabel ?? ui.skillTypeLabels[attack.type] ?? attack.type)}</p><p class="skill-description">${escapeHtml(attack.description)}</p><div class="skill-values">${attackValues(attack)}</div>`;
  } else {
    enemyDescription.hidden = false;
    skillPanel.hidden = true;
    skillPanel.innerHTML = '';
  }
}

enemyGrid.addEventListener('click', (event) => {
  const loreButton = event.target.closest('[data-lore-toggle]');
  if (loreButton) {
    const card = loreButton.closest('.enemy-card');
    const panel = card?.querySelector('[data-lore-panel]');
    if (!card || !panel) return;
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    loreButton.setAttribute('aria-expanded', String(!isOpen));
    panel.classList.toggle('is-open', !isOpen);
    card.classList.toggle('is-lore-open', !isOpen);
    card.dataset.selectedAction = 'idle';
    card.querySelectorAll('.action-button').forEach((candidate) => candidate.classList.remove('is-active'));
    const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
    if (enemy) updatePreview(card, enemy, undefined);
    return;
  }
  const button = event.target.closest('[data-action-id]');
  if (!button) return;
  const card = button.closest('.enemy-card');
  const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
  if (!enemy) return;
  const clickedAttackId = button.dataset.actionId;
  const attackId = card.dataset.selectedAction === clickedAttackId ? undefined : clickedAttackId;
  card.dataset.selectedAction = attackId ?? 'idle';
  card.querySelectorAll('.action-button').forEach((candidate) => candidate.classList.remove('is-active'));
  if (attackId) button.classList.add('is-active');
  updatePreview(card, enemy, attackId);
});

document.querySelector('#afterimage-profile').textContent = `${AFTERIMAGE_PROFILE.sampleCount} ${ui.afterimageFrames}: ${Math.round(AFTERIMAGE_PROFILE.nearestOpacity * 100)}% → ${Math.round(AFTERIMAGE_PROFILE.opacities.at(-1) * 100)}%, ${ui.afterimageOffset} ${AFTERIMAGE_PROFILE.driftX}px`;
renderSection('enemies');
setActiveTier('all');
