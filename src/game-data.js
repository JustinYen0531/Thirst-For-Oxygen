// Central numerical contracts for the player build, weapons, and hostile roster.
// These are initial balance values: the structure is fixed, while numbers remain
// intentionally easy to tune once authored sprites and playtest data arrive.

export const RESOURCE_LIMITS = Object.freeze({
  health: 100,
  oxygen: 100,
  energy: 100,
  lives: 3,
});

export const RESOURCE_HEALTH_RECOVERY = Object.freeze({
  moderateThresholdRatio: 0.6,
  moderateHealthPerSecond: 2,
  fastThresholdRatio: 0.8,
  fastHealthPerSecond: 5,
});

export const ENEMY_DAMAGE_BALANCE = Object.freeze({
  playerDamageMultiplier: 0.4,
  // Projectile attacks need a second, stronger reduction on top of the
  // global enemy multiplier. The authored values are tuned for a much larger
  // arena and remained oppressive even after the first fifty-percent pass.
  projectileDamageMultiplier: 0.25,
  projectileSpeedMultiplier: 0.25,
});

export function getEnemyDamageToPlayer(amount, damageType = 'generic') {
  const projectileMultiplier = damageType === 'projectile'
    ? ENEMY_DAMAGE_BALANCE.projectileDamageMultiplier
    : 1;
  return Math.max(0, Number(amount) || 0)
    * ENEMY_DAMAGE_BALANCE.playerDamageMultiplier
    * projectileMultiplier;
}

export function getEnemyProjectileSpeed(speed) {
  return Math.max(0, Number(speed) || 0) * ENEMY_DAMAGE_BALANCE.projectileSpeedMultiplier;
}

export const PLAYER_BASE_STATS = Object.freeze({
  launchEnergyCostMultiplier: 1,
  weaponEnergyCostMultiplier: 1,
  aimEnergyCostMultiplier: 1,
  maxOxygenMultiplier: 1,
  oxygenDrainMultiplier: 1,
  lowOxygenEnergyCostMultiplier: 1,
  damageMultiplier: 1,
  rangedDamageTakenMultiplier: 1,
  lowOxygenDamageTakenMultiplier: 1,
  killEnergyRecoveryRatio: 0,
  killOxygenRecoveryRatio: 0,
  resourceRecoveryHealthRatio: 0,
  shieldThresholdRatio: 0,
  shieldDuration: 0,
  shieldCooldown: 0,
  highOxygenDamageMultiplier: 1,
});

export const PASSIVE_ABILITIES = Object.freeze({
  oxygenCirculator: {
    id: 'oxygenCirculator',
    name: '氧循環器',
    maxLevel: 3,
    levels: {
      1: { oxygenDrainMultiplier: 0.9 },
      2: { maxOxygenMultiplier: 1.2 },
      3: { lowOxygenEnergyCostMultiplier: 0.7, lowOxygenDamageTakenMultiplier: 0.85 },
    },
  },
  pressureStabilizer: {
    id: 'pressureStabilizer',
    name: '潮壓穩定器',
    maxLevel: 3,
    levels: {
      1: { aimEnergyCostMultiplier: 0.9, launchEnergyCostMultiplier: 0.9, weaponEnergyCostMultiplier: 0.9 },
      2: { aimEnergyCostMultiplier: 0.8, launchEnergyCostMultiplier: 0.8, weaponEnergyCostMultiplier: 0.8, killEnergyRecoveryRatio: 0.05 },
      3: { aimEnergyCostMultiplier: 0.7, launchEnergyCostMultiplier: 0.7, weaponEnergyCostMultiplier: 0.7, killEnergyRecoveryRatio: 0.08, killOxygenRecoveryRatio: 0.04 },
    },
  },
  ecologicalCarapace: {
    id: 'ecologicalCarapace',
    name: '生態甲殼',
    maxLevel: 3,
    levels: {
      1: { rangedDamageTakenMultiplier: 0.8 },
      2: { rangedDamageTakenMultiplier: 0.8, shieldThresholdRatio: 0.2, shieldDuration: 2, shieldCooldown: 8 },
      3: { rangedDamageTakenMultiplier: 0.8, shieldThresholdRatio: 0.2, shieldDuration: 2, shieldCooldown: 8, resourceRecoveryHealthRatio: 0.5 },
    },
  },
  abyssalAmplifier: {
    id: 'abyssalAmplifier',
    name: '深淵增幅器',
    maxLevel: 3,
    levels: {
      1: { damageMultiplier: 1.1 },
      2: { damageMultiplier: 1.2 },
      3: { damageMultiplier: 1.3, highOxygenDamageMultiplier: 1.15 },
    },
  },
});

export const WEAPONS = Object.freeze({
  knife: {
    id: 'knife', name: '小刀', type: 'melee', maxLevel: 3,
    levels: {
      1: {
        damage: 18,
        range: 42,
        cooldown: 0.45,
        energyCost: 4,
        hitArcDegrees: 70,
        effect: {
          style: 'knifeMeteor',
          duration: 0.68,
          sweepDuration: 0.22,
          trailLength: 0.78,
          lineWidth: 6,
          headRadius: 7,
          glowBlur: 5,
          sideGlowBlur: 3,
          sideTrailCount: 0,
          sparkleCount: 0,
          colour: '#8fe8ff',
          glowColour: '#b8f5ff',
          sparkleColour: '#d9fbff',
        },
      },
      2: {
        damage: 24,
        range: 46,
        cooldown: 0.4,
        energyCost: 4,
        hitArcDegrees: 78,
        effect: {
          style: 'knifeMeteor',
          duration: 1.05,
          sweepDuration: 0.26,
          trailLength: 0.95,
          lineWidth: 6,
          headRadius: 8,
          glowBlur: 6,
          sideGlowBlur: 3,
          sideTrailCount: 2,
          sideTrailOffset: 24,
          sideTrailWidth: 2.8,
          sideTrailDuration: 1.15,
          sideTrailDamageMultiplier: 0.7,
          sideTrailRadius: 20,
          pathAlpha: 0.3,
          sparkleCount: 0,
          colour: '#ffbd6e',
          glowColour: '#ffdfab',
          sparkleColour: '#fff0c2',
        },
      },
      3: {
        damage: 32,
        range: 50,
        cooldown: 0.34,
        energyCost: 4,
        hitArcDegrees: 86,
        effect: {
          style: 'knifeMeteor',
          duration: 4.2,
          sweepDuration: 0.28,
          trailLength: 1.05,
          lineWidth: 7.5,
          headRadius: 10,
          glowBlur: 7,
          sideGlowBlur: 3,
          sideTrailCount: 2,
          sideTrailOffset: 27,
          sideTrailWidth: 3.1,
          sideTrailDuration: 2.4,
          sideTrailDamageMultiplier: 0.7,
          sideTrailRadius: 22,
          pathAlpha: 0.34,
          lingerMinAlpha: 0.34,
          sparkleCount: 20,
          sparkleBudget: 6,
          colour: '#eaa7ff',
          glowColour: '#f3d7ff',
          sparkleColour: '#fff0ff',
          areaColour: '#d6b5ff',
          stationaryAreaRadius: 62,
          stationaryDamageMultiplier: 0.55,
          stationaryTickInterval: 0.34,
        },
      },
    },
  },
  katana: {
    id: 'katana', name: '武士刀', type: 'melee', maxLevel: 3,
    levels: {
      1: {
        damage: 28,
        range: 52,
        cooldown: 0.7,
        energyCost: 8,
        hitArcDegrees: 110,
        effect: {
          style: 'katanaClockwiseSwing',
          sprite: '/assets/editor/weapons/abyssal-katana.png',
          duration: 0.3,
          arcDegrees: 110,
          weaponLength: 36,
          weaponThickness: 5.6,
          gripPivot: 7,
          afterimageCount: 5,
          afterimageAngleStepDegrees: 11,
          afterimageAlpha: 0.34,
          colour: '#73d9ff',
          glowColour: '#9be8ff',
        },
      },
      2: {
        damage: 38,
        range: 54,
        cooldown: 0.64,
        energyCost: 8,
        hitArcDegrees: 116,
        effect: {
          style: 'katanaClockwiseSwing',
          sprite: '/assets/editor/weapons/abyssal-katana.png',
          duration: 0.3,
          arcDegrees: 116,
          weaponLength: 37,
          weaponThickness: 5.75,
          gripPivot: 7,
          afterimageCount: 6,
          afterimageAngleStepDegrees: 10,
          afterimageAlpha: 0.38,
          colour: '#f1b65a',
          glowColour: '#fff0ad',
          empoweredColour: '#ff5c8a',
          empoweredGlowColour: '#ff9eb8',
          empoweredDamageMultiplier: 2,
          empowerAfterMovement: true,
        },
      },
      3: {
        damage: 52,
        range: 56,
        cooldown: 0.58,
        energyCost: 8,
        hitArcDegrees: 122,
        effect: {
          style: 'katanaClockwiseSwing',
          sprite: '/assets/editor/weapons/abyssal-katana.png',
          duration: 0.3,
          arcDegrees: 122,
          weaponLength: 38,
          weaponThickness: 5.9,
          gripPivot: 7,
          afterimageCount: 7,
          afterimageAngleStepDegrees: 9,
          afterimageAlpha: 0.42,
          colour: '#c1a2ff',
          glowColour: '#e2d5ff',
          empoweredColour: '#ff5c8a',
          empoweredGlowColour: '#ff9eb8',
          empoweredDamageMultiplier: 2,
          empowerAfterMovement: true,
          wave: {
            style: 'katanaProjectileWave',
            duration: 0.42,
            startDistance: 22,
            travelDistance: 132,
            radius: 22,
            arcDegrees: 94,
            lineWidth: 4.5,
            thickness: 9,
            colour: '#f4fdff',
            glowColour: '#b8fbff',
          },
        },
      },
    },
  },
  trident: {
    id: 'trident', name: '三叉戟', type: 'projectile', maxLevel: 3,
    levels: {
      1: {
        damage: 20,
        projectileSpeed: 300,
        range: 360,
        cooldown: 0.7,
        energyCost: 6,
        projectileCount: 1,
        effect: {
          style: 'tridentProjectile',
          sprite: '/assets/editor/weapons/trident.png',
          spriteScale: 0.72,
          projectileRadius: 8,
          trailLength: 24,
          trailWidth: 2.4,
          colour: '#73e6ff',
          glowColour: '#d9fbff',
          impactStyle: 'tridentImpact',
          impactRadius: 20,
          impactDuration: 0.35,
          impactRingCount: 1,
          stationaryDelay: 1,
          stationarySpeedThreshold: 12,
        },
      },
      2: {
        damage: 27,
        projectileSpeed: 330,
        range: 390,
        cooldown: 0.62,
        energyCost: 6,
        projectileCount: 1,
        effect: {
          style: 'tridentProjectile',
          sprite: '/assets/editor/weapons/trident.png',
          spriteScale: 0.84,
          projectileRadius: 9,
          trailLength: 36,
          trailWidth: 3.2,
          colour: '#9ff3ff',
          glowColour: '#fff1a6',
          impactStyle: 'tridentStun',
          impactRadius: 28,
          impactDuration: 0.58,
          impactRingCount: 2,
          stunDuration: 1.35,
          stationaryDelay: 1,
          stationarySpeedThreshold: 12,
        },
      },
      3: {
        damage: 36,
        projectileSpeed: 360,
        range: 420,
        cooldown: 0.54,
        energyCost: 6,
        projectileCount: 1,
        effect: {
          style: 'tridentProjectile',
          sprite: '/assets/editor/weapons/trident.png',
          spriteScale: 0.98,
          projectileRadius: 10,
          trailLength: 50,
          trailWidth: 4.2,
          colour: '#d5fbff',
          glowColour: '#ffe6a0',
          impactStyle: 'tridentBurst',
          impactRadius: 38,
          impactDuration: 0.82,
          impactRingCount: 3,
          stunDuration: 2.4,
          cooldownReductionOnHit: 0.27,
          stationaryDelay: 1,
          stationarySpeedThreshold: 12,
        },
      },
    },
  },
  lightMachineGun: {
    id: 'lightMachineGun', name: '輕量機槍', type: 'projectile', maxLevel: 3,
    levels: {
      1: {
        damage: 8, projectileSpeed: 430, range: 420, cooldown: 0.72, energyCost: 2,
        burstCount: 6, burstInterval: 0.085,
        effect: {
          style: 'lightMachineGun', sprite: '/assets/editor/weapons/light-machine-gun.png', gunLength: 66, gunWidth: 14, gunColour: '#263b52', gunAccent: '#73e6ff',
          muzzleColour: '#d9fbff', bulletStyle: 'tracer', bulletLength: 18, bulletWidth: 5,
          bulletColour: '#8fe8ff', bulletOutline: '#d9fbff', bulletGlow: '#73e6ff',
        },
      },
      2: {
        damage: 11, projectileSpeed: 460, range: 450, cooldown: 0.72, energyCost: 2,
        burstCount: 6, burstInterval: 0.08,
        effect: {
          style: 'lightMachineGun', sprite: '/assets/editor/weapons/light-machine-gun.png', gunLength: 70, gunWidth: 15, gunColour: '#3d314b', gunAccent: '#ffbd6e',
          muzzleColour: '#fff0c2', bulletStyle: 'tracer', alternateBulletStyle: 'outlined', bulletLength: 20, bulletWidth: 6,
          bulletColour: '#ffd08a', bulletOutline: '#fff0c2', alternateBulletColour: '#ff8fd8', alternateBulletOutline: '#ffe2ff', bulletGlow: '#ffbd6e',
        },
      },
      3: {
        damage: 14, projectileSpeed: 490, range: 480, cooldown: 0.72, energyCost: 2,
        burstCount: 6, burstInterval: 0.075,
        effect: {
          style: 'lightMachineGun', sprite: '/assets/editor/weapons/light-machine-gun.png', gunLength: 74, gunWidth: 16, gunColour: '#392f5b', gunAccent: '#c1a2ff',
          muzzleColour: '#fff0ff', bulletStyle: 'prism', bulletLength: 22, bulletWidth: 7,
          bulletPalette: ['#8fe8ff', '#b8a1ff', '#ff8fd8', '#fff0a8', '#8dffc8', '#73d9ff'],
          bulletOutline: '#fff7ff', bulletGlow: '#d7c5ff',
        },
      },
    },
  },
});

const attack = (id, name, type, values) => Object.freeze({ id, name, type, damage: 0, cooldown: 0, ...values });

export const ENEMY_DEFINITIONS = Object.freeze({
  explodingLanternfish: {
    id: 'explodingLanternfish', name: '爆腹燈籠魚', tier: 1, role: 'suicideMelee', maxHealth: 70, moveSpeed: 82,
    attacks: [attack('contactExplosion', '定點自爆', 'suicideCharge', { damage: 28, radius: 52, detonationDelay: 1, telegraph: 1, cooldown: 0 })],
  },
  juvenileSeahorseCaller: {
    id: 'juvenileSeahorseCaller', name: '求援幼年海馬', tier: 1, role: 'support', maxHealth: 45, moveSpeed: 0,
    attacks: [attack('callForHelp', '求援呼叫', 'summon', { damage: 0, castTime: 6, cooldown: 12, summonRadius: 190, summonCount: 1 })],
  },
  crabGuard: {
    id: 'crabGuard', name: '螃蟹守衛', tier: 2, role: 'melee', maxHealth: 150, moveSpeed: 52,
    attacks: [attack('clawSwipe', '巨螯揮擊', 'melee', { damage: 16, range: 46, cooldown: 1.1 }), attack('dashClamp', '衝刺夾擊', 'dash', { damage: 28, range: 150, telegraph: 0.65, cooldown: 3.8 })],
  },
  lobsterSoldier: {
    id: 'lobsterSoldier', name: '龍蝦士兵', tier: 2, role: 'hybrid', maxHealth: 125, moveSpeed: 58,
    attacks: [attack('longClawStab', '長螯刺擊', 'melee', { damage: 18, range: 60, cooldown: 1.2 }), attack('spearThrow', '投擲長矛／珊瑚刺', 'projectile', { damage: 24, projectileSpeed: 260, range: 320, cooldown: 2.6 })],
  },
  lionfishGunner: {
    id: 'lionfishGunner', name: '獅子魚砲手', tier: 2, role: 'ranged', maxHealth: 95, moveSpeed: 28,
    attacks: [attack('venomStraightShot', '毒刺直射', 'projectile', { damage: 14, projectileSpeed: 380, range: 440, cooldown: 1.35, applies: 'venom', duration: 3 }), attack('spineScatter', '棘刺散射', 'spread', { damage: 10, projectileSpeed: 190, range: 270, projectileCount: 5, spreadDegrees: 42, cooldown: 3.4 })],
  },
  squidAssassin: {
    id: 'squidAssassin', name: '魷魚刺客', tier: 2, role: 'ambush', maxHealth: 115, moveSpeed: 74,
    attacks: [attack('inkShadowSlash', '墨影瞬移斬', 'teleportMelee', { damage: 26, range: 56, telegraph: 0.7, cooldown: 3.2, inkDuration: 2 }), attack('inkGunSnipe', '墨槍狙擊', 'projectile', { damage: 22, projectileSpeed: 520, range: 520, telegraph: 1, cooldown: 4.5 })],
  },
  splitLanternfish: {
    id: 'splitLanternfish', name: '裂殖燈籠魚', tier: 3, role: 'splitSuicide', maxHealth: 100, moveSpeed: 100,
    attacks: [attack('splitRush', '裂殖衝撞', 'contact', { damage: 24, radius: 48, telegraph: 0.3, cooldown: 0 }), attack('splitOnDeath', '死亡分裂', 'split', { damage: 0, childCount: 2, childHealth: 28, childSpeed: 122, childExplosionDamage: 16, childExplosionRadius: 34 })],
  },
  coralBackSeahorse: {
    id: 'coralBackSeahorse', name: '珊瑚背海馬', tier: 3, role: 'linkedSupport', maxHealth: 180, moveSpeed: 0,
    attacks: [attack('lifeLink', '生命連結', 'link', { damage: 0, linkRange: 180, healPerSecondRatio: 0.03, linkedInvulnerable: true }), attack('coralPulse', '珊瑚脈衝', 'supportPulse', { damage: 0, cooldown: 5, healRatio: 0.08, radius: 110 })],
  },
  mantisShrimpBrute: {
    id: 'mantisShrimpBrute', name: '蝦蛄戰將', tier: 3, role: 'meleeElite', maxHealth: 360, moveSpeed: 62,
    attacks: [attack('punch', '拳甲蓄力／拳擊', 'melee', { damage: 26, range: 54, telegraph: 0.45, cooldown: 1.05 }), attack('groundSmash', '震海重擊', 'areaStun', { damage: 32, radius: 96, stun: 1.2, telegraph: 0.8, cooldown: 4.8 }), attack('beaconAssault', '信標突襲', 'teleportMelee', { damage: 38, telegraph: 0.8, cooldown: 5.5 })],
  },
  nautilusOracle: {
    id: 'nautilusOracle', name: '鸚鵡螺祭司', tier: 3, role: 'rangedElite', maxHealth: 260, moveSpeed: 22,
    attacks: [attack('shortThrust', '前方短距離刺擊', 'melee', { damage: 14, range: 42, cooldown: 1.3 }), attack('coralMortar', '迫擊珊瑚彈', 'lobbed', { damage: 30, radius: 56, telegraph: 1.1, cooldown: 3.8 }), attack('dualCoreMagic', '雙核魔彈', 'projectile', { damage: 11, projectileCount: 2, projectileSpeed: 300, range: 380, cooldown: 2.4 })],
  },
  arcTideRay: {
    id: 'arcTideRay', name: '弧潮獵鰩', tier: 3, role: 'antiCoverArtillery', maxHealth: 300, moveSpeed: 34,
    attacks: [attack('wingRam', '翼刃撞擊', 'contact', { damage: 20, radius: 32, cooldown: 1.4 }), attack('arcTideBombardment', '弧潮投射', 'lobbed', { damage: 36, radius: 64, telegraph: 1.35, cooldown: 4.2, ignoresCover: true, locksTargetAtCast: true })],
  },
  mutantMantisShrimp: {
    id: 'mutantMantisShrimp', name: '變異蝦蛄戰將', tier: 4, role: 'mutantMeleeElite', maxHealth: 500, moveSpeed: 76,
    attacks: [attack('mutantPunch', '變異拳甲蓄力／拳擊', 'melee', { damage: 36, range: 60, telegraph: 0.35, cooldown: 0.8 }), attack('mutantGroundSmash', '震海重擊（強化）', 'areaStun', { damage: 44, radius: 124, stun: 1.6, telegraph: 0.65, cooldown: 3.6 }), attack('mutantBeaconAssault', '信標突襲（強化）', 'teleportMelee', { damage: 52, telegraph: 0.6, cooldown: 4.2 })],
  },
  mutantNautilusOracle: {
    id: 'mutantNautilusOracle', name: '變異鸚鵡螺祭司', tier: 4, role: 'stationaryRangedElite', maxHealth: 390, moveSpeed: 0,
    attacks: [attack('mutantCoralMortar', '迫擊珊瑚彈（強化）', 'lobbed', { damage: 42, radius: 70, telegraph: 0.95, cooldown: 2.8 }), attack('mutantDualCoreMagic', '雙核魔彈（強化）', 'projectile', { damage: 15, projectileCount: 2, projectileSpeed: 350, range: 430, cooldown: 1.6 }), attack('persistentCoreVolley', '持續雙核魔彈', 'projectile', { damage: 8, projectileCount: 1, projectileSpeed: 270, range: 360, cooldown: 0.9, persistent: true })],
  },
  mutantArcTideRay: {
    id: 'mutantArcTideRay', name: '變異弧潮獵鰩', tier: 4, role: 'mutantAntiCoverArtillery', maxHealth: 430, moveSpeed: 40,
    attacks: [attack('mutantWingRam', '翼刃撞擊（強化）', 'contact', { damage: 28, radius: 36, cooldown: 1.1 }), attack('mutantArcTideBombardment', '弧潮投射（強化）', 'lobbed', { damage: 40, radius: 70, telegraph: 1.15, cooldown: 3.4, ignoresCover: true, locksTargetAtCast: true, aftermathDamage: 18, aftermathDelay: 1.8, aftermathRadius: 48 })],
  },
  prismCrabGuardian: {
    id: 'prismCrabGuardian', name: '稜鏡巨蟹', tier: 'miniBoss', role: 'areaControl', maxHealth: 1200, moveSpeed: 38,
    passive: { id: 'deepSeaCarapace', name: '深海甲殼', damageTakenMultiplier: 0.75 },
    attacks: [attack('tidalGathering', '潮汐召集', 'summonResourceDrain', { damage: 12, cooldown: 7, summonCount: 3, energyDrain: 18, oxygenDrain: 12 }), attack('refractedLaser', '折射雷射', 'reflectedBeam', { damagePerSecond: 24, duration: 3, cooldown: 8, maxReflections: 4 }), attack('deepSeaGravityField', '深海重力場', 'gravityField', { damage: 20, radius: 150, duration: 2.5, cooldown: 7, stun: 0.8, gravityMultiplier: 2.5 })],
  },
  tideLawNautilus: {
    id: 'tideLawNautilus', name: '潮律鸚鵡螺', tier: 'miniBoss', role: 'patternControl', maxHealth: 1350, moveSpeed: 42,
    passive: { id: 'tidalShield', name: '潮汐護盾', invulnerableDuration: 7, damageMultiplier: 1.3, phaseCount: 5 },
    attacks: [attack('deepSeaSummoning', '深海召令', 'summon', { damage: 18, cooldown: 9, summonCount: 4 }), attack('returningBuckshot', '迴潮散彈', 'boomerangSpread', { damage: 16, projectileCount: 7, projectileSpeed: 260, cooldown: 6.5, returnDelay: 1.4 }), attack('tidalLaw', '潮汐法則', 'ruleChange', { damage: 0, cooldown: 10, duration: 4, gravityModes: ['reverse', 'low', 'horizontal', 'currentShift'] })],
  },
  mutantPrismCrabGuardian: {
    id: 'mutantPrismCrabGuardian', name: '變異稜鏡巨蟹', tier: 'mutatedMiniBoss', role: 'laserAftermathControl', maxHealth: 1700, moveSpeed: 42,
    passive: { id: 'mutantDeepSeaCarapace', name: '深海甲殼（強化）', rangedDamageTakenMultiplier: 0.5, projectileReflectChance: 0.5, reflectedDamageRatio: 0.25 },
    attacks: [attack('mutantTidalGathering', '潮汐召集（強化）', 'summonWave', { damage: 16, cooldown: 6, summonCount: 5, summonSpeedMultiplier: 1.35, cooldownReductionIfLv1Alive: 1.5 }), attack('mutantRefractedLaser', '折射雷射（強化）', 'reflectedBeamSplit', { damagePerSecond: 28, duration: 3.5, cooldown: 7, maxReflections: 4, secondaryBeamCount: 2, secondaryMaxReflections: 2 }), attack('mutantGravityField', '深海重力場（強化）', 'destroyableGravityOrb', { damage: 24, radius: 170, cooldown: 8, stun: 1, orbInvulnerableDuration: 3, orbHealth: 240, gravityMultiplier: 3 })],
  },
  mutantTideLawNautilus: {
    id: 'mutantTideLawNautilus', name: '變異潮律鸚鵡螺', tier: 'mutatedMiniBoss', role: 'shieldRuleControl', maxHealth: 1850, moveSpeed: 46,
    passive: { id: 'mutantTidalShield', name: '潮汐護盾（強化）', invulnerableDuration: 7, damageMultiplier: 1.3, damageToHealthRatio: 0.5, phaseCount: 5 },
    attacks: [attack('mutantDeepSeaSummoning', '深海召令（強化）', 'repeatSummon', { damage: 20, cooldown: 8, summonCount: 4, repeatWhenSummonsAlive: true, summonSpeedMultiplier: 1.3 }), attack('mutantReturningBuckshot', '迴潮散彈（強化）', 'shieldBoomerang', { damage: 18, projectileCount: 7, projectileSpeed: 285, cooldown: 6, returnDelay: 1.2, blocksPlayerProjectiles: true, shieldHealth: 260 }), attack('lawOverlap', '法則疊加', 'ruleCombination', { damage: 0, cooldown: 7, duration: 4.5, rerollInterval: 7, combinations: ['reverse+lowGravity', 'leftCurrent+highGravity', 'reverse+fastCurrent'] })],
  },
  abyssalSpermWhale: {
    id: 'abyssalSpermWhale', name: '深淵抹香鯨', tier: 'finalBoss', role: 'battlefieldController', maxHealth: 5000, moveSpeed: 46,
    passive: { id: 'abyssAwakening', name: '深淵覺醒', moveSpeedMultiplier: 1.2, projectileSpeedMultiplier: 1.2, cooldownMultiplier: 0.8, thornsDamage: 18 },
    attacks: [attack('abyssalSummoning', '深海召令', 'sacrificeSummon', { damage: 24, cooldown: 12, summonCount: 6, healRatioPerSacrifice: 0.025, damageStackPerSacrifice: 0.03 }), attack('ancientReconstruction', '遺跡重現', 'rebuildArena', { damage: 0, cooldown: 18, duration: 8, healPerSecondRatio: 0.02 }), attack('abyssEcho', '深淵化身', 'cloneBarrage', { damage: 18, projectileCount: 3, projectileSpeed: 170, cooldown: 8, cloneHealthRatio: 0.18 }), attack('miniatureForm', '深淵幼體', 'speedForm', { damageTakenMultiplier: 1.2, moveSpeedMultiplier: 1.7, cooldownMultiplier: 0.5, duration: 7, sludgeDuration: 8 }), attack('gravityDominion', '重力支配', 'gravityRule', { damage: 16, cooldown: 14, duration: 5, gravityLevelShift: 1 }), attack('corruptedOxygen', '氧氣侵蝕', 'corruptOxygen', { damage: 26, cooldown: 11, bubbleLifetime: 4, explosionRadius: 96, oxygenDrain: 35, oxygenZoneDuration: 10 })],
  },
});

// Experience is awarded from the enemy's authored difficulty tier. Keep this
// table beside the combat definitions so balance changes do not leak into UI
// code; an individual enemy may override it with `experienceReward` later.
export const EXPERIENCE_REWARDS_BY_TIER = Object.freeze({
  1: 14,
  2: 24,
  3: 38,
  4: 58,
  miniBoss: 150,
  mutatedMiniBoss: 220,
  finalBoss: 600,
});

export const ENEMY_ORDER = Object.freeze(Object.keys(ENEMY_DEFINITIONS));

export function getEnemyExperienceReward(enemyId) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  if (!definition) return 0;
  return definition.experienceReward ?? EXPERIENCE_REWARDS_BY_TIER[definition.tier] ?? 0;
}

export function getPassiveModifiers(loadout = []) {
  const modifiers = { ...PLAYER_BASE_STATS };
  loadout.forEach(({ id, level = 1 }) => {
    const ability = PASSIVE_ABILITIES[id];
    if (!ability) return;
    const cumulative = {};
    for (let currentLevel = 1; currentLevel <= Math.min(level, ability.maxLevel); currentLevel += 1) {
      Object.assign(cumulative, ability.levels[currentLevel]);
    }
    Object.entries(cumulative).forEach(([key, value]) => {
      if (key.includes('Multiplier')) modifiers[key] *= value;
      else modifiers[key] = Math.max(modifiers[key], value);
    });
  });
  return modifiers;
}

export function getWeaponStats(weaponId = 'knife', level = 1) {
  const weapon = WEAPONS[weaponId] ?? WEAPONS.knife;
  return { ...weapon.levels[Math.min(Math.max(level, 1), weapon.maxLevel)] };
}

export function getWeaponUseCost(weaponId = 'knife', level = 1, loadout = []) {
  const stats = getWeaponStats(weaponId, level);
  const modifiers = getPassiveModifiers(loadout);
  return stats.energyCost * modifiers.weaponEnergyCostMultiplier;
}

export function getPlayerDerivedStats(loadout = [], oxygen = RESOURCE_LIMITS.oxygen) {
  const modifiers = getPassiveModifiers(loadout);
  const maxOxygen = RESOURCE_LIMITS.oxygen * modifiers.maxOxygenMultiplier;
  const lowOxygen = oxygen < maxOxygen * 0.5;
  const conditionalEnergyMultiplier = lowOxygen ? modifiers.lowOxygenEnergyCostMultiplier : 1;
  return {
    ...modifiers,
    maxOxygen,
    launchEnergyCostMultiplier: modifiers.launchEnergyCostMultiplier * conditionalEnergyMultiplier,
    weaponEnergyCostMultiplier: modifiers.weaponEnergyCostMultiplier * conditionalEnergyMultiplier,
    currentDamageMultiplier: modifiers.damageMultiplier * (oxygen > maxOxygen * 0.5 ? modifiers.highOxygenDamageMultiplier : 1),
  };
}

export function calculateWeaponDamage(weaponId, level, { oxygen = RESOURCE_LIMITS.oxygen, loadout = [] } = {}) {
  const stats = getWeaponStats(weaponId, level);
  return stats.damage * getPlayerDerivedStats(loadout, oxygen).currentDamageMultiplier;
}

export function createEnemyState(enemyId) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  if (!definition) throw new Error(`Unknown enemy definition: ${enemyId}`);
  return {
    id: definition.id,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    cooldowns: {},
    activeEffects: {},
  };
}
