const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const thirdStackMultiplier = (fullStackMultiplier) => Math.cbrt(fullStackMultiplier);

export const RESONANCE_RULES = Object.freeze({
  bodyGrazePadding: 34,
  projectileGrazePadding: 25,
  meleeBodyGainPerSecond: 11,
  rangedBodyGainPerSecond: 8,
  rangedProjectileGainPerSecond: 12,
  disengageGraceSeconds: 0.28,
  decayPerSecond: 18,
  damageProgressLossPerHit: 8,
});

const buff = (enemyId, name, description, combatStyle, maxStacks, modifiers) => Object.freeze({
  enemyId, name, description, combatStyle, maxStacks, modifiers: Object.freeze(modifiers),
});

// Every authored creature has one explicit permanent contract. Values stack for
// the current run and deliberately survive the descent -> ascent transition.
export const RESONANCE_BUFFS = Object.freeze({
  explodingLanternfish: buff('explodingLanternfish', '冷光耐爆', '每層受到的所有傷害 -1%。', 'melee', 9, { damageReductionBonus: 0.01 }),
  juvenileSeahorseCaller: buff('juvenileSeahorseCaller', '幼潮肺囊', '每層最大氧氣約 +2.60%。', 'ranged', 6, { maxOxygenMultiplier: thirdStackMultiplier(1.08) }),
  crabGuard: buff('crabGuard', '甲殼靜養', '每層高氧高能時的生命恢復速度約 +4.77%。', 'melee', 9, { healthRecoveryMultiplier: thirdStackMultiplier(1.15) }),
  lobsterSoldier: buff('lobsterSoldier', '鉗擊節律', '每層所有武器傷害約 +1.96%。', 'ranged', 9, { weaponDamageMultiplier: thirdStackMultiplier(1.06) }),
  lionfishGunner: buff('lionfishGunner', '棘砲校準', '每層武器傷害約 +1.32%，武器能量消耗約 -0.67%。', 'ranged', 6, { weaponDamageMultiplier: thirdStackMultiplier(1.04), weaponEnergyCostMultiplier: thirdStackMultiplier(0.98) }),
  squidAssassin: buff('squidAssassin', '墨域呼吸', '每層氧氣倒數速度約 -2.04%。', 'ranged', 6, { oxygenDrainMultiplier: thirdStackMultiplier(0.94) }),
  splitLanternfish: buff('splitLanternfish', '裂殖餘光', '每層受到的傷害約 -0.67%，生命恢復約 +2.60%。', 'melee', 9, { damageReductionBonus: 0.02 / 3, healthRecoveryMultiplier: thirdStackMultiplier(1.08) }),
  coralBackSeahorse: buff('coralBackSeahorse', '珊瑚肺葉', '每層最大氧氣約 +1.96%，氧氣倒數速度約 -1.01%。', 'ranged', 6, { maxOxygenMultiplier: thirdStackMultiplier(1.06), oxygenDrainMultiplier: thirdStackMultiplier(0.97) }),
  mantisShrimpBrute: buff('mantisShrimpBrute', '蝦蛄爆發', '每層彈射初速約 +2.60%。', 'melee', 6, { launchSpeedMultiplier: thirdStackMultiplier(1.08) }),
  nautilusOracle: buff('nautilusOracle', '螺旋節能', '每層彈射能量消耗約 -2.04%。', 'ranged', 6, { launchEnergyCostMultiplier: thirdStackMultiplier(0.94) }),
  arcTideRay: buff('arcTideRay', '弧潮回生', '每層在補充氧氣或能量時，額外恢復約 1.33% 生命。', 'ranged', 6, { resourceRecoveryHealthRatioBonus: 0.04 / 3 }),
  mutantMantisShrimp: buff('mutantMantisShrimp', '變異爆發', '每層彈射初速約 +3.23%，武器傷害約 +0.99%。', 'melee', 3, { launchSpeedMultiplier: thirdStackMultiplier(1.10), weaponDamageMultiplier: thirdStackMultiplier(1.03) }),
  mutantNautilusOracle: buff('mutantNautilusOracle', '變異螺旋', '每層彈射與武器能量消耗各約 -1.70%。', 'ranged', 3, { launchEnergyCostMultiplier: thirdStackMultiplier(0.95), weaponEnergyCostMultiplier: thirdStackMultiplier(0.95) }),
  mutantArcTideRay: buff('mutantArcTideRay', '變異弧潮', '每層生命恢復約 +3.85%，補充資源時額外恢復 1% 生命。', 'ranged', 3, { healthRecoveryMultiplier: thirdStackMultiplier(1.12), resourceRecoveryHealthRatioBonus: 0.01 }),
  prismCrabGuardian: buff('prismCrabGuardian', '稜鏡甲冑', '每層受到的傷害約 -1.67%。', 'ranged', 3, { damageReductionBonus: 0.05 / 3 }),
  tideLawNautilus: buff('tideLawNautilus', '潮律肺鐘', '每層最大氧氣約 +3.23%，氧氣倒數速度約 -1.70%。', 'ranged', 3, { maxOxygenMultiplier: thirdStackMultiplier(1.10), oxygenDrainMultiplier: thirdStackMultiplier(0.95) }),
  mutantPrismCrabGuardian: buff('mutantPrismCrabGuardian', '變異稜鏡', '每層受到的傷害 -2%，生命恢復約 +2.60%。', 'ranged', 3, { damageReductionBonus: 0.02, healthRecoveryMultiplier: thirdStackMultiplier(1.08) }),
  mutantTideLawNautilus: buff('mutantTideLawNautilus', '變異潮律', '每層最大氧氣約 +3.85%，武器能量消耗約 -1.35%。', 'ranged', 3, { maxOxygenMultiplier: thirdStackMultiplier(1.12), weaponEnergyCostMultiplier: thirdStackMultiplier(0.96) }),
  abyssalSpermWhale: buff('abyssalSpermWhale', '深淵共鳴', '每層武器傷害約 +3.23%，受到的傷害約 -1.33%。', 'ranged', 3, { weaponDamageMultiplier: thirdStackMultiplier(1.10), damageReductionBonus: 0.04 / 3 }),
});

export function createResonanceState() {
  return {
    unlockedEnemyIds: new Set(),
    stacksByEnemyId: new Map(),
    completedInstanceIds: new Set(),
  };
}

function tierNumber(tier) {
  if (tier === 'finalBoss') return 5;
  if (tier === 'miniBoss' || tier === 'mutatedMiniBoss') return 4;
  return Math.max(1, Number(tier) || 1);
}

export function getResonanceRequirement(enemy) {
  const style = RESONANCE_BUFFS[enemy?.enemyId]?.combatStyle ?? 'ranged';
  const tier = tierNumber(enemy?.tier);
  if (style === 'melee') return [0, 40, 45, 55, 65, 75][tier] ?? 75;
  return [0, 90, 100, 115, 145, 170][tier] ?? 170;
}

export function isResonanceCombatant(enemy) {
  return Boolean(enemy && !enemy.tutorialResonanceDisabled && !enemy.defeated && !enemy.resonanceNeutral && Number(enemy.health) > 0);
}

export function reduceEnemyResonanceOnDamage(enemy) {
  if (!enemy || enemy.resonanceNeutral) return 0;
  const before = Math.max(0, Number(enemy.resonanceProgress) || 0);
  const loss = Math.min(before, RESONANCE_RULES.damageProgressLossPerHit);
  enemy.resonanceProgress = before - loss;
  if (loss > 0) enemy.resonanceSource = 'damage';
  return loss;
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
      const style = RESONANCE_BUFFS[enemy.enemyId]?.combatStyle ?? 'ranged';
      const rate = projectileGraze
        ? RESONANCE_RULES.rangedProjectileGainPerSecond
        : style === 'melee' ? RESONANCE_RULES.meleeBodyGainPerSecond : RESONANCE_RULES.rangedBodyGainPerSecond;
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
    const definition = RESONANCE_BUFFS[enemy.enemyId] ?? null;
    const previousStacks = state.stacksByEnemyId.get(enemy.enemyId) ?? 0;
    const nextStacks = Math.min(definition?.maxStacks ?? 1, previousStacks + 1);
    const stackGained = nextStacks > previousStacks;
    const firstUnlock = previousStacks === 0 && stackGained;
    if (stackGained) state.stacksByEnemyId.set(enemy.enemyId, nextStacks);
    state.unlockedEnemyIds.add(enemy.enemyId);
    state.completedInstanceIds.add(enemy.instanceId);
    events.push({
      instanceId: enemy.instanceId,
      enemyId: enemy.enemyId,
      enemyName: enemy.name,
      x: enemy.x,
      y: enemy.y,
      firstUnlock,
      stackGained,
      stackCount: nextStacks,
      maxStacks: definition?.maxStacks ?? 1,
      buff: definition,
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
  let damageReductionBonus = 0;
  let healthRecoveryMultiplier = 1;
  let launchSpeedMultiplier = 1;
  let resourceRecoveryHealthRatioBonus = 0;
  const stackEntries = state?.stacksByEnemyId?.size
    ? [...state.stacksByEnemyId.entries()]
    : [...(state?.unlockedEnemyIds ?? [])].map((enemyId) => [enemyId, 1]);
  stackEntries.forEach(([enemyId, rawStacks]) => {
    const modifiers = RESONANCE_BUFFS[enemyId]?.modifiers ?? {};
    const stacks = Math.min(RESONANCE_BUFFS[enemyId]?.maxStacks ?? 1, Math.max(0, Number(rawStacks) || 0));
    maxOxygenMultiplier *= (modifiers.maxOxygenMultiplier ?? 1) ** stacks;
    weaponDamageMultiplier *= (modifiers.weaponDamageMultiplier ?? 1) ** stacks;
    weaponEnergyCostMultiplier *= (modifiers.weaponEnergyCostMultiplier ?? 1) ** stacks;
    launchEnergyCostMultiplier *= (modifiers.launchEnergyCostMultiplier ?? 1) ** stacks;
    oxygenDrainMultiplier *= (modifiers.oxygenDrainMultiplier ?? 1) ** stacks;
    damageReductionBonus += (modifiers.damageReductionBonus ?? 0) * stacks;
    healthRecoveryMultiplier *= (modifiers.healthRecoveryMultiplier ?? 1) ** stacks;
    launchSpeedMultiplier *= (modifiers.launchSpeedMultiplier ?? 1) ** stacks;
    resourceRecoveryHealthRatioBonus += (modifiers.resourceRecoveryHealthRatioBonus ?? 0) * stacks;
  });
  stats.maxOxygen = (stats.maxOxygen ?? 100) * maxOxygenMultiplier;
  stats.currentDamageMultiplier = (stats.currentDamageMultiplier ?? 1) * weaponDamageMultiplier;
  stats.weaponEnergyCostMultiplier = (stats.weaponEnergyCostMultiplier ?? 1) * weaponEnergyCostMultiplier;
  stats.launchEnergyCostMultiplier = (stats.launchEnergyCostMultiplier ?? 1) * launchEnergyCostMultiplier;
  stats.oxygenDrainMultiplier = (stats.oxygenDrainMultiplier ?? 1) * oxygenDrainMultiplier;
  stats.resonanceDamageTakenMultiplier = Math.max(0.5, 1 - damageReductionBonus);
  stats.healthRecoveryMultiplier = healthRecoveryMultiplier;
  stats.launchSpeedMultiplier = launchSpeedMultiplier;
  stats.resourceRecoveryHealthRatio = (stats.resourceRecoveryHealthRatio ?? 0) + resourceRecoveryHealthRatioBonus;
  return stats;
}

export function getResonanceRenderState(state) {
  const stackEntries = state?.stacksByEnemyId?.size
    ? [...state.stacksByEnemyId.entries()]
    : [...(state?.unlockedEnemyIds ?? [])].map((enemyId) => [enemyId, 1]);
  const unlockedEnemyIds = stackEntries.map(([enemyId]) => enemyId);
  return {
    unlockedEnemyIds,
    totalStacks: stackEntries.reduce((total, [enemyId, stacks]) => total + Math.min(RESONANCE_BUFFS[enemyId]?.maxStacks ?? 1, stacks), 0),
    buffs: stackEntries.map(([enemyId, stacks]) => {
      const definition = RESONANCE_BUFFS[enemyId];
      const cappedStacks = Math.min(definition?.maxStacks ?? 1, stacks);
      return definition ? {
        enemyId, name: definition.name, description: definition.description,
        combatStyle: definition.combatStyle, stacks: cappedStacks, maxStacks: definition.maxStacks,
        atCap: cappedStacks >= definition.maxStacks,
      } : null;
    }).filter(Boolean),
    neutralizedCount: state?.completedInstanceIds?.size ?? 0,
  };
}
