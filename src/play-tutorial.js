import {
  cellKeyFromColumn,
  createEmptyMap,
  edgeKey,
  getHexCenter,
  neighborKey,
} from './map-model.js';

export const TUTORIAL_ROUTE = 'tutorial';
export const TUTORIAL_PART = 0;

const TUTORIAL_WIDTH = 12;
const TUTORIAL_HEIGHT = 24;
const TUTORIAL_OBJECT_SIZE = 30;
const TUTORIAL_EXIT_ARRIVAL_RADIUS = 9;
const TUTORIAL_EXIT_POSITION = Object.freeze({ column: 10, row: 2 });
export const TUTORIAL_TASK_COMPLETION_TARGET = 10;

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
  Object.freeze({ id: 'coralCluster', label: '珊瑚群落', description: '靠近後按 E 啟動短暫隱形；敵人會暫停鎖定與攻擊。' }),
  Object.freeze({ id: 'button', label: '按鈕', description: '接觸後開啟或切換指定的條件通行門。' }),
  Object.freeze({ id: 'springJelly', label: '彈簧水母', description: '依入射角反射並加速，能把撞擊變成位移。' }),
  Object.freeze({ id: 'current', label: '洋流', description: '沿箭頭方向推動你，會改變下一次彈射的落點。' }),
  Object.freeze({ id: 'spike', label: '尖刺 Edge', description: '阻擋通路並造成接觸傷害，通常需要換角度。' }),
  Object.freeze({ id: 'barrier', label: '障礙 Edge', description: '阻擋通路但不造成傷害，迫使你重新找路。' }),
  Object.freeze({ id: 'wallGillGate', label: '潛壁鰓門', description: '靠近後按 E 進入或離開牆體；牆內仍會消耗氧氣。' }),
]);

const TUTORIAL_GUIDE_NAME = '深淵導航員';

export const TUTORIAL_GUIDED_STEPS = Object.freeze([
  Object.freeze({ id: 'launch', title: '先學會彈射', body: '先不要往出口走。把游標放在潛水夫身上，拖曳出方向與距離，放開完成一次拉射。', instruction: '請現在完成一次拉射。沒有真的放開彈射，導航員不會讓你進入下一步。', controlHint: '操作：按住滑鼠左鍵拖曳潛水夫，放開完成一次拉射。', target: { column: 2, row: 2 }, targetLabel: '你的潛水夫' }),
  Object.freeze({ id: 'seaweedAttach', title: '先學會停下來', body: '前方的水草是你的喘息點。靠近後按 E 附著，重力會暫停，能量也會恢復。', instruction: '請靠近水草並按 E 附著一次。', controlHint: '操作：靠近水草後按 E，附著在水草上。', target: { column: 2, row: 3 }, targetLabel: '水草' }),
  Object.freeze({ id: 'seaweedRelease', title: '知道什麼時候離開', body: '水草不是終點。附著後再按一次 E，才會重新回到水中前進。', instruction: '請再按一次 E 離開水草。', controlHint: '操作：附著在水草上時再按 E，離開水草。', target: { column: 2, row: 3 }, targetLabel: '水草' }),
  Object.freeze({ id: 'checkpoint', title: '記住你的退路', body: 'Checkpoint 會記住你的重生位置，並在重生時補滿生命、氧氣與能量。', instruction: '請碰到前方的 Checkpoint，讓導航員記住這個位置。', controlHint: '操作：用潛水夫碰到 Checkpoint，更新重生點。', target: { column: 2, row: 4 }, targetLabel: 'Checkpoint' }),
  Object.freeze({ id: 'oxygen', title: '用速度換氧氣', body: '氧氣礦石不是輕輕碰就會掉落。你要用足夠速度撞擊，才會釋放氧氣。', instruction: '請高速撞擊氧氣礦石，實際取得一次氧氣。', controlHint: '操作：拉射一段足夠長的距離，高速撞擊氧氣礦石。', target: { column: 4, row: 6 }, targetLabel: '氧氣礦石' }),
  Object.freeze({ id: 'oxygenBubble', title: '接觸式補氧', body: '清氧氣泡會在接觸時立即補氧，而且使用一次就會消失。', instruction: '請碰到清氧氣泡，使用一次補給。', controlHint: '操作：移動潛水夫碰到清氧氣泡，接觸就會自動使用。', target: { column: 6, row: 7 }, targetLabel: '清氧氣泡' }),
  Object.freeze({ id: 'torricelli', title: '找到可以停留的空間', body: '托里切利空間會持續回復氧氣，適合在長距離路線中停下來整理資源。', instruction: '請進入托里切利空間並停留片刻。', controlHint: '操作：把潛水夫移進托里切利空間，停留在裡面回復氧氣。', target: { column: 2, row: 9 }, targetLabel: '托里切利空間' }),
  Object.freeze({ id: 'bubble', title: '讓氣泡替你承受重力', body: '光合作用氣泡會補氧並暫時免疫重力，但作用期間不能立刻再次彈射。', instruction: '請碰到光合作用氣泡，實際取得它的效果。', controlHint: '操作：用潛水夫碰到光合作用氣泡，接觸後效果會自動啟動。', target: { column: 5, row: 10 }, targetLabel: '光合作用氣泡' }),
  Object.freeze({ id: 'weightStone', title: '分辨撞擊速度', body: '重石會把低速撞擊壓回；只有高速撞擊才會被擊碎。', instruction: '請用高速撞擊擊碎重石。', controlHint: '操作：拉射撞上重石；低速會被彈回，高速才會擊碎它。', target: { column: 7, row: 12 }, targetLabel: '重石' }),
  Object.freeze({ id: 'mine', title: '危險也要讀懂', body: '地雷會反彈並造成傷害。這一間房把傷害調低，但你仍要實際碰過它，知道它不是補給。', instruction: '請碰觸深海地雷一次。', controlHint: '操作：用潛水夫碰觸深海地雷，感受它的反彈與傷害。', target: { column: 4, row: 14 }, targetLabel: '深海地雷' }),
  Object.freeze({ id: 'razor', title: '不要硬闖剃刀', body: '剃刀會強制把你推開。遇到它時要調整路線，不是一直往前撞。', instruction: '請碰觸剃刀一次，觀察它如何把你推開。', controlHint: '操作：用潛水夫碰觸剃刀，觀察反彈後再調整下一次拉射。', target: { column: 4, row: 17 }, targetLabel: '剃刀' }),
  Object.freeze({ id: 'coralCluster', title: '珊瑚是短暫的掩護', body: '靠近珊瑚後按 E，可以讓敵人暫時看不見你；這不是永久安全區。', instruction: '請靠近珊瑚並按 E 啟動隱形。', controlHint: '操作：靠近珊瑚群落後按 E，啟動短暫隱形。', target: { column: 6, row: 14 }, targetLabel: '珊瑚群落' }),
  Object.freeze({ id: 'button', title: '碰到按鈕才會開門', body: '按鈕會切換指定的條件通行門。先碰按鈕，再觀察前方的門。', instruction: '請碰到按鈕，打開教學房的通行門。', controlHint: '操作：用潛水夫碰到按鈕，條件通行門就會打開。', target: { column: 8, row: 18 }, targetLabel: '按鈕' }),
  Object.freeze({ id: 'springJelly', title: '借力改變方向', body: '彈簧水母會依照入射角反射並加速，把一次撞擊轉成新的位移。', instruction: '請撞上彈簧水母一次，感受反射方向。', controlHint: '操作：用拉射撞上彈簧水母，觀察它把你反射到哪裡。', target: { column: 4, row: 6 }, targetLabel: '彈簧水母' }),
  Object.freeze({ id: 'current', title: '讀懂洋流', body: '洋流會沿箭頭方向推動你，會改變下一次拉射的落點。', instruction: '請穿過洋流一次，觀察它如何改變你的漂移。', controlHint: '操作：讓潛水夫穿過洋流箭頭區域，觀察推力方向。', target: { column: 6, row: 9 }, targetLabel: '洋流' }),
  Object.freeze({ id: 'spike', title: '尖刺會傷害你', body: '尖刺 Edge 會阻擋通路並造成接觸傷害。先看角度，再決定要不要繞路。', instruction: '請安全地碰到尖刺 Edge 一次，讀懂它的阻擋反應。', controlHint: '操作：用較安全的角度碰到尖刺 Edge，確認它會阻擋並造成傷害。', target: { column: 3, row: 13 }, targetLabel: '尖刺 Edge' }),
  Object.freeze({ id: 'barrier', title: '障礙只是在說不行', body: '障礙 Edge 會阻擋通路，但不會造成傷害；你需要換一個角度。', instruction: '請碰到障礙 Edge 一次，確認它和尖刺不同。', controlHint: '操作：碰到障礙 Edge，確認它只阻擋、不造成傷害。', target: { column: 9, row: 13 }, targetLabel: '障礙 Edge' }),
  Object.freeze({ id: 'wallGillGate', title: '穿進牆裡也要記得氧氣', body: '潛壁鰓門需要按 E 進入與離開。牆內仍會消耗氧氣，而且不能使用武器。', instruction: '請按 E 進入牆體，再按一次 E 離開。', controlHint: '操作：靠近潛壁鰓門按 E 進入，再按一次 E 離開。', target: { column: 10, row: 18 }, targetLabel: '潛壁鰓門' }),
  Object.freeze({ id: 'weapon', title: '讓移動也成為攻擊', body: '第一把武器會跟著你的移動運作。你不一定要追著敵人砍，先用拉射路徑擦過敵人。', instruction: '請用一次拉射路徑命中訓練敵人。', controlHint: '操作：拖曳並放開拉射，讓路徑真正擦過訓練敵人 B。', target: { column: 9, row: 15 }, targetLabel: '訓練敵人 B' }),
  Object.freeze({ id: 'kill', title: '擊殺也可以取勝', body: '右側的訓練敵人有有限生命，而且不會自爆。你可以用武器把它的生命降到零，理解「擊殺」這條路。', instruction: '請把右側訓練敵人的生命降到零。', controlHint: '操作：持續用武器命中訓練敵人 B，直到它的生命歸零。', target: { column: 9, row: 15 }, targetLabel: '訓練敵人 B' }),
  Object.freeze({ id: 'resonance', title: '敵人不一定要死', body: '靠近敵人並維持擦身距離，可以累積 Resonance。共鳴完成後，敵人會成為中立夥伴。', instruction: '請對另一隻訓練敵人完成一次 Resonance。只有真正中立化，導航員才會開放出口。', controlHint: '操作：靠近訓練敵人 A，保持擦身距離直到 Resonance 完成；不必殺死它。', target: { column: 7, row: 15 }, targetLabel: '訓練敵人 A' }),
]);

export const TUTORIAL_TASKS = Object.freeze([
  Object.freeze({ id: 'launch', title: '先學會彈射', stepIds: Object.freeze(['launch']) }),
  Object.freeze({ id: 'seaweed', title: '附著與離開水草', stepIds: Object.freeze(['seaweedAttach', 'seaweedRelease']) }),
  Object.freeze({ id: 'checkpoint', title: '記住你的退路', stepIds: Object.freeze(['checkpoint']) }),
  Object.freeze({ id: 'oxygen', title: '用速度換氧氣', stepIds: Object.freeze(['oxygen']) }),
  Object.freeze({ id: 'oxygenBubble', title: '接觸式補氧', stepIds: Object.freeze(['oxygenBubble']) }),
  Object.freeze({ id: 'torricelli', title: '找到可以停留的空間', stepIds: Object.freeze(['torricelli']) }),
  Object.freeze({ id: 'bubble', title: '讓氣泡替你承受重力', stepIds: Object.freeze(['bubble']) }),
  Object.freeze({ id: 'weightStone', title: '分辨撞擊速度', stepIds: Object.freeze(['weightStone']) }),
  Object.freeze({ id: 'mine', title: '讀懂深海地雷', stepIds: Object.freeze(['mine']) }),
  Object.freeze({ id: 'razor', title: '不要硬闖剃刀', stepIds: Object.freeze(['razor']) }),
  Object.freeze({ id: 'coralCluster', title: '使用珊瑚掩護', stepIds: Object.freeze(['coralCluster']) }),
  Object.freeze({ id: 'button', title: '碰到按鈕才會開門', stepIds: Object.freeze(['button']) }),
  Object.freeze({ id: 'springJelly', title: '借彈簧水母改變方向', stepIds: Object.freeze(['springJelly']) }),
  Object.freeze({ id: 'current', title: '讀懂洋流', stepIds: Object.freeze(['current']) }),
  Object.freeze({ id: 'spike', title: '尖刺會傷害你', stepIds: Object.freeze(['spike']) }),
  Object.freeze({ id: 'barrier', title: '障礙只是在說不行', stepIds: Object.freeze(['barrier']) }),
  Object.freeze({ id: 'wallGillGate', title: '穿越潛壁鰓門', stepIds: Object.freeze(['wallGillGate']) }),
  Object.freeze({ id: 'weapon', title: '讓移動也成為攻擊', stepIds: Object.freeze(['weapon']) }),
  Object.freeze({ id: 'kill', title: '學會擊殺敵人', stepIds: Object.freeze(['kill']) }),
  Object.freeze({ id: 'resonance', title: '學會 Resonance', stepIds: Object.freeze(['resonance']) }),
]);

const TUTORIAL_TASK_NAVIGATION_HINT = `操作：使用 ← / → 切換 First Breath 任務；完成任意 ${TUTORIAL_TASK_COMPLETION_TARGET} 項即可解鎖 EXIT；Enter 可開啟 Skip Tutorial。`;

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
  coralInvisibility: 'coralCluster',
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
  addActor(map, 7, 15, {
    kind: 'enemySpawn',
    enemyId: 'explodingLanternfish',
    tutorialRole: 'resonance',
    tutorialInfiniteHealth: true,
    tutorialNoSelfDestruct: true,
    tutorialStationary: true,
  });
  addActor(map, 9, 15, {
    kind: 'enemySpawn',
    enemyId: 'explodingLanternfish',
    tutorialRole: 'kill',
    tutorialHealth: 20,
    tutorialNoSelfDestruct: true,
    tutorialResonanceDisabled: true,
    tutorialStationary: true,
  });

  addObject(map, 2, 4, 'checkpoint');
  addObject(map, 4, 6, 'oxygen', { oxygenAmount: 100, activationSpeed: 110 });
  addObject(map, 6, 7, 'oxygenBubble', { oxygenAmount: 25 });
  addObject(map, 2, 9, 'torricelli', { oxygenRecoveryPerSecond: 20 });
  addObject(map, 5, 10, 'bubble', { oxygenAmount: 50, gravityImmunitySeconds: 2.5, launchLockSeconds: 1.5 });
  addObject(map, 7, 12, 'weightStone', { breakSpeed: 31, weight: 4 });
  addObject(map, 4, 14, 'mine', { damage: 0 });
  addObject(map, 4, 17, 'razor', { count: 1, damage: 0, knockbackSpeed: 58, rotationSpeed: 180 });
  addObject(map, 8, 18, 'button', { mode: 'once', targetGates: [tutorialKey(8, 19)] });
  addClosedGate(map, 8, 19, 'tutorial-button-gate');

  addEdge(map, 2, 3, 0, 'seaweed');
  addEdge(map, 4, 6, 0, 'springJelly', { bounceMultiplier: 1.08 });
  addEdge(map, 6, 9, 0, 'current', { currentDirection: 0, currentStrength: 1 });
  addEdge(map, 3, 13, 0, 'spike', { damage: 0 });
  addEdge(map, 9, 13, 0, 'barrier');
  addEdge(map, 6, 14, 0, 'coralCluster');
  addEdge(map, 10, 18, 0, 'wallGillGate');

  const exitCellKey = tutorialKey(TUTORIAL_EXIT_POSITION.column, TUTORIAL_EXIT_POSITION.row);
  return {
    ...map,
    metadata: {
      chapter: '新手教學房',
      part: TUTORIAL_PART,
      title: '第零篇章｜第一次呼吸',
      difficulty: 'tutorial',
      designIntent: '由深淵導航員逐步帶領玩家理解彈射、物件、資源、武器，以及擊殺／共鳴兩種勝利方式。',
      enemyTargetCount: 2,
      tutorial: {
        room: 'first-breath',
        guided: true,
        guideName: TUTORIAL_GUIDE_NAME,
        coreSteps: TUTORIAL_TASKS.map((task) => task.id),
        tasks: TUTORIAL_TASKS.map((task) => ({ id: task.id, title: task.title, stepIds: [...task.stepIds] })),
        taskCount: TUTORIAL_TASKS.length,
        completionTarget: TUTORIAL_TASK_COMPLETION_TARGET,
        objectGuides: TUTORIAL_OBJECT_GUIDES.map((guide) => guide.id),
        skipKey: 'Enter',
      },
      exitCellKey,
    },
  };
}

export function createPlayTutorialState() {
  return {
    completed: new Set(),
    observedActions: new Set(),
    objectUses: new Set(),
    selectedTaskIndex: 0,
    seaweedAttached: false,
    wallGillEntered: false,
    wallGillExited: false,
    autoReady: false,
    exitReason: null,
    lastGuideNote: null,
  };
}

function getTaskByIndex(index) {
  const safeIndex = ((Number(index) || 0) % TUTORIAL_TASKS.length + TUTORIAL_TASKS.length) % TUTORIAL_TASKS.length;
  return TUTORIAL_TASKS[safeIndex] ?? TUTORIAL_TASKS[0];
}

function isTutorialTaskComplete(state, task) {
  return task.stepIds.every((stepId) => state.completed.has(stepId));
}

function refreshTutorialTaskProgress(state) {
  state.completedTasks = new Set(TUTORIAL_TASKS.filter((task) => isTutorialTaskComplete(state, task)).map((task) => task.id));
  state.autoReady = state.completedTasks.size >= TUTORIAL_TASK_COMPLETION_TARGET;
  if (state.autoReady) return state;
  const selectedTask = getTaskByIndex(state.selectedTaskIndex);
  if (!isTutorialTaskComplete(state, selectedTask)) return state;
  const nextIndex = TUTORIAL_TASKS.findIndex((task) => !isTutorialTaskComplete(state, task));
  if (nextIndex >= 0) state.selectedTaskIndex = nextIndex;
  return state;
}

function getCurrentTask(state) {
  return getTaskByIndex(state?.selectedTaskIndex);
}

function getCurrentGuidedStep(state) {
  const task = getCurrentTask(state);
  const incompleteStepId = task.stepIds.find((stepId) => !state.completed.has(stepId));
  const stepId = incompleteStepId ?? task.stepIds[task.stepIds.length - 1];
  return TUTORIAL_GUIDED_STEPS.find((step) => step.id === stepId) ?? TUTORIAL_GUIDED_STEPS[0];
}

export function selectPlayTutorialTask(state, direction = 1) {
  if (!state) return state;
  const delta = Number(direction) < 0 ? -1 : 1;
  state.selectedTaskIndex = ((Number(state.selectedTaskIndex) || 0) + delta + TUTORIAL_TASKS.length) % TUTORIAL_TASKS.length;
  state.lastGuideNote = null;
  return state;
}

function observeTutorialAction(state, actionId) {
  if (!state || !actionId) return state;
  state.observedActions.add(actionId);
  state.completed.add(actionId);
  return refreshTutorialTaskProgress(state);
}

function tutorialEventSucceeded(event) {
  if (!event?.type || event.success === false) return false;
  if (event.success === true) return true;
  const message = String(event.message ?? '');
  if (event.type === 'oxygen') return message.includes('撞擊後釋放');
  if (event.type === 'weightStone') return message.includes('擊碎');
  if (event.type === 'button') return message.includes('已開啟') || message.includes('已切換');
  return true;
}

function tutorialWeaponEffectSucceeded(effect) {
  if (!WEAPON_EFFECT_TYPES.has(effect?.type)) return false;
  if (effect.type === 'knifePath' || effect.type === 'knifeSidePath') return (effect.hitIds?.length ?? 0) > 0;
  return true;
}

export function recordPlayTutorialLaunch(state) {
  return observeTutorialAction(state, 'launch');
}

export function recordPlayTutorialInteraction(state, result) {
  if (!state || !result) return state;
  const objectId = EVENT_TO_OBJECT_ID[result.type];
  if (objectId) state.objectUses.add(objectId);
  if (result.type === 'seaweed') {
    if (result.attached) {
      state.seaweedAttached = true;
      observeTutorialAction(state, 'seaweedAttach');
    } else if (state.seaweedAttached) {
      state.seaweedAttached = false;
      observeTutorialAction(state, 'seaweedRelease');
    }
  }
  if (result.type === 'wallGillEnter') {
    state.wallGillEntered = true;
    state.lastGuideNote = '你已進入牆體。記得按 E 離開，牆內的氧氣仍會持續消耗。';
  }
  if (result.type === 'wallGillExit') {
    state.wallGillExited = true;
    state.lastGuideNote = null;
  }
  if (state.wallGillEntered && state.wallGillExited) observeTutorialAction(state, 'wallGillGate');
  if (result.type === 'coralInvisibility') observeTutorialAction(state, 'coralCluster');
  return state;
}

export function recordPlayTutorialEvents(state, events = []) {
  if (!state) return state;
  events.forEach((event) => {
    const objectId = EVENT_TO_OBJECT_ID[event?.type];
    if (objectId && tutorialEventSucceeded(event)) state.objectUses.add(objectId);
    if (TUTORIAL_GUIDED_STEPS.some((step) => step.id === event?.type) && tutorialEventSucceeded(event)) observeTutorialAction(state, event.type);
  });
  return state;
}

export function recordPlayTutorialCombat(state, combatState) {
  if (!state || !combatState) return state;
  if ([...(combatState.effects ?? [])].some(tutorialWeaponEffectSucceeded)) observeTutorialAction(state, 'weapon');
  return state;
}

export function getPlayTutorialExitState({ map, actor, origin = { x: 0, y: 0 }, state, enemies = [] } = {}) {
  const progress = stepPlayTutorial(state, { enemies });
  const exitCellKey = map?.metadata?.exitCellKey;
  const cell = exitCellKey ? map?.cells?.[exitCellKey] : null;
  const exit = cell?.terrain === 'water' ? { cellKey: exitCellKey, ...getHexCenter(cell, origin) } : null;
  const distance = exit && Number.isFinite(actor?.x) && Number.isFinite(actor?.y)
    ? Math.hypot(actor.x - exit.x, actor.y - exit.y)
    : null;
  const actorRadius = Number.isFinite(actor?.radius) ? Math.max(0, actor.radius) : 0;
  const unlocked = Boolean(exit) && progress.readyToLeave;
  return {
    tutorial: true,
    part: TUTORIAL_PART,
    exit,
    unlocked,
    arrived: unlocked && distance <= TUTORIAL_EXIT_ARRIVAL_RADIUS + actorRadius,
    completed: progress.readyToLeave,
    nextPart: null,
    distance,
    lockedReason: unlocked ? null : `請先完成任意 ${TUTORIAL_TASK_COMPLETION_TARGET} 項導航員任務；按 Enter 可開啟 Skip Tutorial。`,
  };
}

export function stepPlayTutorial(state, { enemies = [] } = {}) {
  if (!state) return { readyToLeave: false, outcome: null };
  const neutralEnemy = enemies.find((enemy) => enemy?.tutorialRole === 'resonance' && enemy?.resonanceNeutral);
  if (neutralEnemy) {
    state.exitReason = 'resonance';
    observeTutorialAction(state, 'resonance');
  }
  const killEnemy = enemies.find((enemy) => enemy?.tutorialRole === 'kill' && (enemy?.defeated || Number(enemy?.health) <= 0));
  if (killEnemy) observeTutorialAction(state, 'kill');
  const anyDefeatedEnemy = enemies.some((enemy) => enemy?.defeated || Number(enemy?.health) <= 0);
  if (!state.observedActions.has('resonance') && anyDefeatedEnemy) {
    state.lastGuideNote = '這隻敵人被擊敗了。導航員要你用另一隻敵人練習 Resonance；出口仍然鎖定。';
  }
  refreshTutorialTaskProgress(state);
  return {
    readyToLeave: state.autoReady,
    outcome: state.exitReason,
    currentStep: getCurrentGuidedStep(state),
    lastGuideNote: state.lastGuideNote,
  };
}

export function getPlayTutorialRenderState(state, enemies = []) {
  const safeState = state ?? createPlayTutorialState();
  const progress = stepPlayTutorial(safeState, { enemies });
  const selectedTask = getCurrentTask(safeState);
  const currentStep = progress.readyToLeave
    ? Object.freeze({ id: 'ready', title: '第零篇章完成', body: '你已經完成導航員的所有示範。這次教學不會把資源或進度帶入正式篇章；請前往右側出口離開。', instruction: '請前往右側醒目的 EXIT 離開第零篇章。', controlHint: '操作：依照右側牆面的 EXIT 標記離開。', target: TUTORIAL_EXIT_POSITION, targetLabel: 'EXIT' })
    : progress.currentStep ?? TUTORIAL_GUIDED_STEPS[0];
  const completedTasks = TUTORIAL_TASKS.filter((task) => isTutorialTaskComplete(safeState, task));
  const taskStep = progress.readyToLeave ? currentStep : currentStep;
  const targetCellKey = currentStep.target ? tutorialKey(currentStep.target.column, currentStep.target.row) : null;
  return {
    active: true,
    guideName: TUTORIAL_GUIDE_NAME,
    dialogue: Object.freeze({
      speaker: TUTORIAL_GUIDE_NAME,
      title: progress.readyToLeave ? currentStep.title : selectedTask.title,
      text: progress.lastGuideNote || currentStep.body,
      controlHint: progress.readyToLeave
        ? (currentStep.controlHint ?? currentStep.instruction ?? '')
        : `${currentStep.controlHint ?? currentStep.instruction ?? ''} ${TUTORIAL_TASK_NAVIGATION_HINT}`,
    }),
    currentStep,
    currentTask: selectedTask,
    selectedTaskIndex: safeState.selectedTaskIndex,
    selectedTaskId: selectedTask.id,
    tasks: TUTORIAL_TASKS.map((task, index) => ({
      id: task.id,
      title: task.title,
      completed: isTutorialTaskComplete(safeState, task),
      selected: index === safeState.selectedTaskIndex,
      currentStepId: task === selectedTask ? taskStep.id : null,
    })),
    completedCoreSteps: completedTasks.length,
    totalCoreSteps: TUTORIAL_TASKS.length,
    objectUses: TUTORIAL_OBJECT_GUIDES.map((guide) => ({ ...guide, used: safeState.objectUses.has(guide.id) })),
    outcome: progress.outcome,
    autoReady: progress.readyToLeave,
    freeExit: progress.readyToLeave
      ? '導航員已解除出口鎖定。請前往右側牆面的 EXIT 離開第零篇章。'
      : `導航員確認任意 ${TUTORIAL_TASK_COMPLETION_TARGET} 項任務前，出口會保持鎖定。真的要離開請按 Enter。`,
    lockedExit: !progress.readyToLeave,
    completionTarget: TUTORIAL_TASK_COMPLETION_TARGET,
    lastGuideNote: progress.lastGuideNote,
    targetCellKey,
    targetLabel: currentStep.targetLabel ?? null,
  };
}
