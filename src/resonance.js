const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const RESONANCE_RULES = Object.freeze({
  bodyGrazePadding: 34,
  projectileGrazePadding: 25,
  bodyGainPerSecond: 7,
  projectileGainPerSecond: 11,
  disengageGraceSeconds: 0.28,
  decayPerSecond: 18,
});

const buff = (enemyId, name, description, modifiers) => Object.freeze({ enemyId, name, description, modifiers: Object.freeze(modifiers) });

// Every authored creature has one explicit permanent contract. Values stack for
// the current run and deliberately survive the descent -> ascent transition.
export const RESONANCE_BUFFS = Object.freeze({
  explodingLanternfish: buff('explodingLanternfish', '冷光耐爆', '受到的所有傷害 -3%。', { damageTakenMultiplier: 0.97 }),
  juvenileSeahorseCaller: buff('juvenileSeahorseCaller', '幼潮肺囊', '最大氧氣 +8%。', { maxOxygenMultiplier: 1.08 }),
  crabGuard: buff('crabGuard', '甲殼靜養', '高氧高能時的生命恢復速度 +15%。', { healthRecoveryMultiplier: 1.15 }),
  lobsterSoldier: buff('lobsterSoldier', '鉗擊節律', '所有武器傷害 +6%。', { weaponDamageMultiplier: 1.06 }),
  lionfishGunner: buff('lionfishGunner', '棘砲校準', '武器傷害 +4%，武器能量消耗 -2%。', { weaponDamageMultiplier: 1.04, weaponEnergyCostMultiplier: 0.98 }),
  squidAssassin: buff('squidAssassin', '墨域呼吸', '氧氣倒數速度 -6%。', { oxygenDrainMultiplier: 0.94 }),
  splitLanternfish: buff('splitLanternfish', '裂殖餘光', '受到的傷害 -2%，生命恢復 +8%。', { damageTakenMultiplier: 0.98, healthRecoveryMultiplier: 1.08 }),
  coralBackSeahorse: buff('coralBackSeahorse', '珊瑚肺葉', '最大氧氣 +6%，氧氣倒數速度 -3%。', { maxOxygenMultiplier: 1.06, oxygenDrainMultiplier: 0.97 }),
  mantisShrimpBrute: buff('mantisShrimpBrute', '蝦蛄爆發', '彈射初速 +8%。', { launchSpeedMultiplier: 1.08 }),
  nautilusOracle: buff('nautilusOracle', '螺旋節能', '彈射能量消耗 -6%。', { launchEnergyCostMultiplier: 0.94 }),
  arcTideRay: buff('arcTideRay', '弧潮回生', '補充氧氣或能量時，額外恢復 4% 生命。', { resourceRecoveryHealthRatioBonus: 0.04 }),
  mutantMantisShrimp: buff('mutantMantisShrimp', '變異爆發', '彈射初速 +10%，武器傷害 +3%。', { launchSpeedMultiplier: 1.10, weaponDamageMultiplier: 1.03 }),
  mutantNautilusOracle: buff('mutantNautilusOracle', '變異螺旋', '彈射與武器能量消耗各 -5%。', { launchEnergyCostMultiplier: 0.95, weaponEnergyCostMultiplier: 0.95 }),
  mutantArcTideRay: buff('mutantArcTideRay', '變異弧潮', '生命恢復 +12%，補充資源時額外恢復 3% 生命。', { healthRecoveryMultiplier: 1.12, resourceRecoveryHealthRatioBonus: 0.03 }),
  prismCrabGuardian: buff('prismCrabGuardian', '稜鏡甲冑', '受到的傷害 -5%。', { damageTakenMultiplier: 0.95 }),
  tideLawNautilus: buff('tideLawNautilus', '潮律肺鐘', '最大氧氣 +10%，氧氣倒數速度 -5%。', { maxOxygenMultiplier: 1.10, oxygenDrainMultiplier: 0.95 }),
  mutantPrismCrabGuardian: buff('mutantPrismCrabGuardian', '變異稜鏡', '受到的傷害 -6%，生命恢復 +8%。', { damageTakenMultiplier: 0.94, healthRecoveryMultiplier: 1.08 }),
  mutantTideLawNautilus: buff('mutantTideLawNautilus', '變異潮律', '最大氧氣 +12%，武器能量消耗 -4%。', { maxOxygenMultiplier: 1.12, weaponEnergyCostMultiplier: 0.96 }),
  abyssalSpermWhale: buff('abyssalSpermWhale', '深淵共鳴', '武器傷害 +10%，受到的傷害 -4%。', { weaponDamageMultiplier: 1.10, damageTakenMultiplier: 0.96 }),
});

export function createResonanceState() {
  return {
    unlockedEnemyIds: new Set(),
    completedInstanceIds: new Set(),
  };
}

function tierRequirement(tier) {
  if (tier === 'finalBoss') return 180;
  if (tier === 'miniBoss' || tier === 'mutatedMiniBoss') return 150;
  return 100 + Math.max(0, Number(tier) || 1) * 10;
}

export function getResonanceRequirement(enemy) {
  return tierRequirement(enemy?.tier);
}

export function isResonanceCombatant(enemy) {
  return Boolean(enemy && !enemy.defeated && !enemy.resonanceNeutral && Number(enemy.health) > 0);
}

function near(actor, target, padding) {
  const radius = Math.max(0, Number(actor?.radius) || 0) + Math.max(0, Number(target?.radius) || 0) + padding;
  return Math.hypot(actor.x - target.x, actor.y - target.y) <= radius;
}

export function stepEnemyResonance({ enemies = [], projectiles = [], actor, state, dt = 0 } = {}) {
  if (!actor || !state) return [];
  const elapsed = Math.max(0, Number(dt) || 0);
  const projectileOwners = new Set(projectiles
    .filter((projectile) => near(actor, projectile, RESONANCE_RULES.projectileGrazePadding))
    .map((projectile) => projectile.ownerId)
    .filter(Boolean));
  const events = [];

  enemies.forEach((enemy) => {
    enemy.resonanceRequired ??= getResonanceRequirement(enemy);
    enemy.resonanceProgress ??= 0;
    enemy.resonanceGraceRemaining ??= 0;
    enemy.resonanceSource = null;
    if (!isResonanceCombatant(enemy)) return;

    const bodyGraze = near(actor, enemy, RESONANCE_RULES.bodyGrazePadding);
    const projectileGraze = projectileOwners.has(enemy.instanceId);
    if (bodyGraze || projectileGraze) {
      enemy.resonanceSource = projectileGraze ? 'projectile' : 'body';
      enemy.resonanceGraceRemaining = RESONANCE_RULES.disengageGraceSeconds;
      const rate = projectileGraze ? RESONANCE_RULES.projectileGainPerSecond : RESONANCE_RULES.bodyGainPerSecond;
      enemy.resonanceProgress = Math.min(enemy.resonanceRequired, enemy.resonanceProgress + rate * elapsed);
    } else if (enemy.resonanceGraceRemaining > 0) {
      enemy.resonanceGraceRemaining = Math.max(0, enemy.resonanceGraceRemaining - elapsed);
    } else {
      enemy.resonanceProgress = Math.max(0, enemy.resonanceProgress - RESONANCE_RULES.decayPerSecond * elapsed);
    }

    if (enemy.resonanceProgress < enemy.resonanceRequired) return;
    enemy.resonanceNeutral = true;
    enemy.state = 'resonantNeutral';
    enemy.alerted = false;
    enemy.pendingSkill = null;
    enemy.suicideCharge = null;
    enemy.linkedTarget = null;
    enemy.linkedTargets = [];
    enemy.vx = 0;
    enemy.vy = 0;
    const firstUnlock = !state.unlockedEnemyIds.has(enemy.enemyId);
    state.unlockedEnemyIds.add(enemy.enemyId);
    state.completedInstanceIds.add(enemy.instanceId);
    events.push({
      instanceId: enemy.instanceId,
      enemyId: enemy.enemyId,
      enemyName: enemy.name,
      x: enemy.x,
      y: enemy.y,
      firstUnlock,
      buff: RESONANCE_BUFFS[enemy.enemyId] ?? null,
    });
  });
  return events;
}

export function applyResonanceBuffsToStats(baseStats = {}, state) {
  const stats = { ...baseStats };
  let maxOxygenMultiplier = 1;
  let weaponDamageMultiplier = 1;
  let weaponEnergyCostMultiplier = 1;
  let launchEnergyCostMultiplier = 1;
  let oxygenDrainMultiplier = 1;
  let damageTakenMultiplier = 1;
  let healthRecoveryMultiplier = 1;
  let launchSpeedMultiplier = 1;
  let resourceRecoveryHealthRatioBonus = 0;
  (state?.unlockedEnemyIds ?? []).forEach((enemyId) => {
    const modifiers = RESONANCE_BUFFS[enemyId]?.modifiers ?? {};
    maxOxygenMultiplier *= modifiers.maxOxygenMultiplier ?? 1;
    weaponDamageMultiplier *= modifiers.weaponDamageMultiplier ?? 1;
    weaponEnergyCostMultiplier *= modifiers.weaponEnergyCostMultiplier ?? 1;
    launchEnergyCostMultiplier *= modifiers.launchEnergyCostMultiplier ?? 1;
    oxygenDrainMultiplier *= modifiers.oxygenDrainMultiplier ?? 1;
    damageTakenMultiplier *= modifiers.damageTakenMultiplier ?? 1;
    healthRecoveryMultiplier *= modifiers.healthRecoveryMultiplier ?? 1;
    launchSpeedMultiplier *= modifiers.launchSpeedMultiplier ?? 1;
    resourceRecoveryHealthRatioBonus += modifiers.resourceRecoveryHealthRatioBonus ?? 0;
  });
  stats.maxOxygen = (stats.maxOxygen ?? 100) * maxOxygenMultiplier;
  stats.currentDamageMultiplier = (stats.currentDamageMultiplier ?? 1) * weaponDamageMultiplier;
  stats.weaponEnergyCostMultiplier = (stats.weaponEnergyCostMultiplier ?? 1) * weaponEnergyCostMultiplier;
  stats.launchEnergyCostMultiplier = (stats.launchEnergyCostMultiplier ?? 1) * launchEnergyCostMultiplier;
  stats.oxygenDrainMultiplier = (stats.oxygenDrainMultiplier ?? 1) * oxygenDrainMultiplier;
  stats.resonanceDamageTakenMultiplier = damageTakenMultiplier;
  stats.healthRecoveryMultiplier = healthRecoveryMultiplier;
  stats.launchSpeedMultiplier = launchSpeedMultiplier;
  stats.resourceRecoveryHealthRatio = (stats.resourceRecoveryHealthRatio ?? 0) + resourceRecoveryHealthRatioBonus;
  return stats;
}

export function getResonanceRenderState(state) {
  const unlockedEnemyIds = [...(state?.unlockedEnemyIds ?? [])];
  return {
    unlockedEnemyIds,
    buffs: unlockedEnemyIds.map((enemyId) => RESONANCE_BUFFS[enemyId]).filter(Boolean).map(({ enemyId, name, description }) => ({ enemyId, name, description })),
    neutralizedCount: state?.completedInstanceIds?.size ?? 0,
  };
}
