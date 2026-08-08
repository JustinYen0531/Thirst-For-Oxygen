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
  mutantNautilusOracle: { idle: gif('base-float-move-v3'), actions: { mutantCoralMortar: gif('attack-overloaded-relic-bodycast-v5'), mutantDualCoreMagic: gif('skill-360-core-scatter-bodycast-v5'), persistentCoreVolley: gif('skill-everlasting-core-bodycast-v5') } },
  mutantArcTideRay: { idle: gif('base-float-move-v3'), actions: { mutantWingRam: gif('attack-pressure-blade-aftershock-bodycast-v5'), mutantArcTideBombardment: gif('skill-secondary-pressure-burst-bodycast-v5') } },
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
