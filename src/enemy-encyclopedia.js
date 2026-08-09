import {
  ENEMY_DEFINITIONS,
  ENEMY_ORDER,
  PASSIVE_ABILITIES,
  WEAPONS,
} from './game-data.js';
import {
  CELL_OBJECT_TYPES,
  EDGE_TYPES,
  OVERLAY_TYPES,
  TERRAIN_TYPES,
  WATER_LAYERS,
} from './map-model.js';

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
  mutantNautilusOracle: { idle: gif('base-float-move-v3'), actions: { mutantCoralMortar: gif('attack-overloaded-relic-bodycast-v5'), mutantDualCoreMagic: gif('skill-360-core-scatter-bodycast-v5'), persistentCoreVolley: gif('skill-everlasting-core-bodycast-v5') } },
  mutantArcTideRay: { idle: gif('base-float-move-v3'), actions: { mutantWingRam: gif('attack-pressure-blade-aftershock-bodycast-v5'), mutantArcTideBombardment: gif('skill-secondary-pressure-burst-bodycast-v5') } },
  prismCrabGuardian: {
    idle: gif('base-float-move'),
    actions: {
      tidalGathering: gif('skill-tidal-gathering'),
      refractedLaser: gif('skill-refracted-laser'),
      deepSeaGravityField: gif('skill-deep-sea-gravity-field'),
    },
  },
  tideLawNautilus: {
    idle: gif('base-float-move'),
    actions: {
      deepSeaSummoning: gif('skill-deep-sea-summoning'),
      returningBuckshot: gif('skill-returning-buckshot'),
      tidalLaw: gif('skill-tidal-law'),
    },
  },
  mutantPrismCrabGuardian: {
    idle: gif('base-float-move'),
    actions: {
      mutantTidalGathering: gif('skill-mutant-tidal-gathering'),
      mutantRefractedLaser: gif('skill-mutant-refracted-laser'),
      mutantGravityField: gif('skill-mutant-gravity-field'),
    },
  },
  mutantTideLawNautilus: {
    idle: gif('base-float-move'),
    actions: {
      mutantDeepSeaSummoning: gif('skill-mutant-deep-sea-summoning'),
      mutantReturningBuckshot: gif('skill-mutant-returning-buckshot'),
      lawOverlap: gif('skill-law-overlap'),
    },
  },
  abyssalSpermWhale: {
    idle: gif('base-float-move'),
    actions: {
      abyssalSummoning: gif('skill-abyssal-summoning'),
      ancientReconstruction: gif('skill-ancient-reconstruction'),
      abyssEcho: gif('skill-abyss-echo'),
      miniatureForm: gif('skill-miniature-form'),
      gravityDominion: gif('skill-gravity-dominion'),
      corruptedOxygen: gif('skill-corrupted-oxygen'),
    },
  },
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

const ENEMY_DESCRIPTIONS = Object.freeze({
  explodingLanternfish: '腹部蓄著不穩定生物電的燈籠魚，會用微光吸引目標，再把自己變成一枚深海炸彈。',
  juvenileSeahorseCaller: '仍在成長期的求援海馬，幾乎不主動追擊，會躲在水流裡呼叫同伴加入戰場。',
  crabGuard: '以厚重甲殼守住狹窄水道的近戰蟹，擅長用巨螯封鎖玩家的短距離路線。',
  lobsterSoldier: '受過潮穴軍事訓練的龍蝦士兵，能在長螯近戰與珊瑚刺投擲之間快速切換。',
  lionfishGunner: '把毒棘當成彈藥的獅子魚砲手，會在遠處標記目標，再用散射棘刺逼玩家離開掩護。',
  squidAssassin: '利用墨幕隱藏身形的魷魚刺客，等待玩家露出破綻後瞬移斬擊，並以墨槍完成遠距離處決。',
  splitLanternfish: '比爆腹燈籠魚更不穩定的裂殖個體，死亡不是終點，而是把危險分裂成兩個追擊者。',
  coralBackSeahorse: '背著活珊瑚群落的支援海馬，會把生命力分享給同伴，讓玩家必須先切斷牠的支援網。',
  mantisShrimpBrute: '用拳甲製造震波的蝦蛄戰將，近身時壓力極大，還能透過信標把戰場變成突襲點。',
  nautilusOracle: '守護古代珊瑚遺物的鸚鵡螺祭司，使用雙核魔彈與迫擊珊瑚彈控制安全距離。',
  arcTideRay: '能讀取潮汐弧線的獵鰩，會避開正面掩護，把投射物落點放在玩家以為安全的位置。',
  mutantMantisShrimp: '被深海壓力改造的蝦蛄戰將，拳甲與信標都變得更快，攻擊會把玩家逼進壓力場。',
  mutantNautilusOracle: '過載的鸚鵡螺祭司，將遺物核心拆成持續運轉的彈幕，幾乎不給玩家喘息時間。',
  mutantArcTideRay: '變異弧潮獵鰩，翼刃與潮壓投射會在命中後留下二次爆發，必須讀懂牠的落點節奏。',
  prismCrabGuardian: '稜鏡巨蟹以深海甲殼守護區域核心，能召集敵群、折射雷射，並用重力場改寫玩家的移動節奏。',
  tideLawNautilus: '潮律鸚鵡螺會把戰場當成一套可改寫的法則，牠的護盾階段與潮汐規則會反覆改變戰鬥條件。',
  mutantPrismCrabGuardian: '變異稜鏡巨蟹能分裂雷射並反射遠程攻擊，重力球成為必須優先處理的場地威脅。',
  mutantTideLawNautilus: '變異潮律鸚鵡螺會把多條潮汐法則疊在一起，護盾與迴潮散彈讓錯誤走位快速累積。',
  abyssalSpermWhale: '深淵抹香鯨是整片海域的戰場控制者，會召喚、重建、改變重力與侵蝕氧氣，迫使玩家管理每一寸空間。',
});

// Lore is sourced from GDD/05_內容/敵人/敵人圖鑑.md. It stays separate from
// combat data so the encyclopedia can explain visual identity without changing balance contracts.
const ENEMY_LORE = Object.freeze({
  explodingLanternfish: {
    scientificReference: '燈籠魚科（Myctophidae）的幼體；參考其小型身體與腹部發光器官。',
    identification: '圓鼓腹囊、小型發光器官、短小魚體、前衝姿態。',
    visualSetting: '小型石質燈籠魚，腹部像不穩定的壓力囊，青藍裂紋集中在腹部與頭部；避免做成人形炸彈或穿戴裝備的角色。',
  },
  juvenileSeahorseCaller: {
    scientificReference: '幼年海馬屬（Hippocampus）；參考海馬的直立身形、捲曲尾巴與管狀吻部。',
    identification: '頭部比例偏大、短小身體、捲曲尾巴、頭頂音波器官。',
    visualSetting: '膽怯而可愛的幼年石質海馬，身體小、尾巴短，青藍裂紋集中在喉部與頭頂；音波圈是外部特效，不是額外武器。',
  },
  crabGuard: {
    scientificReference: '螃蟹目（Brachyura）；參考寬扁甲殼、側向移動與雙螯。',
    identification: '寬甲殼、巨大雙螯、低重心、六足側移。',
    visualSetting: '厚重盾牌型石質甲殼，雙螯比身體更醒目；輪廓讀取優先於裝飾，不做成人形士兵。',
  },
  lobsterSoldier: {
    scientificReference: '螯龍蝦科（Nephropidae）；參考長螯、分節腹部與觸鬚。',
    identification: '長螯、分節身體、長觸鬚、厚重背甲。',
    visualSetting: '高大的石質龍蝦，長螯與腹節保持動物比例；珊瑚長矛是戰鬥道具，不把整體設計成人類士兵。',
  },
  lionfishGunner: {
    scientificReference: '獅子魚屬（Pterois）；參考扇狀毒棘與張口捕食姿態。',
    identification: '放射狀背鰭、扇形毒棘、寬口器官、原地蓄力。',
    visualSetting: '身體保持魚形，毒棘形成清楚的輪廓扇面；砲擊效果從口器與棘刺產生，不添加人類槍械。',
  },
  squidAssassin: {
    scientificReference: '魷魚目（Teuthida）；參考流線身體、觸腕、噴水推進與墨囊。',
    identification: '細長身體、集中觸腕、墨色煙霧囊、突然改變位置。',
    visualSetting: '以頭足類輪廓為主，觸手維持可讀分組；隱匿感來自墨霧與消失，不使用人形刺客服裝。',
  },
  splitLanternfish: {
    scientificReference: '燈籠魚科（Myctophidae）；是爆腹燈籠魚的失控裂殖型，保留同一類魚形與發光器官。',
    identification: '魚體裂縫、外露青藍核心、分裂後體型縮小、數量快速增加。',
    visualSetting: '石質魚體像從內部裂開，裂紋沿腹部與側線分布；每一階段仍保持燈籠魚輪廓，不做成抽象能量團。',
  },
  coralBackSeahorse: {
    scientificReference: '成年海馬屬（Hippocampus）；參考直立身形、捲曲尾巴、骨環與雄海馬育幼袋。',
    identification: '粗大的捲尾、成年海馬頭部、背部珊瑚增生、背負幼體的育幼區。',
    visualSetting: '仍然是海馬，不是人類保育者；成年石質身體被珊瑚包覆，尾部變粗，幼體附著在背部，低頻共鳴以能量線表現。',
  },
  mantisShrimpBrute: {
    scientificReference: '蝦蛄目（Stomatopoda）；參考折疊捕捉肢、分節甲殼與快速出拳。',
    identification: '巨大拳甲、分節身體、低伏姿態、可爆發跳躍的尾部。',
    visualSetting: '厚重石質蝦蛄，拳甲是最大視覺焦點；保留多足與甲殼節奏，不以人形戰將盔甲取代動物輪廓。',
  },
  nautilusOracle: {
    scientificReference: '鸚鵡螺屬（Nautilus）；參考外捲螺旋殼、觸手與噴水推進。',
    identification: '大型螺旋殼、前方觸手、殼口法器、緩慢漂浮的砲擊姿態。',
    visualSetting: '祭司是戰鬥職能，不是人類服裝；身體必須以鸚鵡螺殼與觸手為主，珊瑚法杖與雙核心魔球從殼口延伸。',
  },
  arcTideRay: {
    scientificReference: '鰩魚類（Batoidea）；參考扁平翼狀身體、胸鰭與尾部推進。',
    identification: '寬扁翼狀輪廓、弧形胸鰭、尾部穩定器、背部弧形石質骨板。',
    visualSetting: '保持鰩魚的扁平身體與翼狀輪廓；背部骨板像展開的活體投石器，弧線與水流能量用於讀取拋物線攻擊，不改成人形砲台。',
  },
  mutantMantisShrimp: {
    scientificReference: '蝦蛄目（Stomatopoda），沿用 Lv.3 蝦蛄戰將。',
    identification: '拳甲、分節甲殼與多足輪廓不變；黑色深海結晶從肩甲、拳甲與背部長出。',
    visualSetting: '同一隻蝦蛄的失控變異型，裝甲裂開、青藍能量外洩，拳甲與殘影的攻擊方向要清楚。',
  },
  mutantNautilusOracle: {
    scientificReference: '鸚鵡螺屬（Nautilus），沿用 Lv.3 鸚鵡螺祭司。',
    identification: '螺旋殼與觸手仍是主輪廓；殼體裂開，兩座永續魔核固定在殼口兩側。',
    visualSetting: '變異集中在殼體與法器系統，不添加人類長袍或臉部；360 度散射與持續魔核用環繞殼體的能量軌跡表現。',
  },
  mutantArcTideRay: {
    scientificReference: '鰩魚類（Batoidea），沿用 Lv.3 弧潮獵鰩。',
    identification: '扁平翼狀身體與弧形骨板不變；骨板出現裂紋，腹側與尾部形成潮壓印記。',
    visualSetting: '仍以鰩魚為主體，變異集中在背部骨板、尾部穩定器與潮壓能量；不要把牠畫成懸浮砲塔或飛行器。',
  },
  prismCrabGuardian: {
    scientificReference: '大型蟹類，主要參考蜘蛛蟹與深海蟹的寬甲殼、長足與低重心防守姿態。',
    identification: '巨大雙螯、厚重背甲、背部雷射稜鏡、固定砲台般的防守姿勢。',
    visualSetting: '牠不是穿著重甲的人類，而是整隻被古文明石甲包覆的巨型螃蟹；稜鏡固定在背甲中央，雙螯負責守住身體兩側，重力光球像從甲殼下方釋放的深海器官。',
  },
  mutantPrismCrabGuardian: {
    scientificReference: '大型蟹類，沿用稜鏡巨蟹的螃蟹原型。',
    identification: '背甲裂開、雷射稜鏡分裂、副雷射交錯、重力光球從無敵核心變成可破壞目標。',
    visualSetting: '保留螃蟹的寬甲殼、雙螯與多足輪廓；變異集中在背部稜鏡與甲殼裂縫，不增加人形變身比例。',
  },
  tideLawNautilus: {
    scientificReference: '大型鸚鵡螺屬（Nautilus）；參考分室螺旋殼、觸手與噴水推進。',
    identification: '巨大完整螺旋殼、殼口觸手、潮汐法球、以殼體為中心展開的規則能量環。',
    visualSetting: '祭司是戰鬥職能，不使用人類長袍與人臉；角色主體是漂浮的鸚鵡螺，護盾像半透明潮汐層包覆螺旋殼，散彈回收像被潮流重新吸回殼口。',
  },
  mutantTideLawNautilus: {
    scientificReference: '大型鸚鵡螺屬，沿用潮律鸚鵡螺的螺旋殼與觸手原型。',
    identification: '螺旋殼裂縫、護盾增生、散彈凝結成殼外屏障、兩種潮汐法則同時運行。',
    visualSetting: '殼體像被兩股潮流從內部撐裂，護盾沿殼室一層層長出；雙重法則以兩組方向相反的能量環表現，觸手與螺旋殼仍然是第一輪廓。',
  },
  abyssalSpermWhale: {
    scientificReference: '抹香鯨（Physeter macrocephalus）；參考其深海潛行、巨大方形額頭、深潛耐受、下顎與回聲感知。',
    identification: '巨大的方形額頭、長而厚重的身體、強壯尾鰭、明顯噴氣孔、沿背部排列的古文明遺跡構造。',
    visualSetting: '深淵抹香鯨是一個「帶著遺跡游動的深海生物」，不是穿王冠的人形 Boss。額頭是重力與回聲控制的核心，背部遺跡像沉沒神殿，噴氣孔散出腐化氧氣霧，縮小型態仍保留鯨魚額頭、尾鰭與流線身體。',
  },
});

const ATTACK_DESCRIPTIONS = Object.freeze({
  contactExplosion: '先鎖定玩家當下位置並直線追擊；抵達定點後停住倒數 1 秒，再引爆腹部。爆炸半徑內會受到一次高額傷害。',
  callForHelp: '停在原地發出求援訊號，施法完成後在範圍內召來兩名援軍；打斷牠能避免戰線擴大。',
  clawSwipe: '以巨螯掃過身前短距離扇形，適合懲罰貼身玩家。',
  dashClamp: '先鎖定方向再衝刺夾擊，命中距離遠於普通揮擊，看到前搖時應立即改變高度。',
  longClawStab: '伸出長螯直刺前方，射程比一般近戰更長，但攻擊方向固定。',
  spearThrow: '投出珊瑚長矛，沿直線飛行並在遠距離維持壓力。',
  venomStraightShot: '射出單發毒棘，命中後施加毒性效果，讓短暫擦傷變成持續風險。',
  spineScatter: '向扇形區域散射五枚棘刺，用來封鎖多個閃避方向。',
  inkShadowSlash: '在墨影中瞬移到目標附近並斬擊，命中前會有短暫蓄勢，適合從視野盲區出現。',
  inkGunSnipe: '以墨槍進行高速狙擊，先出現瞄準前搖，之後射出難以靠反應閃避的直線彈。',
  splitRush: '以高速直線衝撞目標，靠接觸造成爆裂傷害。',
  splitOnDeath: '死亡時裂成兩個幼體，幼體會繼續追擊並各自帶有小型爆炸。',
  lifeLink: '把自身生命連到附近同伴，持續提供治療並讓連結目標暫時無法被直接擊破。',
  coralPulse: '釋放珊瑚脈衝，範圍內的同伴獲得治療並短暫進入保護狀態。',
  punch: '蓄力後用拳甲擊出近距離重拳，命中會把玩家從安全位置打開。',
  groundSmash: '重擊海床形成震波，範圍內造成傷害並短暫擊暈；前搖很長但覆蓋面積大。',
  beaconAssault: '以信標為落點瞬移突襲，讓玩家不能只靠保持距離解決牠。',
  shortThrust: '用遺物前端刺擊身前，作為祭司被近身時的防衛手段。',
  coralMortar: '拋射一枚迫擊珊瑚彈，落點會在延遲後爆炸，能繞過直線掩護。',
  dualCoreMagic: '兩枚核心魔彈同時射出，互相覆蓋的路線會壓縮玩家的閃避空間。',
  wingRam: '用翼刃撞擊近距離目標，碰撞半徑小但冷卻短。',
  arcTideBombardment: '沿潮汐弧線投射砲彈，落點預警後爆炸，會忽略部分掩護。',
  mutantPunch: '變異拳甲追蹤玩家位置再出拳，前搖更短、命中範圍更寬。',
  mutantGroundSmash: '強化震海重擊形成更大的壓力場，擊暈時間也更長。',
  mutantBeaconAssault: '強化信標突襲能更快完成瞬移，讓原本的安全距離不再可靠。',
  mutantCoralMortar: '過載珊瑚彈的爆炸半徑更大、落點更快，會把掩護區切成危險小塊。',
  mutantDualCoreMagic: '強化雙核魔彈提高核心速度，兩條彈道會更快重疊。',
  persistentCoreVolley: '維持一枚持續飛行的核心彈，讓戰場長時間留有不能忽略的彈幕。',
  mutantWingRam: '變異翼刃撞擊會在接觸後留下潮壓刃，閃開第一次仍不能立刻回頭。',
  mutantArcTideBombardment: '強化弧潮投射命中後會延遲追加壓力爆發，落點附近需要持續移動。',
  tidalGathering: '召集潮汐援軍並同步抽取玩家的氧氣與能量，迫使玩家優先處理召集節點。',
  refractedLaser: '發射會在場景中折射的雷射，持續照射會疊加高額傷害。',
  deepSeaGravityField: '在指定範圍建立深海重力場，提高重力並造成短暫控制。',
  deepSeaSummoning: '召喚四名深海援軍，將原本的單點戰鬥變成需要清理隊形的戰鬥。',
  returningBuckshot: '射出會回頭的潮彈，第一次閃過後仍要注意回程彈道。',
  tidalLaw: '暫時改變潮汐法則，可能反轉重力、降低重力或改變水平潮流。',
  mutantTidalGathering: '強化潮汐召集一次帶來更多、更快的援軍，並會在低階援軍存活時縮短冷卻。',
  mutantRefractedLaser: '強化折射雷射會分裂出次級光束，安全角度會隨反射路徑快速消失。',
  mutantGravityField: '投放可破壞的重力球；球體短暫無敵，解除它才能拆掉重力場。',
  mutantDeepSeaSummoning: '反覆召令會在援軍仍存活時再次召喚，形成必須控制數量的循環。',
  mutantReturningBuckshot: '強化迴潮散彈回程更快，並能阻擋玩家的部分投射物。',
  lawOverlap: '同時疊加兩條潮汐法則，讓重力與潮流在短時間內一起改變。',
  abyssalSummoning: '召喚深海生物並以牠們的犧牲恢復自身，同時逐步提高後續攻擊強度。',
  ancientReconstruction: '重建場地遺跡，恢復自身生命並讓原本的路線重新變成障礙。',
  abyssEcho: '創造深淵化身並以三發彈幕壓迫玩家，化身本身也會吸收部分火力。',
  miniatureForm: '暫時縮成高速幼體，移動與技能循環加快，但承受傷害也會提高。',
  gravityDominion: '把整個戰場的重力法則往更深處推移，改變玩家所有彈射路線。',
  corruptedOxygen: '污染氧氣泡並在延遲後爆炸，爆炸區會持續抽乾玩家氧氣。',
});

export const ENEMY_ENCYCLOPEDIA = Object.freeze(ENEMY_ORDER.map((id) => {
  const definition = ENEMY_DEFINITIONS[id];
  const visuals = VISUALS[id];
  return Object.freeze({
    ...definition,
    description: ENEMY_DESCRIPTIONS[id] ?? '這名敵人的生態描述仍在整理中。',
    lore: Object.freeze(ENEMY_LORE[id] ?? {
      scientificReference: '資料仍在整理中。',
      identification: '資料仍在整理中。',
      visualSetting: '資料仍在整理中。',
    }),
    attacks: Object.freeze(definition.attacks.map((attack) => Object.freeze({
      ...attack,
      description: ATTACK_DESCRIPTIONS[attack.id] ?? `${attack.name}：依照${attack.type}型態發動攻擊，請觀察前搖與落點。`,
    }))),
    tierLabel: TIER_LABELS[definition.tier] ?? String(definition.tier),
    visuals: visuals ? Object.freeze({
      idle: `${root(id)}/${visuals.idle}`,
      actions: Object.freeze(Object.fromEntries(Object.entries(visuals.actions).map(([attackId, file]) => [attackId, `${root(id)}/${file}`]))),
      afterimageIdle: toAfterimagePath(id, visuals.idle),
      afterimageActions: Object.freeze(Object.fromEntries(Object.entries(visuals.actions).map(([attackId, file]) => [attackId, toAfterimagePath(id, file)]))),
    }) : null,
  });
}));

const MAP_ENTRY_DETAILS = Object.freeze({
  water: {
    group: '地形',
    name: '可通行水域',
    description: '角色可以在其中移動、彈射與讀取水域重力的基本六邊形區域。',
    details: [['放置層級', 'Cell 整格地形'], ['玩法作用', '提供可通行空間，並承載重力、物件、Edge 與角色']],
  },
  blocked: {
    group: '地形',
    name: '不可通行區域',
    description: '封住路線的黑色六邊形空間，角色不能進入；它也可以成為 Edge 障礙與多邊傳送門的依附邊界。',
    details: [['放置層級', 'Cell 整格地形'], ['玩法作用', '切斷路線、塑造狹窄通道與傳送門邊界']],
  },
  'L-1': {
    group: '水域重力',
    name: 'L-1 淺色水域',
    description: '持續向上 1.0G，把玩家推向海面，適合構成上浮路線與回程壓力。',
    details: [['放置層級', 'Cell 整格水域規則'], ['物理效果', '向上 1.0G，保留角色自身慣性']],
  },
  L0: {
    group: '水域重力',
    name: 'L0 中性色帶',
    description: '零垂直加速度的中性水域，讓玩家保留慣性並重新規劃下一次彈射。',
    details: [['放置層級', 'Cell 整格水域規則'], ['物理效果', '0G 垂直加速度，不清除速度']],
  },
  L1: {
    group: '水域重力',
    name: 'L1 一般藍色水域',
    description: '遊戲的標準水域，向下 1.0G，是玩家學習水域重力與彈射節奏的基準。',
    details: [['放置層級', 'Cell 整格水域規則'], ['物理效果', '向下 1.0G']],
  },
  L2: {
    group: '水域重力',
    name: 'L2 深藍過渡帶',
    description: '壓力更高的過渡水域，讓角色比一般水域更快下沉。',
    details: [['放置層級', 'Cell 整格水域規則'], ['物理效果', '向下 1.5G']],
  },
  L3: {
    group: '水域重力',
    name: 'L3 深色水域',
    description: '最強下沉水域，會快速壓縮玩家的反應時間與路線選擇。',
    details: [['放置層級', 'Cell 整格水域規則'], ['物理效果', '向下 2.0G']],
  },
  conditionalGate: {
    group: '水域重力',
    name: '條件通行門',
    description: '固定使用 L1 規則的關閉水域；按鈕觸發後解除鎖鏈，變成可通行的標準水域。',
    details: [['放置層級', 'Cell 整格水域規則'], ['玩法作用', '由按鈕控制，可一顆按鈕開啟多個指定門']],
  },
  T1: {
    group: '水域層級',
    name: 'T1 水域層',
    description: '基礎水域層，承載一般關卡路線與第一章的主要空間。',
    details: [['放置層級', 'Cell 整格水域層'], ['玩法作用', '角色在此層移動，亦可透過層間轉接門切換']],
  },
  T2: {
    group: '水域層級',
    name: 'T2 水域層',
    description: '第二個水域層，與 T1 疊合但保留自己的地圖狀態，讓同一段空間擁有另一條路線。',
    details: [['放置層級', 'Cell 整格水域層'], ['玩法作用', '透過層間轉接門進出，支援上下層解謎']],
  },
  ink: {
    group: 'Cell 環境效果',
    name: '墨水區',
    description: '把周圍空間藏進黑暗，只保留玩家附近的可見範圍，讓路線判讀變成風險。',
    details: [['放置層級', 'Cell Overlay，可自由定位'], ['玩法作用', '限制視野，不直接改變重力或碰撞']],
  },
  coralCluster: {
    group: 'Cell／Edge 物件',
    name: '珊瑚群落',
    description: '深海生態留下的石質珊瑚群落；在安全區配置中可以成為低壓避難點，讓小 Boss 以下敵人停止追擊。',
    details: [['放置層級', '舊地圖可作 Cell 物件；新配置優先作 Edge 附著'], ['玩法作用', '建立安全區與視覺地標；大小可調，尚未拆成獨立戰鬥數值']],
  },
  mine: {
    group: 'Cell 物件',
    name: '深海地雷',
    description: '埋在水域中的壓力爆裂物，碰撞時同時造成額外傷害與強力反彈。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '把撞擊路線變成高風險選擇']],
  },
  weightStone: {
    group: 'Cell 物件',
    name: '重石',
    description: '會自然向下墜落的巨大石塊；玩家向上撞擊時若力量不足，反而會被它壓回去。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '高速撞擊可破壞，形成需要管理速度與角度的障礙']],
  },
  seaweed: {
    group: 'Cell／Edge 物件',
    name: '水草',
    description: '可以附著的柔性生物，附著期間暫時不受水域重力，玩家可以利用它等待體力恢復。',
    details: [['放置層級', '舊地圖可作 Cell 物件；新配置優先作 Edge 附著'], ['玩法作用', '提供停泊、恢復與重新瞄準的短暫節點']],
  },
  oxygen: {
    group: 'Cell 物件',
    name: '含氧礦石',
    description: '藏著有限氧氣的深色礦石，必須用高速撞擊打開，補給通常放在危險位置。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '把氧氣取得與玩家肉身撞擊風險綁在一起']],
  },
  checkpoint: {
    group: 'Cell 物件',
    name: 'Checkpoint 檢查點',
    description: '接觸後更新死亡返回位置，並恢復生命、氧氣與體力，讓長路線有明確的安全邊界。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '更新重生點與資源，不增加永久命數']],
  },
  bubble: {
    group: 'Cell 物件',
    name: '光合作用氣泡',
    description: '短時間把玩家包進慣性移動狀態並免疫重力；速度很自由，也可能讓玩家失控掉落。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '快速穿越高壓區，但必須預先規劃脫離位置']],
  },
  torricelli: {
    group: 'Cell 物件',
    name: '托里切利空間',
    description: '短暫存在的含氧浮島，提供補給與喘息，但常被放在需要高風險折返的位置。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '以有限安全時間換取氧氣回復']],
  },
  razor: {
    group: 'Cell 物件',
    name: '剃刀軸',
    description: '繞中心軸旋轉的深海刀片組，接觸時造成傷害並把角色強制推離。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '可選 1–4 片刀刃，製造旋轉節奏與窄縫危險']],
  },
  button: {
    group: 'Cell 物件',
    name: '一次性開門按鈕',
    description: '接觸後只觸發一次，開啟 Inspector 指定的條件通行門；一顆按鈕可以控制多扇門。',
    details: [['放置層級', 'Cell 物件，可 Free Snap 或置中'], ['玩法作用', '把探索順序、回頭路與多門連鎖寫進地圖資料']],
  },
  springJelly: {
    group: 'Edge 互動',
    name: '彈簧水母',
    description: '固定在兩個 Cell 共用邊上的反射生物，遵守入射角等於反射角，將角色彈向可預測方向。',
    details: [['放置層級', 'Edge Snap'], ['玩法作用', '把撞擊轉成路線跳板，常與障礙邊界並用']],
  },
  spike: {
    group: 'Edge 互動',
    name: '尖刺',
    description: '貼在共用邊上的尖銳障礙，阻擋角色通過並造成接觸傷害。',
    details: [['放置層級', 'Edge Snap'], ['玩法作用', '封鎖一條邊，迫使玩家改變彈射角度']],
  },
  barrier: {
    group: 'Edge 互動',
    name: '通用障礙',
    description: '不可穿越的邊界障礙，與尖刺共享目前的障礙素材，但邏輯上不一定造成傷害。',
    details: [['放置層級', 'Edge Snap'], ['玩法作用', '建立牆面、窄口與不可直接穿越的路線邊界']],
  },
  current: {
    group: 'Edge 互動',
    name: '潮流',
    description: '沿著兩格共用邊施加橫向推力，方向與強度可在 Inspector 中調整。',
    details: [['放置層級', 'Edge Snap'], ['玩法作用', '像水平重力一樣改變彈射落點與移動節奏']],
  },
  layerPortal: {
    group: 'Edge 互動',
    name: '層間轉接門',
    description: '只能放在 T1 與 T2 相鄰的共享邊；通過後切換到另一個水域層。',
    details: [['放置層級', 'T1／T2 相鄰 Edge'], ['玩法作用', '讓兩層地圖共享同一個空間位置，但保留不同狀態']],
  },
  multiPortal: {
    group: 'Edge 互動',
    name: '多邊傳送門',
    description: '沿著不可通行六邊形的一整端連續繪製，完成另一端連線後逐段一對一傳送。',
    details: [['放置層級', '貼著不可通行 Cell 的連續 Edge'], ['玩法作用', '把兩端路線綁成大範圍傳送關係，必須先完成配對才啟用']],
  },
});

const mapEntries = (ids, fallbackGroup, placementKind) => ids.map((id) => {
  const entry = MAP_ENTRY_DETAILS[id] ?? {
    group: fallbackGroup,
    name: id,
    description: '此地圖元素的介紹仍在整理中。',
    details: [],
  };
  const legacyCellAttachment = placementKind === 'cell' && ['seaweed', 'coralCluster'].includes(id);
  const preferredEdgeAttachment = placementKind === 'edge' && ['seaweed', 'coralCluster'].includes(id);
  const placement = legacyCellAttachment
    ? 'Cell 放置（舊地圖相容）'
    : preferredEdgeAttachment
      ? 'Edge 附著（新配置）'
      : fallbackGroup;
  return Object.freeze({
    id,
    placementId: `${placementKind}:${id}`,
    placementKind,
    placement,
    ...entry,
  });
});

export const MAP_ENCYCLOPEDIA = Object.freeze([
  ...mapEntries(TERRAIN_TYPES, '地形', 'terrain'),
  ...mapEntries(['L-1', 'L0', 'L1', 'L2', 'L3', 'conditionalGate'], '水域重力', 'gravity'),
  ...mapEntries(WATER_LAYERS, '水域層級', 'layer'),
  ...mapEntries(OVERLAY_TYPES, 'Cell 環境效果', 'overlay'),
  ...mapEntries(CELL_OBJECT_TYPES, 'Cell 物件', 'cell'),
  ...mapEntries(EDGE_TYPES.filter((id) => id !== 'none'), 'Edge 互動', 'edge'),
]);

export const MAP_PLACEMENT_COUNT = MAP_ENCYCLOPEDIA.length;
export const MAP_UNIQUE_ELEMENT_COUNT = new Set(MAP_ENCYCLOPEDIA.map(({ id }) => id)).size;

const WEAPON_LORE = Object.freeze({
  knife: {
    role: '固定起始的近戰主武器，直接佔用第一個武器槽位。',
    description: '用角色移動路徑形成斬擊，讓玩家把彈射角度與近身輸出綁在一起。',
    levels: { 1: '移動路徑造成傷害。', 2: '額外在兩側生成傷害軌跡，傷害為主傷害的 70%。', 3: '停止時持續造成範圍傷害。' },
  },
  katana: {
    role: '自動處理近距離敵人的持續近戰武器。',
    description: '武士刀以玩家為軸心順時針揮擊，透過殘影交代方向與速度；Lv.3 額外發射可摧毀敵方子彈的劍氣。',
    levels: { 1: '自動對近距離敵人揮擊；停留越久，輸出越高。', 2: '每次完成移動後，下一次斬擊造成雙倍傷害。', 3: '斬擊附帶大型劍氣，可摧毀敵方子彈。' },
  },
  trident: {
    role: '需要停穩瞄準的高傷害單發遠程武器。',
    description: '三叉戟適合用在中遠距離讀取敵人前搖，但敵人移動時更難命中。',
    levels: { 1: '高傷害單發遠程攻擊，僅於靜止時發射。', 2: '命中造成暈眩，使敵人停止移動與攻擊。', 3: '成功命中可縮短下一次冷卻。' },
  },
  lightMachineGun: {
    role: '連續輸出的遠程武器，擅長把擊殺轉成壓制。',
    description: '輕量機槍以固定方向完成六連射，射擊期間必須承擔不能立即轉向的代價。',
    levels: { 1: '連續六連射；射擊期間方向固定，結束後進入冷卻。', 2: '後三發加上明顯描邊，傷害不變。', 3: '六發子彈使用不同的稜彩顏色，不附加爆炸。' },
  },
});

export const WEAPON_ENCYCLOPEDIA = Object.freeze(Object.values(WEAPONS).map((weapon) => {
  const lore = WEAPON_LORE[weapon.id];
  return Object.freeze({
    id: weapon.id,
    name: weapon.name,
    type: weapon.type,
    maxLevel: weapon.maxLevel,
    role: lore.role,
    description: lore.description,
    levels: Object.freeze(Object.entries(weapon.levels).map(([level, values]) => Object.freeze({
      level: Number(level),
      icon: `/assets/editor/icons/weapons/${weapon.id}/lv${level}.png`,
      summary: lore.levels[level],
      values: Object.freeze(values),
    }))),
  });
}));

const PASSIVE_LORE = Object.freeze({
  oxygenCirculator: {
    role: '氧氣消耗、氧氣補給與長距離探索。',
    description: '讓玩家敢於探索更遠的水域，但不會讓氧氣管理失去意義。',
    levels: { 1: '噴射與移動造成的氧氣消耗降低 10%。', 2: '最大氧氣上限提高 20%。', 3: '保留前兩級效果；低氧時額外降低體力消耗並獲得減傷。' },
  },
  pressureStabilizer: {
    role: '瞄準、發射與體力消耗的節奏。',
    description: '把擊殺轉化為輸出續航，適合輕量機槍與三叉戟等需要管理發射節奏的武器。',
    levels: { 1: '瞄準與發射的體力消耗降低 10%。', 2: '消耗降低 20%，每次擊殺恢復最大體力的 5%。', 3: '消耗降低 30%，每次擊殺恢復最大體力的 8% 與最大氧氣的 4%。' },
  },
  ecologicalCarapace: {
    role: '遠程火力容錯、補給轉生命與 Boss 生存。',
    description: '提高遠程戰鬥與資源管理的容錯，但不增加永久命數。',
    levels: { 1: '遠程傷害降低 20%。', 2: '受到高額單次傷害時獲得持續 2 秒的生態護盾，冷卻 8 秒。', 3: '保留前兩級效果；恢復氧氣或體力時同步恢復部分生命。' },
  },
  abyssalAmplifier: {
    role: '純武器輸出與高壓清場。',
    description: '用更高風險換取更快清場；最高級鼓勵玩家維持氧氣。',
    levels: { 1: '所有武器造成的傷害提高 10%。', 2: '所有武器造成的傷害提高至 20%。', 3: '所有武器造成的傷害提高至 30%；高氧氣時再提高 15%。' },
  },
});

export const PASSIVE_ENCYCLOPEDIA = Object.freeze(Object.values(PASSIVE_ABILITIES).map((passive) => {
  const lore = PASSIVE_LORE[passive.id];
  return Object.freeze({
    id: passive.id,
    name: passive.name,
    maxLevel: passive.maxLevel,
    role: lore.role,
    description: lore.description,
    levels: Object.freeze(Object.entries(passive.levels).map(([level, values]) => Object.freeze({
      level: Number(level),
      icon: `/assets/editor/icons/passives/${passive.id}/lv${level}.png`,
      summary: lore.levels[level],
      values: Object.freeze(values),
    }))),
  });
}));

export const ENCYCLOPEDIA_SECTIONS = Object.freeze([
  { id: 'enemies', label: '敵人／Boss', description: '生物原型、視覺識別與戰鬥技能演示。' },
  { id: 'map', label: '地圖元素', description: `${MAP_PLACEMENT_COUNT} 種放置語彙、${MAP_UNIQUE_ELEMENT_COUNT} 個唯一元素；從 Cell、重力、水域層到 Edge 的完整地圖語言。` },
  { id: 'weapons', label: '武器', description: '四把武器的定位、等級變化與建構角色。' },
  { id: 'passives', label: '被動能力', description: '四條能力線的生存、資源與輸出方向。' },
]);

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
