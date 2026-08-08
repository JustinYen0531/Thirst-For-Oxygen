import { ENEMY_DEFINITIONS, PASSIVE_ABILITIES, WEAPONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { getOxygenSecondsRemaining } from './physics.js';
import {
  PLAYER_ANIMATION_ASSETS,
  getPlayerAnimationFrameIndex,
  getPlayerAnimationMotion,
  getPlayerAnimationState,
  getPlayerFacingDirection,
  getPlayerSpriteScaleX,
} from './player-animation.js';
import {
  SANDBOX_HEIGHT,
  SANDBOX_PLAYER_INTERACTION_RADIUS,
  SANDBOX_WIDTH,
  beginSandboxAim,
  clearSandboxEnemies,
  chooseUpgrade,
  chooseUpgradeCategory,
  createSandboxState,
  executeEnemySkill,
  getSandboxEnemyIds,
  isSandboxPlayerHit,
  listSandboxSkills,
  playerAttack,
  releaseSandboxAim,
  resetSandboxPlayer,
  setSandboxBuild,
  setSandboxActiveWeapon,
  spawnSandboxEnemy,
  stepSandbox,
  updateSandboxAim,
} from './sandbox-sim.js';
import { getExperienceProgress } from './progression.js';

const canvas = document.querySelector('#sandbox-canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#sandbox-stage');
const sprites = document.querySelector('#sandbox-sprites');
const playerSprite = document.querySelector('#player-sprite');
const enemySelect = document.querySelector('#enemy-select');
const weaponSelect = document.querySelector('#weapon-select');
const weaponLevel = document.querySelector('#weapon-level');
const passiveList = document.querySelector('#passive-list');
const weaponSlots = document.querySelector('#weapon-slots');
const progressionReadout = document.querySelector('#progression-readout');
const upgradeCategoryActions = document.querySelector('#upgrade-category-actions');
const upgradeChoiceList = document.querySelector('#upgrade-choice-list');
const skillSelect = document.querySelector('#skill-select');
const skillDescription = document.querySelector('#skill-description');
const selectedEnemyName = document.querySelector('#selected-enemy-name');
const selectedEnemyStats = document.querySelector('#selected-enemy-stats');
const placedEnemyList = document.querySelector('#placed-enemy-list');
const playerStats = document.querySelector('#player-stats');
const sandboxLog = document.querySelector('#sandbox-log');
const status = document.querySelector('#sandbox-status');
const state = createSandboxState();
let placementMode = false;
let lastFrame = performance.now();

const encyclopediaById = Object.fromEntries(ENEMY_ENCYCLOPEDIA.map((enemy) => [enemy.id, enemy]));
const format = (value) => Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;

function populateControls() {
  getSandboxEnemyIds().forEach((enemyId) => {
    const option = document.createElement('option');
    option.value = enemyId;
    option.textContent = `${ENEMY_DEFINITIONS[enemyId].name} · ${ENEMY_DEFINITIONS[enemyId].role}`;
    enemySelect.append(option);
  });
  Object.values(WEAPONS).forEach((weapon) => {
    const option = document.createElement('option');
    option.value = weapon.id;
    option.textContent = weapon.name;
    weaponSelect.append(option);
  });
  Object.values(PASSIVE_ABILITIES).forEach((ability) => {
    const row = document.createElement('div');
    row.className = 'passive-row';
    const label = document.createElement('label');
    label.textContent = ability.name;
    label.htmlFor = `passive-${ability.id}`;
    const select = document.createElement('select');
    select.id = `passive-${ability.id}`;
    select.dataset.passiveId = ability.id;
    for (let level = 0; level <= ability.maxLevel; level += 1) {
      const option = document.createElement('option');
      option.value = level;
      option.textContent = level === 0 ? '關閉' : `Lv.${level}`;
      select.append(option);
    }
    row.append(label, select);
    passiveList.append(row);
  });
  updateSkillPicker();
}

function selectedEnemy() {
  return state.enemies.find((enemy) => enemy.instanceId === state.selectedEnemyInstanceId) ?? null;
}

function updateSkillPicker() {
  const enemy = selectedEnemy();
  if (!enemy) {
    skillSelect.disabled = true;
    skillDescription.textContent = '';
    skillSelect.dataset.signature = '';
    skillSelect.replaceChildren();
    selectedEnemyName.textContent = '尚未選取敵人';
    selectedEnemyStats.textContent = '點擊場上的敵人後，在這裡選擇要驗收的技能。';
    return;
  }
  const definition = ENEMY_DEFINITIONS[enemy.enemyId];
  const encyclopedia = encyclopediaById[enemy.enemyId];
  selectedEnemyName.textContent = `${definition.name}${enemy.defeated ? '（已擊敗）' : ''}`;
  selectedEnemyStats.textContent = `生命 ${Math.round(enemy.health)} / ${enemy.maxHealth}｜角色 ${definition.role}｜移速 ${definition.moveSpeed}`;
  const skills = listSandboxSkills(enemy.enemyId);
  const optionSignature = skills.map((skill) => `${skill.id}:${skill.name}:${skill.type}`).join('|');
  if (skillSelect.dataset.signature !== optionSignature) {
    skillSelect.replaceChildren();
    skills.forEach((skill) => {
      const option = document.createElement('option');
      option.value = skill.id;
      option.textContent = `${skill.name} · ${skill.type}`;
      skillSelect.append(option);
    });
    skillSelect.dataset.signature = optionSignature;
  }
  skillSelect.disabled = skills.length === 0 || enemy.defeated;
  state.selectedSkillId = skills.some((skill) => skill.id === state.selectedSkillId)
    ? state.selectedSkillId
    : (skills[0]?.id ?? null);
  skillSelect.value = state.selectedSkillId ?? '';
  skillDescription.textContent = encyclopedia?.attacks.find((skill) => skill.id === state.selectedSkillId)?.description ?? '';
}

function renderPlacedEnemyList() {
  placedEnemyList.replaceChildren();
  if (!state.enemies.length) {
    const empty = document.createElement('p');
    empty.className = 'placed-enemy-empty';
    empty.textContent = '尚未放置敵人。先在上方選擇敵人，再點擊場地。';
    placedEnemyList.append(empty);
    return;
  }
  state.enemies.forEach((enemy) => {
    const definition = ENEMY_DEFINITIONS[enemy.enemyId];
    const row = document.createElement('div');
    row.className = `placed-enemy-row${enemy.instanceId === state.selectedEnemyInstanceId ? ' selected' : ''}${enemy.defeated ? ' defeated' : ''}`;
    const heading = document.createElement('div');
    heading.className = 'placed-enemy-heading';
    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'placed-enemy-select';
    selectButton.dataset.selectEnemy = enemy.instanceId;
    selectButton.textContent = `${definition.name} · ${Math.round(enemy.health)}/${enemy.maxHealth}`;
    heading.append(selectButton);
    const badge = document.createElement('span');
    badge.className = 'placed-enemy-id';
    badge.textContent = enemy.instanceId;
    heading.append(badge);
    row.append(heading);
    const skills = document.createElement('div');
    skills.className = 'placed-enemy-skills';
    const encyclopedia = encyclopediaById[enemy.enemyId];
    listSandboxSkills(enemy.enemyId).forEach((skill) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `placed-enemy-skill${skill.id === state.selectedSkillId && enemy.instanceId === state.selectedEnemyInstanceId ? ' active' : ''}`;
      button.dataset.sandboxSkill = skill.id;
      button.dataset.instanceId = enemy.instanceId;
      button.title = encyclopedia?.attacks.find((entry) => entry.id === skill.id)?.description ?? skill.name;
      button.disabled = enemy.defeated;
      button.textContent = skill.name;
      skills.append(button);
    });
    row.append(skills);
    placedEnemyList.append(row);
  });
}

function applyBuild() {
  const passives = [...passiveList.querySelectorAll('select[data-passive-id]')]
    .map((select) => ({ id: select.dataset.passiveId, level: Number(select.value) }))
    .filter((ability) => ability.level > 0);
  setSandboxBuild(state, { weaponId: weaponSelect.value, weaponLevel: Number(weaponLevel.value), passives });
  status.textContent = `已套用 ${state.build.weapons.map((weapon) => `${WEAPONS[weapon.id].name} Lv.${weapon.level}`).join('、')} 與 ${passives.length} 個被動技能。`;
}

function renderProgression() {
  const progress = getExperienceProgress(state.progression);
  const orbLabel = state.experienceOrbs.length ? `${state.experienceOrbs.length} 顆留在場上的光點` : '目前沒有留在場上的光點';
  progressionReadout.innerHTML = `<strong>Player Lv.${progress.level}</strong><span>EXP ${Math.floor(progress.current)} / ${progress.required || 'MAX'}</span><small>${orbLabel}；靠近玩家才會拾取。</small>`;
  weaponSlots.replaceChildren();
  state.build.weapons.forEach((weapon, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `weapon-slot${index === state.build.activeWeaponSlot ? ' active' : ''}`;
    button.dataset.weaponSlot = String(index);
    button.textContent = `${index + 1}. ${WEAPONS[weapon.id].name} Lv.${weapon.level}`;
    button.title = '點擊切換目前使用的武器';
    weaponSlots.append(button);
  });

  upgradeCategoryActions.replaceChildren();
  upgradeChoiceList.replaceChildren();
  if (!state.awaitingUpgrade) {
    const idle = document.createElement('small');
    idle.className = 'upgrade-empty';
    idle.textContent = '擊敗敵人取得光點；升級時會在這裡暫停並提供選擇。';
    upgradeChoiceList.append(idle);
    return;
  }
  state.upgradeCategories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.upgradeCategory = category;
    button.className = `upgrade-category${category === state.upgradeCategory ? ' active' : ''}`;
    button.textContent = category === 'weapon' ? '武器' : '被動能力';
    upgradeCategoryActions.append(button);
  });
  if (!state.upgradeCategory) {
    const prompt = document.createElement('small');
    prompt.className = 'upgrade-empty';
    prompt.textContent = '已升級：先選擇武器或被動能力。';
    upgradeChoiceList.append(prompt);
    return;
  }
  state.upgradeChoices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-choice';
    button.dataset.upgradeChoice = 'true';
    button.dataset.upgradeCategory = choice.category;
    button.dataset.upgradeAction = choice.action;
    button.dataset.upgradeId = choice.id;
    button.dataset.upgradeLevel = String(choice.level);
    button.innerHTML = `<strong>${choice.label}</strong><small>${choice.detail}</small>`;
    upgradeChoiceList.append(button);
  });
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * SANDBOX_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * SANDBOX_HEIGHT,
  };
}

function selectOrPlace(event) {
  const point = canvasPoint(event);
  if (isSandboxPlayerHit(state, point)) {
    const result = beginSandboxAim(state, point);
    if (!result.ok) {
      status.textContent = result.reason === 'upgrade' ? '請先完成升級選擇，再操控潛水員。' : '目前無法操控潛水員。';
      render();
      return;
    }
    canvas.setPointerCapture?.(event.pointerId);
    status.textContent = '蓄力中：拖曳方向與距離，放開滑鼠即可彈射。';
    render();
    return;
  }
  const hit = state.enemies
    .filter((enemy) => !enemy.defeated)
    .find((enemy) => Math.hypot(point.x - enemy.x, point.y - enemy.y) <= enemy.radius + 18);
  if (hit) {
    state.selectedEnemyInstanceId = hit.instanceId;
    updateSkillPicker();
    status.textContent = `已選取 ${ENEMY_DEFINITIONS[hit.enemyId].name}。`;
    render();
    return;
  }
  if (!placementMode) {
    status.textContent = '目前是潛水員操控模式；請點擊潛水員周圍高亮區。要放置敵人，先開啟放置敵人模式。';
    render();
    return;
  }
  spawnSandboxEnemy(state, enemySelect.value, point);
  updateSkillPicker();
  status.textContent = '已放置敵人；可點擊敵人或選擇技能驗收。';
  render();
}

function moveAim(event) {
  if (!state.aiming) return;
  updateSandboxAim(state, canvasPoint(event));
  render();
}

function releaseAim(event) {
  if (!state.aiming) return;
  const result = releaseSandboxAim(state, canvasPoint(event));
  canvas.releasePointerCapture?.(event.pointerId);
  status.textContent = result.launched
    ? `彈射成功：初速 ${Math.round(result.speed)}；正式遊玩 L1 重力與阻尼已接管。`
    : `彈射失敗：${result.reason === 'tooClose' ? '請拉出更長距離。' : result.reason === 'attached' ? '玩家目前附著中。' : '能量不足。'}`;
  render();
}

function renderBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, SANDBOX_HEIGHT);
  gradient.addColorStop(0, '#102e4a');
  gradient.addColorStop(1, '#06121f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SANDBOX_WIDTH, SANDBOX_HEIGHT);
  ctx.strokeStyle = 'rgba(122, 201, 231, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < SANDBOX_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SANDBOX_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < SANDBOX_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SANDBOX_WIDTH, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(170, 230, 255, 0.08)';
  for (let index = 0; index < 24; index += 1) {
    const x = (index * 113 + state.time * 8) % (SANDBOX_WIDTH + 30) - 15;
    const y = (index * 71) % SANDBOX_HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (index % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderExperienceOrbs() {
  state.experienceOrbs.forEach((orb) => {
    const pulse = 0.82 + Math.sin(state.time * 4 + orb.id.length) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.34 + pulse * 0.32;
    ctx.fillStyle = '#9eeeff';
    ctx.shadowColor = '#7de9ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, (orb.radius ?? 7) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#e9ffff';
    ctx.beginPath();
    ctx.moveTo(orb.x, orb.y - 4);
    ctx.lineTo(orb.x + 4, orb.y);
    ctx.lineTo(orb.x, orb.y + 4);
    ctx.lineTo(orb.x - 4, orb.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function renderEffects() {
  state.zones.forEach((zone) => {
    ctx.save();
    ctx.strokeStyle = zone.triggered ? 'rgba(255, 135, 112, .85)' : 'rgba(246, 230, 109, .8)';
    ctx.fillStyle = zone.triggered ? 'rgba(255, 108, 96, .14)' : 'rgba(246, 230, 109, .08)';
    ctx.setLineDash(zone.triggered ? [] : [7, 5]);
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  state.projectiles.forEach((projectile) => {
    ctx.save();
    ctx.fillStyle = projectile.colour;
    ctx.shadowColor = projectile.colour;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  state.effects.forEach((effect) => {
    const progress = effect.elapsed / effect.duration;
    if (effect.type === 'playerSlash' && effect.style === 'knifeMeteor') {
      renderKnifeMeteorEffect(effect, progress, false);
      return;
    }
    if (effect.type === 'knifeTrail' && effect.style === 'knifeMeteorSide') {
      renderKnifeMeteorEffect(effect, progress, true);
      return;
    }
    if (effect.type === 'knifeArea' && effect.style === 'knifeArea') {
      renderKnifeAreaEffect(effect, progress);
      return;
    }
    const radius = effect.radius * (effect.type === 'hit' ? 1 + progress : .78 + progress * .22);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = effect.colour;
    ctx.lineWidth = effect.type === 'beam' ? 7 : 2.5;
    if (effect.type === 'beam') {
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.targetX, effect.targetY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function pointAlongEffect(effect, ratio) {
  const startX = effect.startX ?? effect.x;
  const startY = effect.startY ?? effect.y;
  return {
    x: startX + ((effect.targetX ?? startX) - startX) * ratio,
    y: startY + ((effect.targetY ?? startY) - startY) * ratio,
  };
}

function renderMeteorStroke(effect, headRatio, alpha, lineWidth) {
  const tailRatio = Math.max(0, headRatio - (effect.trailLength ?? 0.82));
  const segments = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let index = 0; index < segments; index += 1) {
    const fromRatio = tailRatio + (headRatio - tailRatio) * (index / segments);
    const toRatio = tailRatio + (headRatio - tailRatio) * ((index + 1) / segments);
    const from = pointAlongEffect(effect, fromRatio);
    const to = pointAlongEffect(effect, toRatio);
    ctx.globalAlpha = alpha * ((index + 1) / segments) * 0.95;
    ctx.lineWidth = Math.max(1.2, lineWidth * (0.38 + (index / segments) * 0.62));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}

function renderKnifeMeteorEffect(effect, progress, side) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const sweepDuration = Math.max(0.08, Math.min(0.7, effect.sweepDuration ?? 0.24));
  const headRatio = Math.min(1, safeProgress / sweepDuration);
  const isLinger = !side && (effect.sparkleCount ?? 0) > 0;
  const fade = isLinger ? Math.max(effect.lingerMinAlpha ?? 0.2, 1 - safeProgress * 0.52) : Math.max(0, 1 - safeProgress);
  const lineWidth = effect.lineWidth ?? (side ? 2.5 : 6);
  const head = pointAlongEffect(effect, headRatio);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = effect.colour ?? '#ffffff';
  ctx.shadowColor = '#dffbff';
  ctx.shadowBlur = side ? 10 : 18;
  // Lv.2 side trails and Lv.3's lingering slash keep a faint complete path
  // visible from the first frame. The moving head still provides the
  // Fruit-Ninja-like sweep, but the effect can no longer disappear between
  // two screenshots taken around the start of the animation.
  if ((effect.pathAlpha ?? 0) > 0) {
    ctx.globalAlpha = fade * effect.pathAlpha;
    ctx.lineWidth = Math.max(1.25, lineWidth * (side ? 0.72 : 0.42));
    ctx.beginPath();
    ctx.moveTo(effect.startX ?? effect.x, effect.startY ?? effect.y);
    ctx.lineTo(effect.targetX ?? effect.startX ?? effect.x, effect.targetY ?? effect.startY ?? effect.y);
    ctx.stroke();
  }
  renderMeteorStroke(effect, headRatio, fade * (side ? 0.9 : 0.96), lineWidth * (side ? 0.9 : 1));

  ctx.globalAlpha = fade * (side ? 0.72 : 0.92);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(head.x, head.y, effect.headRadius ?? (side ? 4 : 7), 0, Math.PI * 2);
  ctx.fill();

  if (isLinger) {
    const sparkleCount = Math.max(0, Math.round(effect.sparkleCount));
    for (let index = 0; index < sparkleCount; index += 1) {
      const ratio = (index + 1) / (sparkleCount + 1);
      const point = pointAlongEffect(effect, ratio);
      const phase = (effect.id ?? 1) * 0.71 + index * 1.83;
      const twinkle = 0.35 + (Math.sin(state.time * 12 + phase) + 1) * 0.3;
      const size = 1.2 + twinkle * 2.1;
      ctx.globalAlpha = fade * twinkle;
      ctx.fillStyle = index % 3 === 0 ? '#ffffff' : '#d8faff';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size * 2.2);
      ctx.lineTo(point.x + size * 0.65, point.y);
      ctx.lineTo(point.x, point.y + size * 2.2);
      ctx.lineTo(point.x - size * 0.65, point.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function renderKnifeAreaEffect(effect, progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const pulse = 0.92 + Math.sin(safeProgress * Math.PI) * 0.12;
  const radius = effect.radius * pulse;
  ctx.save();
  ctx.globalAlpha = (1 - safeProgress) * 0.72;
  ctx.strokeStyle = effect.colour;
  ctx.fillStyle = 'rgba(184, 245, 255, .06)';
  ctx.shadowColor = effect.colour;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.4;
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8 + safeProgress * 0.6;
    ctx.beginPath();
    ctx.moveTo(effect.x + Math.cos(angle) * radius * 0.62, effect.y + Math.sin(angle) * radius * 0.62);
    ctx.lineTo(effect.x + Math.cos(angle) * radius * 1.05, effect.y + Math.sin(angle) * radius * 1.05);
    ctx.stroke();
  }
  ctx.restore();
}

function renderPlayerControlZone() {
  ctx.save();
  ctx.globalAlpha = state.aiming ? 0.72 : 0.3;
  ctx.strokeStyle = state.aiming ? '#f6e66d' : '#8cdcff';
  ctx.fillStyle = state.aiming ? 'rgba(246, 230, 109, .08)' : 'rgba(140, 220, 255, .035)';
  ctx.lineWidth = state.aiming ? 2 : 1;
  ctx.setLineDash(state.aiming ? [] : [5, 7]);
  ctx.beginPath();
  ctx.arc(state.actor.x, state.actor.y, SANDBOX_PLAYER_INTERACTION_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function renderAimPreview() {
  if (!state.aiming || !state.aimPoint) return;
  const actor = state.actor;
  const distance = Math.hypot(actor.x - state.aimPoint.x, actor.y - state.aimPoint.y);
  ctx.save();
  ctx.strokeStyle = '#f6e66d';
  ctx.fillStyle = 'rgba(246, 230, 109, .12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(actor.x, actor.y);
  ctx.lineTo(state.aimPoint.x, state.aimPoint.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(state.aimPoint.x, state.aimPoint.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#fff5b5';
  ctx.fillText(`彈射距離 ${Math.round(distance)}`, state.aimPoint.x + 12, state.aimPoint.y - 10);
  ctx.restore();
}

function renderEnemyMarkers() {
  state.enemies.forEach((enemy) => {
    ctx.save();
    ctx.strokeStyle = enemy.instanceId === state.selectedEnemyInstanceId ? '#f6e66d' : 'rgba(202, 232, 255, .65)';
    ctx.lineWidth = enemy.instanceId === state.selectedEnemyInstanceId ? 2.5 : 1;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(3, 12, 22, .75)';
    ctx.fillRect(enemy.x - 28, enemy.y - enemy.radius - 15, 56, 5);
    ctx.fillStyle = enemy.defeated ? '#8495a7' : '#ff7187';
    ctx.fillRect(enemy.x - 28, enemy.y - enemy.radius - 15, 56 * Math.max(0, enemy.health / enemy.maxHealth), 5);
    ctx.restore();
  });
}

function renderSprites() {
  const liveIds = new Set();
  state.enemies.forEach((enemy) => {
    liveIds.add(enemy.instanceId);
    const encyclopedia = encyclopediaById[enemy.enemyId];
    const source = encyclopedia?.visuals?.actions?.[enemy.animation] ?? encyclopedia?.visuals?.idle;
    if (source) {
      let image = sprites.querySelector(`[data-instance-id="${enemy.instanceId}"]`);
      if (!image || image.tagName !== 'IMG') {
        image?.remove();
        image = document.createElement('img');
        image.dataset.instanceId = enemy.instanceId;
        image.alt = '';
        sprites.append(image);
      }
      image.className = `sandbox-sprite${enemy.instanceId === state.selectedEnemyInstanceId ? ' selected' : ''}${enemy.defeated ? ' defeated' : ''}`;
      const sourceWithToken = enemy.animation === 'idle' ? source : `${source}?animation=${enemy.animationToken}`;
      if (image.dataset.source !== sourceWithToken) {
        image.src = sourceWithToken;
        image.dataset.source = sourceWithToken;
      }
      const size = Math.max(58, enemy.radius * 2.8);
      image.width = size;
      image.height = size;
      image.style.left = `${(enemy.x / SANDBOX_WIDTH) * 100}%`;
      image.style.top = `${(enemy.y / SANDBOX_HEIGHT) * 100}%`;
    } else {
      let fallback = sprites.querySelector(`[data-instance-id="${enemy.instanceId}"]`);
      if (!fallback || fallback.tagName !== 'DIV') {
        fallback?.remove();
        fallback = document.createElement('div');
        fallback.dataset.instanceId = enemy.instanceId;
        sprites.append(fallback);
      }
      fallback.className = `sandbox-sprite-fallback${enemy.instanceId === state.selectedEnemyInstanceId ? ' selected' : ''}${enemy.defeated ? ' defeated' : ''}`;
      fallback.textContent = ENEMY_DEFINITIONS[enemy.enemyId].name.slice(0, 4);
      fallback.style.width = `${enemy.radius * 2.1}px`;
      fallback.style.height = `${enemy.radius * 2.1}px`;
      fallback.style.left = `${(enemy.x / SANDBOX_WIDTH) * 100}%`;
      fallback.style.top = `${(enemy.y / SANDBOX_HEIGHT) * 100}%`;
    }
  });
  sprites.querySelectorAll('[data-instance-id]').forEach((element) => {
    if (!liveIds.has(element.dataset.instanceId)) element.remove();
  });
  const animationState = getPlayerAnimationState(state.actor);
  const frameIndex = getPlayerAnimationFrameIndex(animationState, state.time, state.actor);
  const source = PLAYER_ANIMATION_ASSETS[animationState]?.[frameIndex] ?? PLAYER_ANIMATION_ASSETS.swim[0];
  if (playerSprite.dataset.source !== source) {
    playerSprite.src = source;
    playerSprite.dataset.source = source;
  }
  const motion = getPlayerAnimationMotion(animationState, state.time, state.actor);
  const facing = getPlayerFacingDirection(state.actor);
  const size = Math.max(34, state.actor.radius * 6);
  playerSprite.width = size;
  playerSprite.height = size;
  playerSprite.style.left = `${(state.actor.x / SANDBOX_WIDTH) * 100}%`;
  playerSprite.style.top = `${((state.actor.y + motion.bob) / SANDBOX_HEIGHT) * 100}%`;
  playerSprite.style.opacity = String(motion.alpha);
  playerSprite.style.transform = `translate(-50%, -50%) rotate(${motion.rotation}rad) scaleX(${getPlayerSpriteScaleX(facing, motion.scaleX)}) scaleY(${motion.scaleY})`;
  playerSprite.classList.toggle('aiming', state.aiming);
}

function renderTelemetry() {
  const enemy = selectedEnemy();
  const progress = getExperienceProgress(state.progression);
  playerStats.innerHTML = [
    ['等級', `Lv.${progress.level}`],
    ['經驗', `${Math.floor(progress.current)} / ${progress.required || 'MAX'}`],
    ['生命', `${format(state.actor.health)} / 100`],
    ['氧氣', state.infiniteResources ? '∞' : `${format(state.actor.oxygen)} / 100（${format(getOxygenSecondsRemaining(state.actor))}s）`],
    ['能量', state.infiniteResources ? '∞' : format(state.actor.energy)],
    ['L1 動量', `${format(state.actor.vx)}, ${format(state.actor.vy)}`],
    ['武器', state.build.weapons.map((weapon, index) => `${index + 1}.${WEAPONS[weapon.id].name} Lv.${weapon.level}`).join('、')],
    ['被動', state.build.passives.length ? state.build.passives.map((passive) => `${PASSIVE_ABILITIES[passive.id].name} Lv.${passive.level}`).join('、') : '無'],
    ['敵人數', `${state.enemies.length}（存活 ${state.enemies.filter((candidate) => !candidate.defeated).length}）`],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  sandboxLog.innerHTML = state.logs.map((event) => `<li data-level="${event.level}"><time>${event.time.toFixed(1)}s</time> ${event.message}</li>`).join('');
  updateSkillPicker();
  renderPlacedEnemyList();
  renderProgression();
}

function render() {
  renderBackground();
  renderExperienceOrbs();
  renderPlayerControlZone();
  renderAimPreview();
  renderEnemyMarkers();
  renderSprites();
  renderEffects();
  renderTelemetry();
}

function tick(now) {
  const elapsed = Math.min((now - lastFrame) / 1000, .1);
  lastFrame = now;
  if (state.running) stepSandbox(state, elapsed);
  render();
  requestAnimationFrame(tick);
}

document.querySelector('#place-enemy').addEventListener('click', () => {
  placementMode = !placementMode;
  document.querySelector('#place-enemy').textContent = placementMode ? '放置敵人模式（開啟）' : '放置敵人模式（關閉）';
  status.textContent = placementMode ? '放置模式已開啟；點擊潛水員周圍仍優先操控潛水員。' : '放置模式已關閉；目前點擊場地不會召喚敵人。';
});
document.querySelector('#clear-enemies').addEventListener('click', () => { clearSandboxEnemies(state); updateSkillPicker(); render(); });
document.querySelector('#apply-build').addEventListener('click', () => { applyBuild(); render(); });
document.querySelector('#player-attack').addEventListener('click', () => {
  const result = playerAttack(state);
  status.textContent = result.ok
    ? `小刀 Lv.${state.build.weaponLevel} 白色流星刀痕已劃出${result.hit ? '並命中目標。' : '。'}`
    : result.reason === 'cooldown' ? '小刀刀痕仍在冷卻中。' : '目前沒有可展示的小刀刀痕。';
  render();
});
document.querySelector('#test-skill').addEventListener('click', () => { executeEnemySkill(state); render(); });
document.querySelector('#reset-player').addEventListener('click', () => { resetSandboxPlayer(state); render(); });
document.querySelector('#pause-toggle').addEventListener('click', (event) => {
  state.running = !state.running;
  event.currentTarget.textContent = state.running ? '暫停' : '繼續';
  status.textContent = state.running ? '沙盒繼續運行。' : '沙盒已暫停；可逐一閱讀場上狀態。';
});
document.querySelector('#invincible-toggle').addEventListener('change', (event) => { state.invincible = event.target.checked; });
document.querySelector('#infinite-toggle').addEventListener('change', (event) => { state.infiniteResources = event.target.checked; });
document.querySelector('#auto-toggle').addEventListener('change', (event) => { state.autoCycle = event.target.checked; status.textContent = event.target.checked ? '敵人會自動循環可用技能。' : '敵人自動技能已關閉。'; });
weaponSlots.addEventListener('click', (event) => {
  const button = event.target.closest('[data-weapon-slot]');
  if (!button) return;
  setSandboxActiveWeapon(state, Number(button.dataset.weaponSlot));
  status.textContent = `目前使用 ${WEAPONS[state.build.weaponId].name} Lv.${state.build.weaponLevel}。`;
  render();
});
upgradeCategoryActions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade-category]');
  if (!button) return;
  const result = chooseUpgradeCategory(state, button.dataset.upgradeCategory);
  status.textContent = result.ok ? '請從兩個合法升級選項中選一個。' : '這個升級類別目前沒有合法選項。';
  render();
});
upgradeChoiceList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade-choice]');
  if (!button) return;
  const result = chooseUpgrade(state, {
    category: button.dataset.upgradeCategory,
    action: button.dataset.upgradeAction,
    id: button.dataset.upgradeId,
    level: Number(button.dataset.upgradeLevel),
  });
  status.textContent = result.ok ? '升級已套用；可繼續拾取經驗光點。' : '這個升級選項已失效，請重新選擇。';
  render();
});
enemySelect.addEventListener('change', () => { status.textContent = `下一個放置：${ENEMY_DEFINITIONS[enemySelect.value].name}。`; });
weaponSelect.addEventListener('change', () => {
  const maxLevel = WEAPONS[weaponSelect.value].maxLevel;
  weaponLevel.value = String(Math.min(Number(weaponLevel.value), maxLevel));
  [...weaponLevel.options].forEach((option) => { option.hidden = Number(option.value) > maxLevel; });
});
skillSelect.addEventListener('change', () => {
  state.selectedSkillId = skillSelect.value;
  const enemy = selectedEnemy();
  skillDescription.textContent = encyclopediaById[enemy?.enemyId]?.attacks.find((skill) => skill.id === state.selectedSkillId)?.description ?? '';
});
placedEnemyList.addEventListener('click', (event) => {
  const selectButton = event.target.closest('[data-select-enemy]');
  if (selectButton) {
    state.selectedEnemyInstanceId = selectButton.dataset.selectEnemy;
    updateSkillPicker();
    status.textContent = `已選取 ${ENEMY_DEFINITIONS[selectedEnemy()?.enemyId]?.name ?? '敵人'}。`;
    render();
    return;
  }
  const skillButton = event.target.closest('[data-sandbox-skill]');
  if (!skillButton) return;
  state.selectedEnemyInstanceId = skillButton.dataset.instanceId;
  state.selectedSkillId = skillButton.dataset.sandboxSkill;
  const result = executeEnemySkill(state, state.selectedEnemyInstanceId, state.selectedSkillId);
  status.textContent = result.ok ? `已施放 ${skillButton.textContent}。` : '技能目前仍在冷卻中。';
  render();
});
canvas.addEventListener('pointerdown', selectOrPlace);
canvas.addEventListener('pointermove', moveAim);
canvas.addEventListener('pointerup', releaseAim);
canvas.addEventListener('pointercancel', releaseAim);
window.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    const result = playerAttack(state);
    status.textContent = result.ok ? `小刀 Lv.${state.build.weaponLevel} 白色流星刀痕已劃出。` : '小刀刀痕目前仍在冷卻中。';
    render();
  }
  if (event.key.toLowerCase() === 'e') { executeEnemySkill(state); render(); }
  if (event.key.toLowerCase() === 'p') { state.running = !state.running; render(); }
});

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'sandbox canvas origin top-left; x right, y down',
  mode: 'sandbox',
  player: { x: format(state.actor.x), y: format(state.actor.y), health: format(state.actor.health), oxygen: state.infiniteResources ? 'infinite' : format(state.actor.oxygen), oxygenSeconds: state.infiniteResources ? 'infinite' : format(getOxygenSecondsRemaining(state.actor)), energy: state.infiniteResources ? 'infinite' : format(state.actor.energy), facing: getPlayerFacingDirection(state.actor), animation: getPlayerAnimationState(state.actor), stunned: Math.max(0, (state.actor.stunnedUntil ?? 0) - state.time), inInk: Boolean(state.actor.inInk), activeEffects: { ...(state.actor.activeEffects ?? {}) } },
  motion: { vx: format(state.actor.vx), vy: format(state.actor.vy), gravity: 'L1', aiming: state.aiming, launchMomentumTimer: format(state.actor.launchMomentumTimer) },
  build: state.build,
  progression: {
    ...getExperienceProgress(state.progression),
    pendingLevelUps: state.progression.pendingLevelUps,
    awaitingUpgrade: state.awaitingUpgrade,
    category: state.upgradeCategory,
    categories: state.upgradeCategories,
    choices: state.upgradeChoices,
    weapons: state.progression.weapons,
    passives: state.progression.passives,
    activeWeaponSlot: state.progression.activeWeaponSlot,
  },
  experienceOrbs: state.experienceOrbs.map((orb) => ({ id: orb.id, x: format(orb.x), y: format(orb.y), value: orb.value, source: orb.source })),
  flags: { invincible: state.invincible, infiniteResources: state.infiniteResources, autoCycle: state.autoCycle, enemyPlacementMode: placementMode, running: state.running },
  enemies: state.enemies.map((enemy) => ({ id: enemy.instanceId, enemy: enemy.enemyId, x: format(enemy.x), y: format(enemy.y), vx: format(enemy.vx), vy: format(enemy.vy), health: format(enemy.health), defeated: enemy.defeated, state: enemy.state, facing: enemy.facing, enraged: enemy.enraged, pendingSkill: enemy.pendingSkill ? { id: enemy.pendingSkill.skillId, remaining: format(enemy.pendingSkill.remaining) } : null, linkedTarget: enemy.linkedTarget, linkedProtection: enemy.linkedProtection, animation: enemy.animation })),
  projectiles: state.projectiles.length,
  effects: state.effects.map((effect) => ({
    type: effect.type,
    style: effect.style,
    sparkleCount: effect.sparkleCount,
    elapsed: format(effect.elapsed),
    duration: format(effect.duration),
  })),
});

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (SANDBOX_FIXED_STEP * 1000)));
  for (let index = 0; index < steps; index += 1) stepSandbox(state, SANDBOX_FIXED_STEP);
  render();
  return window.render_game_to_text();
};

populateControls();
render();
requestAnimationFrame(tick);
