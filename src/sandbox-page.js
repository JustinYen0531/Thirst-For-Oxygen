import { ENEMY_DEFINITIONS, PASSIVE_ABILITIES, WEAPONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { MAX_HEALTH, getOxygenSecondsRemaining } from './physics.js';
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
import { BUILD_SLOT_LEVEL_CAPS, getExperienceProgress } from './progression.js';
import { KATANA_SPRITE, getKatanaSwingFrames, getKatanaWavePose } from './katana-visual.js';
import { getHealthHud } from './visor-hud.js';

const canvas = document.querySelector('#sandbox-canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#sandbox-stage');
const sprites = document.querySelector('#sandbox-sprites');
const playerSprite = document.querySelector('#player-sprite');
const tridentSprite = new Image();
tridentSprite.src = '/assets/editor/weapons/trident.png';
const katanaSprite = new Image();
katanaSprite.src = KATANA_SPRITE;
const enemySelect = document.querySelector('#enemy-select');
const weaponBuildList = document.querySelector('#weapon-build-list');
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
const status = document.querySelector('#sandbox-status');
const resourceBars = {
  health: document.querySelector('#sandbox-health'),
  oxygen: document.querySelector('#sandbox-oxygen'),
  energy: document.querySelector('#sandbox-energy'),
};
const resourceValues = {
  health: document.querySelector('#sandbox-health-value'),
  oxygen: document.querySelector('#sandbox-oxygen-value'),
  energy: document.querySelector('#sandbox-energy-value'),
};
const oxygenFill = resourceBars.oxygen.querySelector('[data-oxygen-fill]');
const energySegments = [...resourceBars.energy.querySelectorAll('[data-energy-segment]')];
const healthSegments = [...resourceBars.health.querySelectorAll('[data-health-segment]')];
const healthPointer = resourceBars.health.querySelector('.health-pointer');
const state = createSandboxState();
let placementMode = false;
let lastFrame = performance.now();

const encyclopediaById = Object.fromEntries(ENEMY_ENCYCLOPEDIA.map((enemy) => [enemy.id, enemy]));
const format = (value) => Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
const BUILD_SLOT_LABELS = Object.freeze(['主槽', '副槽', '副副槽']);

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function renderBuildControls() {
  weaponBuildList.replaceChildren();
  for (let slot = 0; slot < BUILD_SLOT_LEVEL_CAPS.length; slot += 1) {
    const entry = state.build.weapons[slot] ?? null;
    const row = document.createElement('div');
    row.className = 'build-slot-row';
    const label = document.createElement('label');
    label.textContent = `武器 ${BUILD_SLOT_LABELS[slot]}（Lv.${BUILD_SLOT_LEVEL_CAPS[slot]} 上限）`;
    const selectors = document.createElement('div');
    selectors.className = 'build-slot-selectors';
    const select = document.createElement('select');
    select.dataset.buildWeaponSlot = String(slot);
    select.setAttribute('aria-label', `武器${BUILD_SLOT_LABELS[slot]}`);
    if (slot > 0) select.append(createOption('', '未裝備'));
    Object.values(WEAPONS)
      .filter((weapon) => slot === 0 ? weapon.id === 'knife' : weapon.id !== 'knife')
      .forEach((weapon) => select.append(createOption(weapon.id, weapon.name)));
    select.value = entry?.id ?? (slot === 0 ? 'knife' : '');
    const level = document.createElement('select');
    level.dataset.buildWeaponLevel = String(slot);
    level.setAttribute('aria-label', `武器${BUILD_SLOT_LABELS[slot]}等級`);
    for (let value = 1; value <= BUILD_SLOT_LEVEL_CAPS[slot]; value += 1) level.append(createOption(String(value), `Lv.${value}`));
    level.value = String(Math.min(entry?.level ?? 1, BUILD_SLOT_LEVEL_CAPS[slot]));
    level.disabled = slot > 0 && !select.value;
    selectors.append(select, level);
    row.append(label, selectors);
    weaponBuildList.append(row);
  }

  passiveList.replaceChildren();
  for (let slot = 0; slot < BUILD_SLOT_LEVEL_CAPS.length; slot += 1) {
    const entry = state.build.passives[slot] ?? null;
    const row = document.createElement('div');
    row.className = 'build-slot-row';
    const label = document.createElement('label');
    label.textContent = `被動 ${BUILD_SLOT_LABELS[slot]}（Lv.${BUILD_SLOT_LEVEL_CAPS[slot]} 上限）`;
    const selectors = document.createElement('div');
    selectors.className = 'build-slot-selectors';
    const select = document.createElement('select');
    select.dataset.buildPassiveSlot = String(slot);
    select.setAttribute('aria-label', `被動${BUILD_SLOT_LABELS[slot]}`);
    select.append(createOption('', '未裝備'));
    Object.values(PASSIVE_ABILITIES).forEach((ability) => select.append(createOption(ability.id, ability.name)));
    select.value = entry?.id ?? '';
    const level = document.createElement('select');
    level.dataset.buildPassiveLevel = String(slot);
    level.setAttribute('aria-label', `被動${BUILD_SLOT_LABELS[slot]}等級`);
    for (let value = 1; value <= BUILD_SLOT_LEVEL_CAPS[slot]; value += 1) level.append(createOption(String(value), `Lv.${value}`));
    level.value = String(Math.min(entry?.level ?? 1, BUILD_SLOT_LEVEL_CAPS[slot]));
    level.disabled = !select.value;
    selectors.append(select, level);
    row.append(label, selectors);
    passiveList.append(row);
  }
}

function populateControls() {
  getSandboxEnemyIds().forEach((enemyId) => {
    const option = document.createElement('option');
    option.value = enemyId;
    option.textContent = `${ENEMY_DEFINITIONS[enemyId].name} · ${ENEMY_DEFINITIONS[enemyId].role}`;
    enemySelect.append(option);
  });
  renderBuildControls();
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
  const cast = enemy.pendingSkill ? `｜讀條 ${enemy.pendingSkill.skillId} ${Math.max(0, enemy.pendingSkill.remaining).toFixed(1)}s` : '';
  const beacon = enemy.beacon ? `｜信標 ${Math.max(0, enemy.beacon.remaining).toFixed(1)}s` : '';
  selectedEnemyStats.textContent = `生命 ${Math.round(enemy.health)} / ${enemy.maxHealth}｜角色 ${definition.role}｜移速 ${definition.moveSpeed}｜狀態 ${enemy.state}${cast}${beacon}`;
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

function setupSandboxDefaultBuild() {
  setSandboxBuild(state, {
    weapons: [
      { id: 'knife', level: 3 },
      { id: 'trident', level: 2 },
      { id: 'katana', level: 1 },
    ],
    activeWeaponSlot: 0,
    passives: [
      { id: 'oxygenCirculator', level: 3 },
      { id: 'pressureStabilizer', level: 2 },
      { id: 'abyssalAmplifier', level: 1 },
    ],
  });
  status.textContent = '沙盒已準備：已載入完整武器／被動 Lv.3、Lv.2、Lv.1 Build。';
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
  const weapons = [...weaponBuildList.querySelectorAll('select[data-build-weapon-slot]')]
    .map((select) => ({
      id: select.value,
      level: Number(weaponBuildList.querySelector(`[data-build-weapon-level="${select.dataset.buildWeaponSlot}"]`)?.value ?? 1),
    }))
    .filter((weapon) => weapon.id);
  const passives = [...passiveList.querySelectorAll('select[data-build-passive-slot]')]
    .map((select) => ({
      id: select.value,
      level: Number(passiveList.querySelector(`[data-build-passive-level="${select.dataset.buildPassiveSlot}"]`)?.value ?? 1),
    }))
    .filter((ability) => ability.id);
  setSandboxBuild(state, { weapons, activeWeaponSlot: state.build.activeWeaponSlot, passives });
  renderBuildControls();
  status.textContent = `已套用武器 ${state.build.weapons.map((weapon) => `${WEAPONS[weapon.id].name} Lv.${weapon.level}`).join('、')}；被動 ${state.build.passives.length ? state.build.passives.map((passive) => `${PASSIVE_ABILITIES[passive.id].name} Lv.${passive.level}`).join('、') : '無'}。`;
}

function playerAttackStatus(result) {
  const weapon = WEAPONS[state.build.weaponId];
  if (!result.ok) {
    if (result.reason === 'burst') return `輕量機槍連射中，還有 ${Math.ceil(result.remaining / 0.08)} 秒內完成本輪。`;
    if (result.reason === 'cooldown') return `${weapon.name} 仍在冷卻中。`;
    return `目前沒有可展示的${weapon.name}效果。`;
  }
  if (state.build.weaponId === 'katana') {
    const slash = [...state.effects].reverse().find((effect) => effect.type === 'katanaSwing');
    const wave = state.effects.some((effect) => effect.type === 'katanaWave');
    const power = slash?.empowered ? '強化順時針揮刀（雙倍傷害）' : '順時針揮刀';
    return `武士刀 Lv.${state.build.weaponLevel} ${power}${wave ? '＋白色飛行衝擊波' : ''}${result.hit ? '，命中目標。' : '。'} `;
  }
  if (state.build.weaponId === 'knife') return `小刀 Lv.${state.build.weaponLevel} 白色流星刀痕已劃出${result.hit ? '並命中目標。' : '。'}`;
  if (state.build.weaponId === 'trident') {
    const projectileCount = state.projectiles.filter((projectile) => projectile.weaponId === 'trident').length;
    const levelLabel = state.build.weaponLevel >= 3 ? '閃耀三叉戟爆發' : state.build.weaponLevel === 2 ? '暈眩三叉戟' : '深海三叉戟';
    return `三叉戟 Lv.${state.build.weaponLevel} ${levelLabel}已發射${projectileCount ? `（場上 ${projectileCount} 發）` : ''}${result.hit ? '並命中目標。' : '。'}`;
  }
  if (state.build.weaponId === 'lightMachineGun') {
    const gunEffect = [...state.effects].reverse().find((effect) => effect.type === 'lightMachineGun');
    const fired = gunEffect?.firedShots ?? 0;
    return `輕量機槍 Lv.${state.build.weaponLevel} 已固定方向連射（${fired}/6 發${state.weaponBurst ? '，連射中' : ''}）。`;
  }
  return `${weapon.name} Lv.${state.build.weaponLevel} 已發動${result.hit ? '並命中目標。' : '。'}`;
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
    button.setAttribute('aria-pressed', String(index === state.build.activeWeaponSlot));
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    button.title = `點擊切換目前使用的武器（快捷鍵 ${index + 1}）`;
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

function renderSandboxHud() {
  resourceValues.oxygen.textContent = '∞ 無限';
  resourceBars.oxygen.setAttribute('aria-valuenow', '100');
  resourceBars.oxygen.setAttribute('aria-valuetext', '無限');
  oxygenFill.style.setProperty('--oxygen-fill', '100%');

  resourceValues.energy.textContent = '∞ 無限';
  resourceBars.energy.setAttribute('aria-valuenow', '5');
  resourceBars.energy.setAttribute('aria-valuetext', '無限');
  energySegments.forEach((segment) => {
    segment.querySelector('b').style.setProperty('--segment-fill', '100%');
  });

  const healthHud = getHealthHud(state.actor.health, MAX_HEALTH);
  resourceValues.health.textContent = healthHud.label;
  resourceBars.health.setAttribute('aria-valuenow', String(Math.round(healthHud.value)));
  resourceBars.health.classList.remove('is-full', 'is-warning', 'is-critical');
  resourceBars.health.classList.add(`is-${healthHud.tone}`);
  resourceBars.health.style.setProperty('--health-color', healthHud.color);
  resourceBars.health.style.setProperty('--health-glow', healthHud.glow);
  healthSegments.forEach((segment, index) => {
    segment.querySelector('b').style.setProperty('--segment-fill', `${healthHud.fills[index] * 100}%`);
  });
  healthPointer.style.setProperty('--health-angle', `${180 + healthHud.ratio * 360}deg`);
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
    ? `彈射成功：初速 ${Math.round(result.speed)}；沙盒零重力已接管，方向不會被重力改彎。`
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

function renderLightMachineGunProjectile(projectile) {
  const visual = projectile.visual ?? {};
  const angle = projectile.angle ?? Math.atan2(projectile.vy, projectile.vx);
  const length = visual.bulletLength ?? 18;
  const width = visual.bulletWidth ?? 5;
  const colour = visual.bulletColour ?? projectile.colour ?? '#8fe8ff';
  const outline = visual.bulletOutline ?? '#d9fbff';
  const style = visual.bulletStyle ?? 'tracer';
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.shadowColor = visual.bulletGlow ?? colour;
  ctx.shadowBlur = style === 'prism' ? 15 : style === 'outlined' ? 11 : 8;
  ctx.strokeStyle = visual.bulletGlow ?? outline;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = Math.max(1.5, width * 0.58);
  ctx.beginPath();
  ctx.moveTo(-length * 0.9, 0);
  ctx.lineTo(-length * 0.18, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.1, width * 0.22);
  ctx.beginPath();
  if (style === 'prism' || style === 'outlined') {
    ctx.moveTo(length * 0.58, 0);
    ctx.lineTo(length * 0.08, -width * 0.62);
    ctx.lineTo(-length * 0.52, -width * 0.42);
    ctx.lineTo(-length * 0.7, 0);
    ctx.lineTo(-length * 0.52, width * 0.42);
    ctx.lineTo(length * 0.08, width * 0.62);
  } else {
    ctx.roundRect(-length * 0.64, -width * 0.5, length * 1.18, width, width * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (style === 'prism') {
    ctx.globalAlpha = 0.84;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-length * 0.28, -width * 0.42);
    ctx.lineTo(length * 0.08, 0);
    ctx.lineTo(-length * 0.28, width * 0.42);
    ctx.stroke();
  }
  ctx.restore();
}

function renderLightMachineGun(effect, progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const recoil = Math.sin(safeProgress * Math.PI * Math.max(1, effect.shotCount ?? 6)) * 2.2;
  const length = effect.gunLength ?? 66;
  const width = effect.gunWidth ?? 14;
  const angle = effect.angle ?? 0;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0.18, 1 - Math.max(0, safeProgress - 0.72) / 0.28);
  ctx.shadowColor = effect.gunAccent ?? '#73e6ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = effect.gunColour ?? '#263b52';
  ctx.strokeStyle = effect.gunAccent ?? '#73e6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-length * 0.42 + recoil, -width * 0.5, length * 0.58, width, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111c2c';
  ctx.fillRect(-length * 0.05 + recoil, width * 0.22, width * 0.62, width * 0.86);
  ctx.strokeStyle = effect.gunAccent ?? '#73e6ff';
  ctx.beginPath();
  ctx.moveTo(length * 0.12 + recoil, -width * 0.22);
  ctx.lineTo(length * 0.68 + recoil, -width * 0.22);
  ctx.lineTo(length * 0.68 + recoil, width * 0.22);
  ctx.lineTo(length * 0.12 + recoil, width * 0.22);
  ctx.stroke();
  ctx.globalAlpha *= 0.8;
  ctx.strokeStyle = effect.muzzleColour ?? '#d9fbff';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(length * 0.68 + recoil, 0);
  ctx.lineTo(length * 0.92 + recoil, 0);
  ctx.stroke();
  if ((effect.firedShots ?? 0) > 0 && safeProgress < 0.82) {
    const flash = 5 + (effect.firedShots % 2) * 3;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = effect.muzzleColour ?? '#d9fbff';
    ctx.beginPath();
    ctx.moveTo(length * 0.92 + recoil, 0);
    ctx.lineTo(length * 0.92 + recoil + flash, -flash * 0.5);
    ctx.lineTo(length * 0.92 + recoil + flash * 0.65, 0);
    ctx.lineTo(length * 0.92 + recoil + flash, flash * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function renderTridentProjectile(projectile) {
  const visual = projectile.visual ?? {};
  const level = projectile.weaponLevel ?? 1;
  const angle = projectile.angle ?? Math.atan2(projectile.vy, projectile.vx);
  const scale = visual.spriteScale ?? 0.72;
  const width = 64 * scale;
  const height = 42 * scale;
  const trailLength = visual.trailLength ?? 24;
  const trailWidth = visual.trailWidth ?? 2.4;
  const glowColour = visual.glowColour ?? '#d9fbff';
  const colour = visual.colour ?? projectile.colour ?? '#73e6ff';
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.shadowColor = glowColour;
  ctx.shadowBlur = level >= 3 ? 18 : level === 2 ? 13 : 9;
  const trailSegments = level >= 3 ? 8 : level === 2 ? 6 : 4;
  for (let index = 0; index < trailSegments; index += 1) {
    const ratio = index / trailSegments;
    const tail = -width * 0.18 - trailLength * ratio;
    const head = tail - Math.max(8, trailLength / trailSegments);
    ctx.globalAlpha = (1 - ratio) * (level >= 3 ? 0.82 : 0.62);
    ctx.strokeStyle = index % 2 === 0 ? glowColour : colour;
    ctx.lineWidth = Math.max(1, trailWidth * (1 - ratio * 0.55));
    ctx.beginPath();
    ctx.moveTo(tail, 0);
    ctx.lineTo(head, 0);
    ctx.stroke();
  }
  if (tridentSprite.complete && tridentSprite.naturalWidth > 0) {
    ctx.globalAlpha = 0.98;
    ctx.shadowBlur = level >= 3 ? 22 : level === 2 ? 16 : 10;
    ctx.drawImage(tridentSprite, -width * 0.5, -height * 0.5, width, height);
  } else {
    ctx.globalAlpha = 0.98;
    ctx.strokeStyle = '#efffff';
    ctx.lineWidth = Math.max(2, trailWidth * 0.9);
    ctx.beginPath();
    ctx.moveTo(-width * 0.42, 0);
    ctx.lineTo(width * 0.35, 0);
    ctx.moveTo(width * 0.05, 0);
    ctx.lineTo(width * 0.34, -height * 0.34);
    ctx.moveTo(width * 0.12, 0);
    ctx.lineTo(width * 0.42, 0);
    ctx.moveTo(width * 0.05, 0);
    ctx.lineTo(width * 0.34, height * 0.34);
    ctx.stroke();
  }
  if (level >= 3) {
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = '#fff1a6';
    ctx.lineWidth = 1.4;
    for (let index = 0; index < 4; index += 1) {
      const offset = 8 + index * 5;
      ctx.beginPath();
      ctx.moveTo(-offset, -offset * 0.42);
      ctx.lineTo(-offset - 5, -offset * 0.64);
      ctx.moveTo(-offset, offset * 0.42);
      ctx.lineTo(-offset - 5, offset * 0.64);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderTridentImpact(effect, progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const ringCount = Math.max(1, effect.ringCount ?? 1);
  const radius = effect.radius ?? 20;
  const glowColour = effect.glowColour ?? '#d9fbff';
  const colour = effect.colour ?? '#73e6ff';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, 1 - safeProgress) * 0.9;
  ctx.lineCap = 'round';
  ctx.shadowColor = glowColour;
  ctx.shadowBlur = effect.style === 'tridentBurst' ? 22 : 14;
  for (let index = 0; index < ringCount; index += 1) {
    const ringProgress = Math.min(1, safeProgress + index * 0.12);
    const ringRadius = radius * (0.28 + ringProgress * (0.72 + index * 0.14));
    ctx.strokeStyle = index % 2 === 0 ? glowColour : colour;
    ctx.lineWidth = Math.max(1.4, 4 - safeProgress * 2.4 - index * 0.45);
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (effect.stunDuration > 0) {
    ctx.strokeStyle = '#fff5b5';
    ctx.lineWidth = 2;
    const sparkCount = effect.style === 'tridentBurst' ? 8 : 6;
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = (Math.PI * 2 * index) / sparkCount + safeProgress * 0.8;
      const inner = radius * (0.32 + safeProgress * 0.15);
      const outer = radius * (0.7 + safeProgress * 0.5);
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      ctx.stroke();
    }
  }
  ctx.restore();
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
    if (projectile.weaponId === 'trident') {
      renderTridentProjectile(projectile);
      return;
    }
    if (projectile.weaponId === 'lightMachineGun') {
      renderLightMachineGunProjectile(projectile);
      return;
    }
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
    if (effect.type === 'lightMachineGun' && effect.style === 'lightMachineGun') {
      renderLightMachineGun(effect, progress);
      return;
    }
    if (effect.type === 'tridentImpact') {
      renderTridentImpact(effect, progress);
      return;
    }
    if (effect.type === 'katanaSwing' && effect.style === 'katanaClockwiseSwing') {
      renderKatanaSwing(effect, progress);
      return;
    }
    if (effect.type === 'katanaWave' && effect.style === 'katanaProjectileWave') {
      renderKatanaProjectileWave(effect, progress);
      return;
    }
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

function renderKatanaBlade(effect, angle, alpha) {
  const length = effect.weaponLength ?? 72;
  const thickness = effect.weaponThickness ?? 11.2;
  const pivot = effect.gripPivot ?? 14;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = effect.glowColour ?? effect.colour ?? '#9be8ff';
  ctx.shadowBlur = effect.empowered ? 16 : 7;
  ctx.strokeStyle = effect.colour ?? '#73d9ff';
  ctx.lineWidth = Math.max(1.2, thickness * 0.22);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length - pivot, 0);
  ctx.stroke();
  if (katanaSprite.complete && katanaSprite.naturalWidth > 0) {
    ctx.drawImage(katanaSprite, -pivot, -thickness * 0.5, length, thickness);
  } else {
    ctx.strokeStyle = '#d8fbff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-pivot, 0);
    ctx.lineTo(length - pivot, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function renderKatanaSwing(effect, progress) {
  const safeProgress = Math.max(0, Math.min(1, effect.showcaseProgress ?? progress));
  const frames = getKatanaSwingFrames(effect, safeProgress);
  const fade = Math.max(0.14, 1 - Math.max(0, safeProgress - 0.78) / 0.22);
  frames.afterimages.forEach((frame) => renderKatanaBlade(effect, frame.angle, frame.alpha * fade));
  renderKatanaBlade(effect, frames.currentAngle, 0.98 * fade);
}

function renderKatanaProjectileWave(effect, progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const pose = getKatanaWavePose(effect, safeProgress);
  const arcHalf = ((effect.arcDegrees ?? 94) * Math.PI) / 360;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, 1 - safeProgress);
  ctx.lineCap = 'round';
  ctx.strokeStyle = effect.colour ?? '#f4fdff';
  ctx.shadowColor = effect.glowColour ?? '#b8fbff';
  ctx.shadowBlur = 18;
  ctx.lineWidth = effect.thickness ?? effect.lineWidth ?? 8;
  ctx.beginPath();
  ctx.arc(pose.x, pose.y, pose.radius, pose.angle - arcHalf, pose.angle + arcHalf);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#efffff';
  ctx.lineWidth = Math.max(1.5, (effect.lineWidth ?? 4) * 0.42);
  ctx.beginPath();
  ctx.arc(pose.x, pose.y, pose.radius, pose.angle - arcHalf, pose.angle + arcHalf);
  ctx.stroke();
  ctx.restore();
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
  // Six segments are enough for the meteor taper and avoid eight shadowed
  // strokes per trail, which became expensive when the Lv.3 linger was active.
  const segments = 6;
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
  const sparkleCount = !side
    ? Math.min(6, Math.max(0, Math.round(effect.sparkleBudget ?? effect.sparkleCount ?? 0)))
    : 0;
  const isLinger = sparkleCount > 0;
  const fade = isLinger ? Math.max(effect.lingerMinAlpha ?? 0.2, 1 - safeProgress * 0.52) : Math.max(0, 1 - safeProgress);
  const lineWidth = effect.lineWidth ?? (side ? 2.5 : 6);
  const head = pointAlongEffect(effect, headRatio);

  ctx.save();
  // Knife trails use normal alpha compositing. Additive blending made the
  // white core bloom into a large halo on bright displays and cost more GPU.
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = effect.colour ?? '#ffffff';
  ctx.shadowColor = effect.glowColour ?? '#dffbff';
  const glowBlur = Math.min(side ? (effect.sideGlowBlur ?? 3) : (effect.glowBlur ?? 7), side ? 4 : 8);
  ctx.shadowBlur = Math.max(0, glowBlur * 0.35);
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
  // Keep the tapered trail crisp without asking the GPU to blur every segment;
  // only the moving head below receives a small, bounded halo.
  ctx.shadowBlur = 0;
  renderMeteorStroke(effect, headRatio, fade * (side ? 0.9 : 0.96), lineWidth * (side ? 0.9 : 1));

  ctx.shadowBlur = Math.min(glowBlur, side ? 2 : 4);
  ctx.globalAlpha = fade * (side ? 0.58 : 0.74);
  ctx.fillStyle = effect.colour ?? '#ffffff';
  ctx.beginPath();
  ctx.arc(head.x, head.y, effect.headRadius ?? (side ? 4 : 7), 0, Math.PI * 2);
  ctx.fill();

  if (isLinger) {
    for (let index = 0; index < sparkleCount; index += 1) {
      const ratio = (index + 1) / (sparkleCount + 1);
      const point = pointAlongEffect(effect, ratio);
      const phase = (effect.id ?? 1) * 0.71 + index * 1.83;
      const twinkle = 0.35 + (Math.sin(state.time * 12 + phase) + 1) * 0.3;
      const size = 1.2 + twinkle * 2.1;
      ctx.globalAlpha = fade * twinkle * 0.42;
      ctx.fillStyle = index % 3 === 0 ? '#ffffff' : (effect.sparkleColour ?? '#d8faff');
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
  ctx.globalAlpha = (1 - safeProgress) * 0.38;
  ctx.strokeStyle = effect.colour;
  ctx.fillStyle = 'rgba(184, 245, 255, .025)';
  ctx.shadowColor = effect.glowColour ?? effect.colour;
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6 + safeProgress * 0.6;
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
    if (enemy.hidden) return;
    ctx.save();
    ctx.strokeStyle = enemy.enraged ? '#ff7b8d' : enemy.instanceId === state.selectedEnemyInstanceId ? '#f6e66d' : 'rgba(202, 232, 255, .65)';
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
      image.style.opacity = enemy.hidden ? '0.08' : '1';
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
      fallback.style.opacity = enemy.hidden ? '0.08' : '1';
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

function render() {
  renderBackground();
  renderExperienceOrbs();
  renderPlayerControlZone();
  renderAimPreview();
  renderEnemyMarkers();
  renderSprites();
  renderEffects();
  updateSkillPicker();
  renderPlacedEnemyList();
  renderProgression();
  renderSandboxHud();
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
  status.textContent = playerAttackStatus(result);
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
  if (result.ok) renderBuildControls();
  status.textContent = result.ok ? '升級已套用；可繼續拾取經驗光點。' : '這個升級選項已失效，請重新選擇。';
  render();
});
enemySelect.addEventListener('change', () => { status.textContent = `下一個放置：${ENEMY_DEFINITIONS[enemySelect.value].name}。`; });
weaponBuildList.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-build-weapon-slot]');
  if (!select) return;
  const level = weaponBuildList.querySelector(`[data-build-weapon-level="${select.dataset.buildWeaponSlot}"]`);
  if (level) level.disabled = Number(select.dataset.buildWeaponSlot) > 0 && !select.value;
});
passiveList.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-build-passive-slot]');
  if (!select) return;
  const level = passiveList.querySelector(`[data-build-passive-level="${select.dataset.buildPassiveSlot}"]`);
  if (level) level.disabled = !select.value;
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
  const editingControl = event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName);
  if (!editingControl && /^[123]$/.test(event.key)) {
    const slot = Number(event.key) - 1;
    if (state.build.weapons[slot]) {
      event.preventDefault();
      setSandboxActiveWeapon(state, slot);
      status.textContent = `目前使用 ${WEAPONS[state.build.weaponId].name} Lv.${state.build.weaponLevel}。`;
      render();
      return;
    }
  }
  if (event.key === ' ') {
    event.preventDefault();
    const result = playerAttack(state);
    status.textContent = playerAttackStatus(result);
    render();
  }
  if (event.key.toLowerCase() === 'e') { executeEnemySkill(state); render(); }
  if (event.key.toLowerCase() === 'p') { state.running = !state.running; render(); }
});

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'sandbox canvas origin top-left; x right, y down',
  mode: 'sandbox',
  player: { x: format(state.actor.x), y: format(state.actor.y), health: format(state.actor.health), oxygen: state.infiniteResources ? 'infinite' : format(state.actor.oxygen), oxygenSeconds: state.infiniteResources ? 'infinite' : format(getOxygenSecondsRemaining(state.actor)), energy: state.infiniteResources ? 'infinite' : format(state.actor.energy), facing: getPlayerFacingDirection(state.actor), animation: getPlayerAnimationState(state.actor), stunned: Math.max(0, (state.actor.stunnedUntil ?? 0) - state.time), inInk: Boolean(state.actor.inInk), katanaEmpoweredNextSlash: Boolean(state.actor.katanaEmpoweredNextSlash), tridentStationaryTime: format(state.actor.tridentStationaryTime), activeEffects: { ...(state.actor.activeEffects ?? {}) } },
  motion: { vx: format(state.actor.vx), vy: format(state.actor.vy), gravity: 'zero', aiming: state.aiming, launchMomentumTimer: format(state.actor.launchMomentumTimer) },
  weaponBurst: state.weaponBurst ? { id: state.weaponBurst.id, weapon: state.weaponBurst.weaponId, level: state.weaponBurst.weaponLevel, angle: format(state.weaponBurst.angle), nextShot: state.weaponBurst.nextShotIndex, shotCount: state.weaponBurst.shotCount, targetId: state.weaponBurst.targetId, remaining: format(Math.max(0, state.weaponBurst.finishAt - state.time)) } : null,
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
  flags: { invincible: state.invincible, infiniteResources: state.infiniteResources, zeroGravity: true, autoCycle: state.autoCycle, enemyPlacementMode: placementMode, running: state.running },
  enemies: state.enemies.map((enemy) => ({ id: enemy.instanceId, enemy: enemy.enemyId, x: format(enemy.x), y: format(enemy.y), vx: format(enemy.vx), vy: format(enemy.vy), health: format(enemy.health), defeated: enemy.defeated, state: enemy.state, facing: enemy.facing, enraged: enemy.enraged, hidden: enemy.hidden, stunned: Math.max(0, (enemy.stunnedUntil ?? 0) - state.time), rescueCompleted: enemy.rescueCompleted, pendingSkill: enemy.pendingSkill ? { id: enemy.pendingSkill.skillId, remaining: format(enemy.pendingSkill.remaining) } : null, beacon: enemy.beacon ? { x: format(enemy.beacon.targetX), y: format(enemy.beacon.targetY), remaining: format(enemy.beacon.remaining) } : null, linkedTargets: enemy.linkedTargets, linkedTarget: enemy.linkedTarget, linkedProtection: enemy.linkedProtection, animation: enemy.animation })),
  projectiles: state.projectiles.map((projectile) => ({ id: projectile.id, weapon: projectile.weaponId, level: projectile.weaponLevel, shotIndex: projectile.shotIndex, style: projectile.visual?.bulletStyle, colour: projectile.visual?.bulletColour ?? projectile.colour, x: format(projectile.x), y: format(projectile.y), stun: format(projectile.stunDuration), life: format(projectile.life) })),
  effects: state.effects.map((effect) => ({
    type: effect.type,
    style: effect.style,
    colour: effect.colour,
    empowered: effect.empowered,
    hitCount: effect.hitCount,
    destroyedProjectiles: effect.destroyedProjectiles,
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

setupSandboxDefaultBuild();
populateControls();
render();
requestAnimationFrame(tick);
