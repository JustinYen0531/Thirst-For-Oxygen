import { ATTACK_VALUE_LABELS, ENEMY_ENCYCLOPEDIA, formatAttackValue } from './enemy-encyclopedia.js';
import { AFTERIMAGE_PROFILE } from './afterimage.js';

const tierFilters = document.querySelector('#tier-filters');
const enemyGrid = document.querySelector('#enemy-grid');
const afterimageToggle = document.querySelector('#afterimage-toggle');
const tierOrder = ['all', 1, 2, 3, 4, 'miniBoss', 'mutatedMiniBoss', 'finalBoss'];
const tierLabels = { all: '全部', 1: '等級 1', 2: '等級 2', 3: '等級 3', 4: '等級 4', miniBoss: '小 Boss', mutatedMiniBoss: '變異小 Boss', finalBoss: 'Final Boss' };
let afterimageEnabled = true;

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function attackValues(attack) {
  return Object.entries(attack)
    .filter(([key, value]) => !['id', 'name', 'type'].includes(key) && value !== undefined)
    .map(([key, value]) => `<span><b>${escapeHtml(ATTACK_VALUE_LABELS[key] ?? key)}</b>${escapeHtml(formatAttackValue(key, value))}</span>`)
    .join('');
}

function lorePanel(lore) {
  return `<section class="lore-panel" data-lore-panel hidden>
    <div class="lore-panel-heading"><h3>LORE / 生物檔案</h3><span>視覺與原型參考</span></div>
    <dl class="lore-grid">
      <div><dt>現實生物參考</dt><dd>${escapeHtml(lore.scientificReference)}</dd></div>
      <div><dt>識別特徵</dt><dd>${escapeHtml(lore.identification)}</dd></div>
      <div><dt>視覺設定</dt><dd>${escapeHtml(lore.visualSetting)}</dd></div>
    </dl>
    <p class="lore-note">這些參考提供輪廓、部位與動作靈感，不代表現實生物的寫實複製。</p>
  </section>`;
}

function enemyCard(enemy) {
  const hasIdle = Boolean(enemy.visuals?.idle);
  const previewSource = enemy.visuals?.afterimageIdle ?? enemy.visuals?.idle;
  const preview = hasIdle
    ? `<img class="enemy-preview-image" src="${previewSource}" alt="${escapeHtml(enemy.name)} 自然漂浮" data-preview-image />`
    : '<div class="enemy-preview-placeholder"><span>GIF</span><small>動畫素材待補</small></div>';
  const actions = enemy.attacks.map((attack) => {
    const hasAnimation = Boolean(enemy.visuals?.actions?.[attack.id]);
    return `<button class="action-button${hasAnimation ? '' : ' is-unavailable'}" type="button" data-action-id="${escapeHtml(attack.id)}" ${hasAnimation ? '' : 'aria-disabled="true"'}>${escapeHtml(attack.name)}${hasAnimation ? '' : ' · 待素材'}</button>`;
  }).join('');
  return `<article class="enemy-card" data-tier="${escapeHtml(enemy.tier)}" data-enemy-id="${escapeHtml(enemy.id)}" data-selected-action="idle">
    <div class="enemy-card-heading">
      <div><span class="tier-chip">${escapeHtml(enemy.tierLabel)}</span><h2>${escapeHtml(enemy.name)}</h2></div>
      <div class="enemy-heading-meta"><span class="role-label">${escapeHtml(enemy.role)}</span><button class="lore-button" type="button" data-lore-toggle aria-expanded="false">Lore 檔案</button></div>
    </div>
    <div class="enemy-preview" data-preview-panel>${preview}<p data-preview-caption>${hasIdle ? '自然漂浮 · 正式殘影' : '目前沒有 GIF 預覽素材'}</p></div>
    <div class="preview-actions">${actions}</div>
    <dl class="enemy-stats"><div><dt>生命</dt><dd>${enemy.maxHealth}</dd></div><div><dt>移速</dt><dd>${enemy.moveSpeed}</dd></div><div><dt>技能</dt><dd>${enemy.attacks.length}</dd></div></dl>
    <section class="enemy-description" data-enemy-description><h3>生態觀察</h3><p>${escapeHtml(enemy.description)}</p></section>
    <section class="selected-skill-panel" data-skill-panel hidden></section>
    ${lorePanel(enemy.lore)}
  </article>`;
}

function renderCards(filter = 'all') {
  enemyGrid.innerHTML = ENEMY_ENCYCLOPEDIA
    .filter((enemy) => filter === 'all' || String(enemy.tier) === String(filter))
    .map(enemyCard)
    .join('');
}

function setActiveFilter(filter) {
  tierFilters.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.filter === String(filter)));
  renderCards(filter);
}

function updatePreview(card, enemy, attackId) {
  const image = card.querySelector('[data-preview-image]');
  const caption = card.querySelector('[data-preview-caption]');
  const normalSource = attackId ? enemy.visuals?.actions?.[attackId] : enemy.visuals?.idle;
  const trailSource = attackId ? enemy.visuals?.afterimageActions?.[attackId] : enemy.visuals?.afterimageIdle;
  const source = afterimageEnabled && trailSource ? trailSource : normalSource;
  const attack = enemy.attacks.find(({ id }) => id === attackId);
  const enemyDescription = card.querySelector('[data-enemy-description]');
  const skillPanel = card.querySelector('[data-skill-panel]');
  if (source && image) {
    image.src = source;
    image.alt = `${enemy.name} ${attack?.name ?? '自然漂浮'}`;
    caption.textContent = `${attack?.name ?? '自然漂浮'}${afterimageEnabled && trailSource ? ' · 正式殘影' : ''}`;
  } else {
    caption.textContent = attack ? `${attack.name}：動畫素材待補，數值已可查閱` : '目前沒有 GIF 預覽素材';
  }
  if (attack) {
    enemyDescription.hidden = true;
    skillPanel.hidden = false;
    skillPanel.innerHTML = `<h3>${escapeHtml(attack.name)}</h3><p class="skill-type">${escapeHtml(attack.type)}</p><p class="skill-description">${escapeHtml(attack.description)}</p><div class="skill-values">${attackValues(attack)}</div>`;
  } else {
    enemyDescription.hidden = false;
    skillPanel.hidden = true;
    skillPanel.innerHTML = '';
  }
}

tierFilters.innerHTML = tierOrder.map((tier) => `<button type="button" data-filter="${tier}">${tierLabels[tier]}</button>`).join('');
tierFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (button) setActiveFilter(button.dataset.filter);
});

afterimageToggle.checked = afterimageEnabled;
afterimageToggle.addEventListener('change', () => {
  afterimageEnabled = afterimageToggle.checked;
  enemyGrid.querySelectorAll('.enemy-card').forEach((card) => {
    const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
    if (enemy) updatePreview(card, enemy, card.dataset.selectedAction === 'idle' ? undefined : card.dataset.selectedAction);
  });
});

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
    if (!isOpen) {
      card.dataset.selectedAction = 'idle';
      card.querySelectorAll('.action-button').forEach((candidate) => candidate.classList.remove('is-active'));
      const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
      if (enemy) updatePreview(card, enemy, undefined);
    } else {
      const enemy = ENEMY_ENCYCLOPEDIA.find(({ id }) => id === card.dataset.enemyId);
      if (enemy) updatePreview(card, enemy, undefined);
    }
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

setActiveFilter('all');

document.querySelector('#afterimage-profile').textContent = `${AFTERIMAGE_PROFILE.sampleCount} 幀：${Math.round(AFTERIMAGE_PROFILE.nearestOpacity * 100)}% → ${Math.round(AFTERIMAGE_PROFILE.opacities.at(-1) * 100)}%，每幀偏移 ${AFTERIMAGE_PROFILE.driftX}px`;
