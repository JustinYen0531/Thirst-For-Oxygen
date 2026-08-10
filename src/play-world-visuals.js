import {
  CELL_OBJECT_TYPES,
  EDGE_TYPES,
  OVERLAY_TYPES,
} from './map-model.js';

const OBJECT_ROOT = '/assets/editor/objects';
const EDGE_ROOT = '/assets/editor/edges';

const visual = (id, {
  assetPath = null,
  componentAssetPaths = [],
  color,
  shape,
  label,
  edgeAttached = false,
  anchoredPlant = false,
  overlay = false,
  hazardous = false,
  blocksPassage = false,
} = {}) => Object.freeze({
  id,
  assetPath,
  componentAssetPaths: Object.freeze([...componentAssetPaths]),
  color,
  shape,
  label,
  edgeAttached,
  anchoredPlant,
  overlay,
  hazardous,
  blocksPassage,
  usesProgrammaticFallback: !assetPath,
});

export const PLAY_OBJECT_VISUALS = Object.freeze({
  coralCluster: visual('coralCluster', { assetPath: `${OBJECT_ROOT}/coral-cluster.png`, color: '#f1a0ff', shape: 'coral-cluster', label: '珊瑚群落' }),
  mine: visual('mine', { assetPath: `${OBJECT_ROOT}/deep-sea-mine.png`, color: '#ff9a4d', shape: 'mine', label: '深海水雷', hazardous: true }),
  weightStone: visual('weightStone', { assetPath: `${OBJECT_ROOT}/heavy-stone.png`, color: '#52aaff', shape: 'weight-stone', label: '重石' }),
  seaweed: visual('seaweed', { assetPath: `${OBJECT_ROOT}/sea-grass.png`, color: '#65e6ba', shape: 'seaweed', label: '水草' }),
  oxygen: visual('oxygen', { assetPath: `${OBJECT_ROOT}/oxygen-ore.png`, color: '#71e88f', shape: 'oxygen-ore', label: '含氧礦石' }),
  oxygenBubble: visual('oxygenBubble', { assetPath: `${OBJECT_ROOT}/photosynthesis-bubble.png`, color: '#71e8ff', shape: 'oxygen-bubble', label: '清氧氣泡' }),
  checkpoint: visual('checkpoint', { assetPath: `${OBJECT_ROOT}/checkpoint.png`, color: '#52aaff', shape: 'checkpoint', label: 'Checkpoint' }),
  bubble: visual('bubble', { assetPath: `${OBJECT_ROOT}/photosynthesis-bubble.png`, color: '#71e88f', shape: 'bubble', label: '光合作用氣泡' }),
  torricelli: visual('torricelli', { assetPath: `${OBJECT_ROOT}/torricelli-space.png`, color: '#71e88f', shape: 'torricelli-space', label: '托里切利空間' }),
  razor: visual('razor', {
    assetPath: `${OBJECT_ROOT}/razor-blade.png`,
    componentAssetPaths: [`${OBJECT_ROOT}/razor-axis.png`],
    color: '#ff9a4d',
    shape: 'rotating-razor',
    label: '剃刀軸',
    hazardous: true,
  }),
  // There is no authored button bitmap. Formal play must render this glyph
  // contract instead of issuing a broken request for button.png.
  button: visual('button', { color: '#52aaff', shape: 'button-glyph', label: '⏺', blocksPassage: false }),
});

export const PLAY_OVERLAY_VISUALS = Object.freeze({
  // The shape stays defined even while the bitmap exists, so a failed image
  // load still has a deterministic ink-cloud fallback.
  ink: visual('ink', { assetPath: `${OBJECT_ROOT}/ink-zone-overlay.png`, color: '#7159ad', shape: 'ink-cloud', label: '墨水區', overlay: true }),
});

export const PLAY_EDGE_VISUALS = Object.freeze({
  springJelly: visual('springJelly', { assetPath: `${EDGE_ROOT}/spring-jellyfish.png`, color: '#52aaff', shape: 'spring-jelly', label: '彈簧水母', edgeAttached: true, blocksPassage: true }),
  spike: visual('spike', { assetPath: `${EDGE_ROOT}/edge-spike-barrier.png`, color: '#ff5364', shape: 'spike-teeth', label: '尖刺邊界', edgeAttached: true, hazardous: true, blocksPassage: true }),
  // Barrier and current are deliberately programmatic. Reusing the red spike
  // bitmap would teach the wrong danger language and make both edges identical.
  barrier: visual('barrier', { color: '#ff9a4d', shape: 'double-barrier', label: '通用邊界', edgeAttached: true, blocksPassage: true }),
  current: visual('current', { color: '#52d9ff', shape: 'current-chevrons', label: '潮流', edgeAttached: true }),
  seaweed: visual('seaweed', { assetPath: `${OBJECT_ROOT}/sea-grass.png`, color: '#65e6ba', shape: 'anchored-seaweed', label: '水草', edgeAttached: true, anchoredPlant: true }),
  coralCluster: visual('coralCluster', { assetPath: `${OBJECT_ROOT}/coral-cluster.png`, color: '#f1a0ff', shape: 'anchored-coral', label: '珊瑚群落', edgeAttached: true, anchoredPlant: true }),
  layerPortal: visual('layerPortal', { assetPath: `${EDGE_ROOT}/layer-portal-stair.png`, color: '#52aaff', shape: 'layer-portal', label: '層間轉接門', edgeAttached: true }),
  multiPortal: visual('multiPortal', { assetPath: `${EDGE_ROOT}/multi-portal.png`, color: '#52aaff', shape: 'multi-portal', label: '多邊傳送門', edgeAttached: true }),
  wallGillGate: visual('wallGillGate', { assetPath: `${EDGE_ROOT}/wall-gill-gate.png`, color: '#70f0e4', shape: 'wall-gill-gate', label: '潛壁鰓門', edgeAttached: true }),
});

function requireVisual(collection, kind, category) {
  const entry = collection[kind];
  if (!entry) throw new RangeError(`Unknown ${category} visual: ${kind}`);
  return entry;
}

export function getPlayObjectVisual(kind) {
  return requireVisual(PLAY_OBJECT_VISUALS, kind, 'object');
}

export function getPlayOverlayVisual(kind) {
  return requireVisual(PLAY_OVERLAY_VISUALS, kind, 'overlay');
}

export function getPlayEdgeVisual(type) {
  return requireVisual(PLAY_EDGE_VISUALS, type, 'edge');
}

export function getPlayWorldVisual(category, id) {
  if (category === 'object') return getPlayObjectVisual(id);
  if (category === 'overlay') return getPlayOverlayVisual(id);
  if (category === 'edge') return getPlayEdgeVisual(id);
  throw new RangeError(`Unknown play world visual category: ${category}`);
}

export function getPlayWorldAssetPaths() {
  const visuals = [
    ...Object.values(PLAY_OBJECT_VISUALS),
    ...Object.values(PLAY_OVERLAY_VISUALS),
    ...Object.values(PLAY_EDGE_VISUALS),
  ];
  return [...new Set(visuals.flatMap(({ assetPath, componentAssetPaths }) => [assetPath, ...componentAssetPaths]).filter(Boolean))];
}

// Fail fast when a new map-model id is added without a formal-play visual.
if (Object.keys(PLAY_OBJECT_VISUALS).length !== CELL_OBJECT_TYPES.length
  || Object.keys(PLAY_OVERLAY_VISUALS).length !== OVERLAY_TYPES.length
  || Object.keys(PLAY_EDGE_VISUALS).length !== EDGE_TYPES.length - 1) {
  throw new Error('Formal-play world visual coverage is out of sync with map-model.js.');
}
