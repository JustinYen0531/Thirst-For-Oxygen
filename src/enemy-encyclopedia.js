import { ENEMY_DEFINITIONS, ENEMY_ORDER } from './game-data.js';

const gif = (slug) => `reconstructed-preview__${slug}.gif`;
const root = (id) => `/assets/enemies/${id}`;
const afterimageRoot = (id) => `/assets/enemies-afterimage/${id}`;
const toAfterimagePath = (id, file) => `${afterimageRoot(id)}/${file.replace(/\.gif$/i, '.webp')}`;

// The asset folders use the authored enemy ids after being copied into public/.
// Keeping this mapping separate from numerical combat data lets animation work
// continue without changing balance contracts.
const VISUALS = {
  explodingLanternfish: { idle: gif('base-float-move'), actions: { contactExplosion: gif('self-destruct-chase') } },
  juvenileSeahorseCaller: { idle: gif('base-float-move'), actions: { callForHelp: gif('rescue-call') } },
  crabGuard: { idle: gif('base-float-move'), actions: { clawSwipe: gif('attack-claw-swing'), dashClamp: gif('attack-dash-clamp') } },
  lobsterSoldier: { idle: gif('base-float-move'), actions: { longClawStab: gif('attack-claw-thrust'), spearThrow: gif('attack-spear-throw') } },
  lionfishGunner: { idle: gif('base-float-move'), actions: { venomStraightShot: gif('skill-poison-spike-shot'), spineScatter: gif('skill-spine-scatter-shot') } },
  squidAssassin: { idle: gif('base-float-move'), actions: { inkShadowSlash: gif('attack-teleport-slash'), inkGunSnipe: gif('attack-ink-sniper') } },
  splitLanternfish: { idle: gif('base-float-move'), actions: { splitRush: gif('attack-split-chase'), splitOnDeath: gif('skill-split-burst') } },
  coralBackSeahorse: { idle: gif('base-float-move'), actions: { lifeLink: gif('skill-life-link'), coralPulse: gif('skill-invulnerability') } },
  mantisShrimpBrute: { idle: gif('base-float-move'), actions: { punch: gif('attack-punch'), groundSmash: gif('skill-ground-smash'), beaconAssault: gif('skill-beacon-assault') } },
  nautilusOracle: { idle: gif('base-float-move'), actions: { shortThrust: gif('attack-relic-cast'), coralMortar: gif('skill-coral-bombardment'), dualCoreMagic: gif('skill-twin-core-shot') } },
  arcTideRay: { idle: gif('base-float-move'), actions: { wingRam: gif('attack-fin-blade'), arcTideBombardment: gif('attack-arc-tide-bombardment') } },
  mutantMantisShrimp: { idle: gif('base-float-move'), actions: { mutantPunch: gif('attack-tracking-punch'), mutantGroundSmash: gif('skill-pressure-arena'), mutantBeaconAssault: gif('skill-beacon-afterimage') } },
  mutantNautilusOracle: { idle: gif('base-float-move'), actions: { mutantCoralMortar: gif('attack-overloaded-relic'), mutantDualCoreMagic: gif('skill-360-core-scatter'), persistentCoreVolley: gif('skill-everlasting-core') } },
  mutantArcTideRay: { idle: gif('base-float-move'), actions: { mutantWingRam: gif('attack-pressure-blade-aftershock'), mutantArcTideBombardment: gif('skill-secondary-pressure-burst') } },
};

const TIER_LABELS = Object.freeze({
  1: '等級 1',
  2: '等級 2',
  3: '等級 3',
  4: '等級 4',
  miniBoss: '小 Boss',
  mutatedMiniBoss: '變異小 Boss',
  finalBoss: 'Final Boss',
});

export const ENEMY_ENCYCLOPEDIA = Object.freeze(ENEMY_ORDER.map((id) => {
  const definition = ENEMY_DEFINITIONS[id];
  const visuals = VISUALS[id];
  return Object.freeze({
    ...definition,
    tierLabel: TIER_LABELS[definition.tier] ?? String(definition.tier),
    visuals: visuals ? Object.freeze({
      idle: `${root(id)}/${visuals.idle}`,
      actions: Object.freeze(Object.fromEntries(Object.entries(visuals.actions).map(([attackId, file]) => [attackId, `${root(id)}/${file}`]))),
      afterimageIdle: toAfterimagePath(id, visuals.idle),
      afterimageActions: Object.freeze(Object.fromEntries(Object.entries(visuals.actions).map(([attackId, file]) => [attackId, toAfterimagePath(id, file)]))),
    }) : null,
  });
}));

export const ATTACK_VALUE_LABELS = Object.freeze({
  damage: '傷害',
  damagePerSecond: '每秒傷害',
  cooldown: '冷卻',
  range: '距離',
  radius: '半徑',
  telegraph: '前搖',
  castTime: '施法時間',
  duration: '持續時間',
  projectileCount: '投射物數量',
  projectileSpeed: '投射速度',
  summonCount: '召喚數量',
  moveSpeed: '移動速度',
});

export function formatAttackValue(key, value) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join('／');
  if (typeof value === 'number') return `${value}${['cooldown', 'telegraph', 'castTime', 'duration'].includes(key) ? ' 秒' : ''}`;
  return String(value);
}
