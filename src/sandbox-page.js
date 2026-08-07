import { ENEMY_DEFINITIONS, PASSIVE_ABILITIES, WEAPONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import {
  SANDBOX_HEIGHT,
  SANDBOX_WIDTH,
  clearSandboxEnemies,
  createSandboxState,
  executeEnemySkill,
  getSandboxEnemyIds,
  listSandboxSkills,
  playerAttack,
  resetSandboxPlayer,
  setSandboxBuild,
  spawnSandboxEnemy,
  stepSandbox,
} from './sandbox-sim.js';

const canvas = document.querySelector('#sandbox-canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#sandbox-stage');
const sprites = document.querySelector('#sandbox-sprites');
const playerMarker = document.querySelector('#player-marker');
const enemySelect = document.querySelector('#enemy-select');
const weaponSelect = document.querySelector('#weapon-select');
const weaponLevel = document.querySelector('#weapon-level');
const passiveList = document.querySelector('#passive-list');
const skillSelect = document.querySelector('#skill-select');
const skillDescription = document.querySelector('#skill-description');
const selectedEnemyName = document.querySelector('#selected-enemy-name');
const selectedEnemyStats = document.querySelector('#selected-enemy-stats');
const playerStats = document.querySelector('#player-stats');
const sandboxLog = document.querySelector('#sandbox-log');
const status = document.querySelector('#sandbox-status');
const state = createSandboxState();
let placementMode = true;
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
  skillSelect.replaceChildren();
  if (!enemy) {
    skillSelect.disabled = true;
    skillDescription.textContent = '';
    selectedEnemyName.textContent = '尚未選取敵人';
    selectedEnemyStats.textContent = '點擊場上的敵人後，在這裡選擇要驗收的技能。';
    return;
  }
  const definition = ENEMY_DEFINITIONS[enemy.enemyId];
  const encyclopedia = encyclopediaById[enemy.enemyId];
  selectedEnemyName.textContent = `${definition.name}${enemy.defeated ? '（已擊敗）' : ''}`;
  selectedEnemyStats.textContent = `生命 ${Math.round(enemy.health)} / ${enemy.maxHealth}｜角色 ${definition.role}｜移速 ${definition.moveSpeed}`;
  const skills = listSandboxSkills(enemy.enemyId);
  skills.forEach((skill) => {
    const option = document.createElement('option');
    option.value = skill.id;
    option.textContent = `${skill.name} · ${skill.type}`;
    skillSelect.append(option);
  });
  skillSelect.disabled = skills.length === 0 || enemy.defeated;
  state.selectedSkillId = skills.some((skill) => skill.id === state.selectedSkillId)
    ? state.selectedSkillId
    : (skills[0]?.id ?? null);
  skillSelect.value = state.selectedSkillId ?? '';
  skillDescription.textContent = encyclopedia?.attacks.find((skill) => skill.id === state.selectedSkillId)?.description ?? '';
}

function applyBuild() {
  const passives = [...passiveList.querySelectorAll('select[data-passive-id]')]
    .map((select) => ({ id: select.dataset.passiveId, level: Number(select.value) }))
    .filter((ability) => ability.level > 0);
  setSandboxBuild(state, { weaponId: weaponSelect.value, weaponLevel: Number(weaponLevel.value), passives });
  status.textContent = `已套用 ${WEAPONS[state.build.weaponId].name} Lv.${state.build.weaponLevel} 與 ${passives.length} 個被動技能。`;
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
  if (!placementMode) return;
  spawnSandboxEnemy(state, enemySelect.value, point);
  updateSkillPicker();
  status.textContent = '已放置敵人；可點擊敵人或選擇技能驗收。';
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
  playerMarker.style.left = `${(state.actor.x / SANDBOX_WIDTH) * 100}%`;
  playerMarker.style.top = `${(state.actor.y / SANDBOX_HEIGHT) * 100}%`;
}

function renderTelemetry() {
  const enemy = selectedEnemy();
  playerStats.innerHTML = [
    ['生命', `${format(state.actor.health)} / 100`],
    ['氧氣', state.infiniteResources ? '∞' : format(state.actor.oxygen)],
    ['能量', state.infiniteResources ? '∞' : format(state.actor.energy)],
    ['武器', `${WEAPONS[state.build.weaponId].name} Lv.${state.build.weaponLevel}`],
    ['被動', state.build.passives.length ? state.build.passives.map((passive) => `${PASSIVE_ABILITIES[passive.id].name} Lv.${passive.level}`).join('、') : '無'],
    ['敵人數', `${state.enemies.length}（存活 ${state.enemies.filter((candidate) => !candidate.defeated).length}）`],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  sandboxLog.innerHTML = state.logs.map((event) => `<li data-level="${event.level}"><time>${event.time.toFixed(1)}s</time> ${event.message}</li>`).join('');
  if (enemy) updateSkillPicker();
}

function render() {
  renderBackground();
  renderEffects();
  renderEnemyMarkers();
  renderSprites();
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
  document.querySelector('#place-enemy').textContent = placementMode ? '點擊場地放置（啟用）' : '點擊場地放置（關閉）';
  status.textContent = placementMode ? '放置模式已啟用，點擊場地即可新增敵人。' : '放置模式已關閉，點擊場上敵人可選取。';
});
document.querySelector('#clear-enemies').addEventListener('click', () => { clearSandboxEnemies(state); updateSkillPicker(); render(); });
document.querySelector('#apply-build').addEventListener('click', () => { applyBuild(); render(); });
document.querySelector('#player-attack').addEventListener('click', () => { playerAttack(state); render(); });
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
canvas.addEventListener('pointerdown', selectOrPlace);
window.addEventListener('keydown', (event) => {
  if (event.key === ' ') { event.preventDefault(); playerAttack(state); render(); }
  if (event.key.toLowerCase() === 'e') { executeEnemySkill(state); render(); }
  if (event.key.toLowerCase() === 'p') { state.running = !state.running; render(); }
});

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'sandbox canvas origin top-left; x right, y down',
  mode: 'sandbox',
  player: { x: format(state.actor.x), y: format(state.actor.y), health: format(state.actor.health), oxygen: state.infiniteResources ? 'infinite' : format(state.actor.oxygen), energy: state.infiniteResources ? 'infinite' : format(state.actor.energy) },
  build: state.build,
  flags: { invincible: state.invincible, infiniteResources: state.infiniteResources, autoCycle: state.autoCycle, running: state.running },
  enemies: state.enemies.map((enemy) => ({ id: enemy.instanceId, enemy: enemy.enemyId, x: format(enemy.x), y: format(enemy.y), health: format(enemy.health), defeated: enemy.defeated, animation: enemy.animation })),
  projectiles: state.projectiles.length,
  effects: state.effects.length,
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
