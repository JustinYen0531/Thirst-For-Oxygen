import {
  cellKeyFromColumn,
  createEmptyMap,
  edgeKey,
  getHexCenter,
  neighborKey,
} from './map-model.js';

export const TUTORIAL_ROUTE = 'tutorial';
export const TUTORIAL_PART = 1;
export const TUTORIAL_STORAGE_KEY = 'thirst-for-oxygen-tutorial-exit';

const TUTORIAL_WIDTH = 12;
const TUTORIAL_HEIGHT = 24;
const TUTORIAL_OBJECT_SIZE = 30;
const TUTORIAL_EXIT_ARRIVAL_RADIUS = 9;

export const TUTORIAL_OBJECT_GUIDES = Object.freeze([
  Object.freeze({ id: 'checkpoint', label: 'Checkpoint', description: '碰到後更新重生點，並回滿生命、氧氣與能量。' }),
  Object.freeze({ id: 'seaweed', label: '水草', description: '靠近後按 E 附著；暫停重力並回復能量，再按 E 離開。' }),
  Object.freeze({ id: 'oxygen', label: '氧氣礦石', description: '用足夠速度撞擊才會釋放氧氣；不是輕碰就能拿。' }),
  Object.freeze({ id: 'oxygenBubble', label: '清氧氣泡', description: '接觸後立即補氧，使用一次就消失。' }),
  Object.freeze({ id: 'torricelli', label: '托里切利空間', description: '停在裡面會持續回復氧氣，適合管理長距離路線。' }),
  Object.freeze({ id: 'bubble', label: '光合作用氣泡', description: '補氧並暫時免疫重力，但短時間內不能再次彈射。' }),
  Object.freeze({ id: 'weightStone', label: '重石', description: '低速撞擊會被壓回；高速撞擊才能擊碎。' }),
  Object.freeze({ id: 'mine', label: '深海地雷', description: '接觸會反彈並造成傷害；先看速度與生命，再決定是否穿越。' }),
  Object.freeze({ id: 'razor', label: '剃刀', description: '接觸會強制推開；可用路線規劃避開。' }),
  Object.freeze({ id: 'button', label: '按鈕', description: '接觸後開啟或切換指定的條件通行門。' }),
  Object.freeze({ id: 'springJelly', label: '彈簧水母', description: '依入射角反射並加速，能把撞擊變成位移。' }),
  Object.freeze({ id: 'current', label: '洋流', description: '沿箭頭方向推動你，會改變下一次彈射的落點。' }),
  Object.freeze({ id: 'spike', label: '尖刺 Edge', description: '阻擋通路並造成接觸傷害，通常需要換角度。' }),
  Object.freeze({ id: 'barrier', label: '障礙 Edge', description: '阻擋通路但不造成傷害，迫使你重新找路。' }),
  Object.freeze({ id: 'wallGillGate', label: '潛壁鰓門', description: '靠近後按 E 進入或離開牆體；牆內仍會消耗氧氣。' }),
]);

const CORE_TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ id: 'launch', title: '先學會彈射', body: '拖曳潛水夫，調整方向與距離，放開後就會依慣性前進。每次彈射都會消耗能量，氧氣則會持續倒數。' }),
  Object.freeze({ id: 'seaweed', title: '找一個可以喘息的地方', body: '靠近水草後按 E。附著時重力暫停、能量會回復；要繼續前進，再按一次 E 離開。' }),
  Object.freeze({ id: 'resource', title: '管理氧氣與能量', body: '不要只顧著往前衝：氧氣礦石要高速撞擊，清氧氣泡接觸即消耗，托里切利空間則適合停留回氧。' }),
  Object.freeze({ id: 'checkpoint', title: '記住你的退路', body: '碰到 Checkpoint 後，死亡會回到這裡，而且生命、氧氣、能量會一起補滿。' }),
  Object.freeze({ id: 'weapon', title: '讓移動也成為攻擊', body: '第一把武器會跟著你的移動運作。你不一定要追著敵人砍，先學會用彈射路徑擦過敵人。' }),
  Object.freeze({ id: 'resonance', title: '敵人不一定要死', body: '靠近敵人並維持擦身距離，可以累積共鳴。共鳴完成後敵人會中立，這和擊殺一樣都能通過教學。' }),
]);

const EVENT_TO_OBJECT_ID = Object.freeze({
  checkpoint: 'checkpoint',
  seaweed: 'seaweed',
  oxygen: 'oxygen',
  oxygenBubble: 'oxygenBubble',
  torricelli: 'torricelli',
  bubble: 'bubble',
  weightStone: 'weightStone',
  mine: 'mine',
  razor: 'razor',
  button: 'button',
  springJelly: 'springJelly',
  current: 'current',
  spike: 'spike',
  barrier: 'barrier',
  wallGillEnter: 'wallGillGate',
  wallGillExit: 'wallGillGate',
});

const WEAPON_EFFECT_TYPES = new Set([
  'knifePath',
  'knifeSidePath',
  'knifeStationaryArea',
  'tridentFired',
  'lightMachineGunBurst',
]);

function tutorialKey(column, row) {
  return cellKeyFromColumn(column, row);
}

function getTutorialCell(map, column, row) {
  return map.cells[tutorialKey(column, row)] ?? null;
}

function addActor(map, column, row, marker) {
  const cell = getTutorialCell(map, column, row);
  if (cell) cell.actors.push({ ...marker });
}

function addObject(map, column, row, kind, params = {}) {
  const cell = getTutorialCell(map, column, row);
  if (!cell) return;
  cell.freeObjects.push({
    kind,
    offset: { x: 0, y: 0 },
    size: TUTORIAL_OBJECT_SIZE,
    params: { ...params },
  });
}

function addEdge(map, column, row, direction, type, params = {}) {
  const from = tutorialKey(column, row);
  const to = neighborKey(from, direction);
  if (!map.cells[from] || !map.cells[to]) return;
  const edge = {
    cells: [from, to],
    type,
    blocksPassage: ['barrier', 'spike', 'wallGillGate', 'springJelly'].includes(type),
    currentDirection: params.currentDirection ?? 0,
    currentStrength: params.currentStrength ?? 0,
    size: TUTORIAL_OBJECT_SIZE,
    params: { ...params },
  };
  map.edges[edgeKey(from, to)] = edge;
}

function addClosedGate(map, column, row, gateId) {
  const cell = getTutorialCell(map, column, row);
  if (!cell) return;
  cell.terrain = 'blocked';
  cell.conditionalGate = { opened: false, role: 'tutorial-button', gateId };
}

export function createTutorialMap() {
  const map = createEmptyMap({ width: TUTORIAL_WIDTH, height: TUTORIAL_HEIGHT });
  Object.values(map.cells).forEach((cell) => {
    cell.region = 'tutorial-room';
    cell.gravityLevel = cell.r < 4 || (cell.r >= 9 && cell.r < 12) ? 'L0' : 'L1';
  });

  // A small walled room: the player can still leave through the authored exit,
  // but the training space does not accidentally spill into an infinite map.
  for (let row = 0; row < TUTORIAL_HEIGHT; row += 1) {
    getTutorialCell(map, 0, row).terrain = 'blocked';
    getTutorialCell(map, TUTORIAL_WIDTH - 1, row).terrain = 'blocked';
  }
  for (let column = 0; column < TUTORIAL_WIDTH; column += 1) {
    getTutorialCell(map, column, 0).terrain = 'blocked';
    getTutorialCell(map, column, TUTORIAL_HEIGHT - 1).terrain = 'blocked';
  }

  addActor(map, 2, 2, { kind: 'playerStart' });
  addActor(map, 8, 15, { kind: 'enemySpawn', enemyId: 'explodingLanternfish' });

  addObject(map, 2, 4, 'checkpoint');
  addObject(map, 4, 6, 'oxygen', { oxygenAmount: 100, activationSpeed: 110 });
  addObject(map, 6, 7, 'oxygenBubble', { oxygenAmount: 25 });
  addObject(map, 2, 9, 'torricelli', { oxygenRecoveryPerSecond: 20 });
  addObject(map, 5, 10, 'bubble', { oxygenAmount: 50, gravityImmunitySeconds: 2.5, launchLockSeconds: 1.5 });
  addObject(map, 7, 12, 'weightStone', { breakSpeed: 31, weight: 4 });
  addObject(map, 3, 15, 'mine', { damage: 0 });
  addObject(map, 4, 17, 'razor', { count: 1, damage: 0, knockbackSpeed: 58, rotationSpeed: 180 });
  addObject(map, 8, 18, 'button', { mode: 'once', targetGates: [tutorialKey(8, 19)] });
  addClosedGate(map, 8, 19, 'tutorial-button-gate');

  addEdge(map, 2, 3, 0, 'seaweed');
  addEdge(map, 4, 6, 0, 'springJelly', { bounceMultiplier: 1.08 });
  addEdge(map, 6, 9, 0, 'current', { currentDirection: 0, currentStrength: 1 });
  addEdge(map, 3, 13, 0, 'spike', { damage: 0 });
  addEdge(map, 9, 13, 0, 'barrier');
  addEdge(map, 2, 15, 0, 'coralCluster');
  addEdge(map, 10, 18, 0, 'wallGillGate');

  const exitCellKey = tutorialKey(10, 21);
  return {
    ...map,
    metadata: {
      chapter: '新手教學房',
      part: TUTORIAL_PART,
      title: '新手教學房｜第一次呼吸',
      difficulty: 'tutorial',
      designIntent: '用一個可自由離開的小房間，讓玩家以操作理解彈射、物件、資源、武器，以及擊殺／共鳴兩種勝利方式。',
      enemyTargetCount: 1,
      tutorial: {
        room: 'first-breath',
        coreSteps: CORE_TUTORIAL_STEPS.map((step) => step.id),
        objectGuides: TUTORIAL_OBJECT_GUIDES.map((guide) => guide.id),
      },
      exitCellKey,
    },
  };
}

export function createPlayTutorialState() {
  return {
    completed: new Set(),
    objectUses: new Set(),
    autoReady: false,
    exitReason: null,
  };
}

export function recordPlayTutorialLaunch(state) {
  if (state) state.completed.add('launch');
  return state;
}

export function recordPlayTutorialInteraction(state, result) {
  if (!state || !result) return state;
  const objectId = EVENT_TO_OBJECT_ID[result.type];
  if (objectId) state.objectUses.add(objectId);
  if (result.type === 'seaweed' && result.attached) state.completed.add('seaweed');
  return state;
}

export function recordPlayTutorialEvents(state, events = []) {
  if (!state) return state;
  events.forEach((event) => {
    const objectId = EVENT_TO_OBJECT_ID[event?.type];
    if (objectId) state.objectUses.add(objectId);
    if (event?.type === 'checkpoint') state.completed.add('checkpoint');
    if (['oxygen', 'oxygenBubble', 'torricelli', 'bubble'].includes(event?.type)) state.completed.add('resource');
  });
  return state;
}

export function recordPlayTutorialCombat(state, combatState) {
  if (!state || !combatState) return state;
  if ([...(combatState.effects ?? [])].some((effect) => WEAPON_EFFECT_TYPES.has(effect.type))) state.completed.add('weapon');
  return state;
}

export function getPlayTutorialExitState({ map, actor, origin = { x: 0, y: 0 } } = {}) {
  const exitCellKey = map?.metadata?.exitCellKey;
  const cell = exitCellKey ? map?.cells?.[exitCellKey] : null;
  const exit = cell?.terrain === 'water' ? { cellKey: exitCellKey, ...getHexCenter(cell, origin) } : null;
  const distance = exit && Number.isFinite(actor?.x) && Number.isFinite(actor?.y)
    ? Math.hypot(actor.x - exit.x, actor.y - exit.y)
    : null;
  const actorRadius = Number.isFinite(actor?.radius) ? Math.max(0, actor.radius) : 0;
  return {
    tutorial: true,
    part: TUTORIAL_PART,
    exit,
    unlocked: Boolean(exit),
    arrived: Boolean(exit) && distance <= TUTORIAL_EXIT_ARRIVAL_RADIUS + actorRadius,
    completed: false,
    nextPart: null,
    distance,
  };
}

export function stepPlayTutorial(state, { enemies = [] } = {}) {
  if (!state) return { readyToLeave: false, outcome: null };
  const outcomeEnemy = enemies.find((enemy) => enemy?.resonanceNeutral || enemy?.defeated || Number(enemy?.health) <= 0);
  if (outcomeEnemy) {
    state.completed.add('resonance');
    state.exitReason = outcomeEnemy.resonanceNeutral ? 'resonance' : 'defeat';
  }
  const required = ['launch', 'seaweed', 'resource', 'checkpoint', 'weapon', 'resonance'];
  state.autoReady = required.every((id) => state.completed.has(id));
  return { readyToLeave: state.autoReady, outcome: state.exitReason };
}

export function getPlayTutorialRenderState(state, enemies = []) {
  const safeState = state ?? createPlayTutorialState();
  const progress = stepPlayTutorial(safeState, { enemies });
  const currentStep = CORE_TUTORIAL_STEPS.find((step) => !safeState.completed.has(step.id)) ?? null;
  const completedCoreSteps = CORE_TUTORIAL_STEPS.filter((step) => safeState.completed.has(step.id)).length;
  return {
    active: true,
    currentStep: currentStep ?? Object.freeze({ id: 'ready', title: '你已經會呼吸了', body: progress.outcome === 'resonance' ? '你用共鳴讓敵人中立；這也是勝利。出口會自動帶你進入正式篇章。' : '你已經用武器解決敵人；出口會自動帶你進入正式篇章。' }),
    completedCoreSteps,
    totalCoreSteps: CORE_TUTORIAL_STEPS.length,
    objectUses: TUTORIAL_OBJECT_GUIDES.map((guide) => ({ ...guide, used: safeState.objectUses.has(guide.id) })),
    outcome: progress.outcome,
    autoReady: progress.readyToLeave,
    freeExit: '你可以隨時前往房間底部的 EXIT，或直接切換地圖離開教學。',
  };
}
