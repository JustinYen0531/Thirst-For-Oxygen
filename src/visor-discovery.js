import { ENEMY_DEFINITIONS } from './game-data.js';

export const DISCOVERY_COLORS = Object.freeze({
  enemy: '#ff5364',
  danger: '#ff9b45',
  supply: '#71e88f',
  support: '#43dfca',
  mechanism: '#52aaff',
});

const guide = (title, category, categoryLabel, description) => Object.freeze({
  title,
  category,
  categoryLabel,
  description,
  colour: DISCOVERY_COLORS[category],
});

export const OBJECT_DISCOVERY_GUIDES = Object.freeze({
  mine: guide('深海地雷', 'danger', '危險物', '接近或撞擊會引爆；爆炸也可能波及附近敵人。'),
  razor: guide('剃刀', 'danger', '危險物', '接觸會造成傷害，並把潛水員強制推離。'),
  oxygen: guide('氧氣礦石', 'supply', '補給物', '以足夠速度撞開後，會釋放氧氣補給。'),
  oxygenBubble: guide('清氧氣泡', 'supply', '補給物', '接觸後立即補充乾淨氧氣；Boss 房間會依時間重新生成。'),
  bubble: guide('光合作用氣泡', 'supply', '補給物', '接觸後會短暫隔絕水域重力，並在氣泡消失前鎖住彈射。'),
  torricelli: guide('托里切利空間', 'supply', '補給物', '偏離主路的氧氣補給區，可恢復呼吸資源。'),
  checkpoint: guide('Checkpoint', 'mechanism', '機關', '啟動後記錄重生位置，並補滿玩家資源。'),
  weightStone: guide('重石', 'mechanism', '機關', '需要高速撞擊才能破壞，並打開原本封住的路。'),
  button: guide('一次性開門按鈕', 'mechanism', '機關', '觸發後會永久開啟與它連接的條件門。'),
  seaweed: guide('水草', 'support', '支援補給', '靠近後按字母 E 固定在水草上；固定時不會下墜，可以休息並恢復能量。再次按 E 即可離開。'),
  coralCluster: guide('珊瑚群落', 'support', '支援補給', '靠近後按字母 E，獲得 2.5 秒隱形；期間敵人看不見你。'),
});

export const EDGE_DISCOVERY_GUIDES = Object.freeze({
  spike: guide('尖刺邊界', 'danger', '危險物', '接觸尖刺會直接受到傷害。'),
  springJelly: guide('彈簧水母', 'mechanism', '機關', '撞上後會沿反方向彈開，可用來改變移動路線。'),
  barrier: guide('通用邊界', 'mechanism', '機關', '封鎖這一側的通行，必須改走其他路線。'),
  current: guide('潮流', 'mechanism', '機關', '持續把玩家推向標示方向。'),
  layerPortal: guide('層間轉接門', 'mechanism', '機關', '允許玩家穿越不同水域層級的交界。'),
  multiPortal: guide('多邊傳送門', 'mechanism', '機關', '進入後會被傳送到同組的另一個邊界。'),
  wallGillGate: guide('潛壁鰓門', 'mechanism', '機關', '靠近後按字母 E 進入不可通行牆體；要離開時，也必須在潛壁鰓門旁按 E。'),
  seaweed: OBJECT_DISCOVERY_GUIDES.seaweed,
  coralCluster: OBJECT_DISCOVERY_GUIDES.coralCluster,
});

export const CONDITIONAL_GATE_GUIDE = guide('條件通行門', 'mechanism', '機關', '找到並觸發相連按鈕後，這道門才會永久開啟。');

export function getObjectDiscoveryGuide(kind) {
  return OBJECT_DISCOVERY_GUIDES[kind] ?? null;
}

export function getEdgeDiscoveryGuide(type) {
  return EDGE_DISCOVERY_GUIDES[type] ?? null;
}

export function getEnemyDiscoveryGuide(enemyId) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  if (!definition) return null;
  const actions = definition.attacks.slice(0, 2).map((attack) => attack.name).join('、');
  return guide(definition.name, 'enemy', '敵人', actions ? `敵對生物。主要行動：${actions}。` : '敵對生物，會主動妨礙玩家。');
}

export function createDiscoverySession() {
  return { seenGuideKeys: new Set(), activeByGuideKey: new Map(), pendingByGuideKey: new Map() };
}

export function updateDiscoverySession(session, visibleTargets, timeSeconds) {
  session.pendingByGuideKey ??= new Map();
  const visibleByInstanceId = new Map(visibleTargets.map((target) => [target.instanceId, target]));
  session.activeByGuideKey.forEach((active, guideKey) => {
    const current = visibleByInstanceId.get(active.instanceId);
    if (!current) session.activeByGuideKey.delete(guideKey);
    else session.activeByGuideKey.set(guideKey, { ...active, ...current });
  });
  session.pendingByGuideKey.forEach((pending, guideKey) => {
    const current = visibleByInstanceId.get(pending.instanceId);
    if (!current) session.pendingByGuideKey.delete(guideKey);
    else session.pendingByGuideKey.set(guideKey, { ...pending, ...current });
  });

  visibleTargets.forEach((target) => {
    if (session.seenGuideKeys.has(target.guideKey)
      || session.activeByGuideKey.has(target.guideKey)
      || session.pendingByGuideKey.has(target.guideKey)) return;
    session.pendingByGuideKey.set(target.guideKey, target);
  });

  if (session.activeByGuideKey.size === 0) {
    const next = session.pendingByGuideKey.values().next().value;
    if (next) {
      session.pendingByGuideKey.delete(next.guideKey);
      session.seenGuideKeys.add(next.guideKey);
      session.activeByGuideKey.set(next.guideKey, {
        ...next,
        startedAt: Number.isFinite(timeSeconds) ? timeSeconds : 0,
      });
    }
  }

  return [...session.activeByGuideKey.values()];
}

export function acknowledgeDiscoveryGuide(session, guideKey) {
  if (!session?.activeByGuideKey?.has(guideKey)) return false;
  session.activeByGuideKey.delete(guideKey);
  return true;
}

export function getDiscoveryTypedDescription(
  activeGuide,
  timeSeconds,
  charactersPerSecond = 24,
  translate = (value) => value,
) {
  const elapsed = Math.max(0, (Number.isFinite(timeSeconds) ? timeSeconds : 0) - activeGuide.startedAt);
  const source = String(activeGuide?.guide?.description ?? '');
  const characterCount = Math.max(1, Math.floor(elapsed * charactersPerSecond));
  const translated = String(translate(source) ?? source);
  const progress = Math.min(1, characterCount / Math.max(1, source.length));
  return translated.slice(0, Math.max(1, Math.floor(translated.length * progress)));
}
