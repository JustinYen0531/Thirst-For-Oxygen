import { getLanguage, setLanguage, subscribeLanguage, translateText } from './i18n.js';

const CJK_PATTERN = /[\u3400-\u9fff]/;

const EXACT_ENGLISH = Object.freeze({
  'Thirst for Oxygen — 遊玩': 'Thirst for Oxygen — Play',
  'Thirst for Oxygen — 敵人沙盒': 'Thirst for Oxygen — Combat Sandbox',
  '回到水下主控台': 'Return to the Abyss Console',
  '開啟遊玩設定': 'Open play settings',
  '設定': 'Settings',
  '地圖遊玩測試': 'Map playtest',
  '速度 0': 'SPEED 0',
  '主角水平錨點 60%': 'PLAYER HORIZONTAL ANCHOR 60%',
  'R 重設 · Space 暫停': 'R Reset · Space Pause',
  'HUD 鏡片內的遊戲畫面': 'Gameplay view inside the HUD visor',
  '下沉篇地圖遊玩畫面': 'Descent map gameplay',
  '地圖章節': 'MAP CHAPTER',
  '選擇地圖部分': 'Select map part',
  '下沉篇・第一部分': 'Descent · Part I',
  '下沉篇・第二部分': 'Descent · Part II',
  '下沉篇・第三部分': 'Descent · Part III',
  '上升篇・第一部分': 'Ascent · Part I',
  '上升篇・第二部分': 'Ascent · Part II',
  '上升篇・第三部分': 'Ascent · Part III',
  '下沉篇與上升篇地圖遊玩畫面': 'Descent and Ascent map gameplay',
  '目前下沉深度': 'Current descent depth',
  '目前等級與經驗進度': 'Current level and experience progress',
  '剩餘嘗試次數 3，共 3 次': '3 attempts remaining out of 3',
  '主角狀態': 'Player status',
  '主動武器與被動能力槽位': 'Active weapon and passive ability slots',
  '主動武器槽位 1': 'Active weapon slot 1',
  '主動武器槽位 2': 'Active weapon slot 2',
  '主動武器槽位 3': 'Active weapon slot 3',
  '被動能力槽位 1': 'Passive ability slot 1',
  '被動能力槽位 2': 'Passive ability slot 2',
  '被動能力槽位 3': 'Passive ability slot 3',
  '氧氣': 'Oxygen',
  '能量': 'Energy',
  '生命值': 'Health',
  '正在潛入水域…': 'Entering the abyss…',
  '選擇本次成長方向': 'Choose Your Upgrade',
  '先選武器或被動能力，再從兩個合法選項中擇一。': 'Choose Weapons or Passives, then select one of two valid upgrades.',
  '下沉篇航線完成': 'Descent Route Complete',
  '深淵抹香鯨已被擊敗，潛水員抵達第三部分終點。': 'The Abyssal Sperm Whale has fallen. The diver reached the end of Part III.',
  '回到水下主控台': 'Return to Abyss Console',
  '遊玩設定': 'Play Settings',
  '關閉設定': 'Close settings',
  '地圖選擇固定在上方中央；這裡集中音樂、暫停與測試輔助。': 'The map selector stays at the top. Music, pause, accessibility, and test tools are collected here.',
  '語言': 'Language',
  '介面語言': 'Interface language',
  '英文': 'English',
  '繁體中文': 'Traditional Chinese',
  '難度輔助': 'Difficulty Assistance',
  '玩家承受傷害': 'Damage Taken',
  '標準（減傷 0%）': 'Standard (0% reduction)',
  '減傷 30%': '30% reduction',
  '減傷 50%（推薦）': '50% reduction (Recommended)',
  '減傷 75%': '75% reduction',
  '減傷 90%': '90% reduction',
  '套用於敵人、投射物、毒素與環境造成的生命傷害；選擇會儲存在本機。': 'Applies to health damage from enemies, projectiles, venom, and the environment. Saved locally.',
  '音樂': 'Music',
  '音樂篇章': 'Music Arc',
  '下沉篇': 'Descent',
  '上升篇 2.0（待驗收）': 'Ascent 2.0 (Awaiting Review)',
  '音樂情境': 'Music Context',
  'Boss 戰': 'Boss Battle',
  '測試工具': 'Test Tools',
  '↻ 重設主角': '↻ Reset Player',
  'Ⅱ 暫停': 'Ⅱ Pause',
  '▶ 繼續': '▶ Resume',
  '∞ 無限氧氣／能量：關': '∞ Infinite Oxygen / Energy: Off',
  '∞ 無限氧氣／能量：開': '∞ Infinite Oxygen / Energy: On',
  '◉ 潛水環境音（240 秒循環）：開': '◉ Diving Ambience (240s loop): On',
  '○ 潛水環境音（240 秒循環）：關': '○ Diving Ambience (240s loop): Off',
  '↩ 離開遊玩': '↩ Exit Play',
  '鏡頭狀態': 'Camera Status',
  '主角 60% 錨點': 'Player 60% Anchor',
  '正在載入地圖…': 'Loading map…',
  '測試紀錄': 'Test Log',
  '拖曳潛水夫，放開即可彈射。': 'Drag the diver, then release to launch.',
  '敵人驗收沙盒': 'Combat Validation Sandbox',
  '放置敵人、逐一觸發技能，檢查攻擊前搖、命中、資源變化與玩家 Build。': 'Place enemies and trigger each skill to inspect telegraphs, hits, resources, and the player build.',
  '返回主控台': 'Back to Console',
  '遊玩地圖': 'Play Map',
  '返回地圖編輯器': 'Back to Map Editor',
  '世界圖鑑': 'World Compendium',
  '放置敵人': 'Place Enemies',
  '敵人': 'Enemy',
  '放置敵人模式（關閉）': 'Enemy Placement Mode (Off)',
  '放置敵人模式（開啟）': 'Enemy Placement Mode (On)',
  '清除全部敵人': 'Clear All Enemies',
  '預設是潛水員操控模式：點擊潛水員周圍的高亮操控區，再拖曳方向與距離。要新增敵人時，先開啟放置敵人模式；放置模式也不會搶走操控區的判定。': 'Diver control is the default. Press inside the highlighted control zone, then drag for direction and power. Turn on placement mode to add enemies; the diver control zone always has priority.',
  '玩家 Build': 'Player Build',
  '沙盒進入時 Build 全空；選擇武器或被動後立即生效，不必另外套用。武器可自由換位，已裝備武器會同時運作，槽位按鈕只改檢視焦點。': 'The sandbox starts with an empty build. Weapons and passives apply immediately. Equipped weapons run together; slot buttons only change the inspection focus.',
  '武器 Build 槽位': 'Weapon build slots',
  '測試開關': 'Test Toggles',
  '無敵模式': 'Invincibility',
  '敵人自動循環技能': 'Auto-cycle enemy skills',
  '重置玩家': 'Reset Player',
  '暫停': 'Pause',
  '敵人驗收場地': 'Enemy validation arena',
  '玩家潛水夫': 'Player diver',
  '沙盒玩家狀態': 'Sandbox player status',
  '氧氣（無限）': 'Oxygen (Infinite)',
  '能量（無限）': 'Energy (Infinite)',
  '∞ 無限': '∞ Infinite',
  '無限': 'Infinite',
  '目前武器槽位；可按 1、2、3 切換': 'Current weapon slots; press 1, 2, or 3 to change focus',
  '沙盒已準備：目前為潛水員操控模式。': 'Sandbox ready: diver control mode is active.',
  '同時使用已裝備武器': 'Use All Equipped Weapons',
  '立即施放技能': 'Cast Skill Now',
  '尚未選取敵人': 'No Enemy Selected',
  '點擊場上的敵人後，在這裡選擇要驗收的技能。': 'Select an enemy in the arena, then choose a skill to inspect here.',
  '技能': 'Skill',
  '經驗與升級': 'Experience & Upgrades',
  '光點會留在擊敗位置；靠近拾取後才會累積經驗。': 'Experience motes remain where enemies fall. Move close to collect them.',
  '升級類別': 'Upgrade category',
  '場上敵人與技能': 'Enemies & Skills in the Arena',
  '每一隻已放置的敵人都會列出自己的全部技能；點技能按鈕即可單獨施放。': 'Every placed enemy lists all of its skills. Use a skill button to cast it independently.',
  '武器': 'Weapons',
  '被動能力': 'Passives',
  '空槽': 'Empty Slot',
  '試射': 'Test Fire',
  '無': 'None',
  '冷卻中': 'Cooling Down',
  '連射中': 'Burst Active',
  '未裝備武器': 'No Weapon Equipped',
  '自然漂浮': 'Natural Float',
  '播放中': 'Playing',
  '已暫停': 'Paused',
  '已停止': 'Stopped',
  '待播放': 'Ready to Play',
  '淡出中，準備循環': 'Fading out before loop',
  '未選取音樂': 'No Track Selected',
  '此曲目尚未提供音檔。': 'Audio is not available for this track yet.',
  '請點擊播放按鈕以開始音樂。': 'Press Play to start the music.',
  '音樂控制': 'Music controls',
  '▶ 播放': '▶ Play',
  '音量': 'Volume',
  '提升武器等級與攻擊規格。': 'Upgrade weapon level and attack properties.',
  '提升被動能力等級與效果。': 'Upgrade passive level and effect strength.',
  '加入新的武器槽位；小刀永遠保留在 Build。': 'Fill a new weapon slot; the Knife always remains in the build.',
  '加入新的被動能力槽位。': 'Fill a new passive slot.',
  '沙盒已準備：武器與被動槽位目前全空，可自由組合。': 'Sandbox ready: all weapon and passive slots are empty and ready to configure.',
  '尚未放置敵人。先在上方選擇敵人，再點擊場地。': 'No enemies placed. Choose one above, then click the arena.',
  '這個槽位目前是空的，先選一把武器再試射。': 'This slot is empty. Select a weapon before test-firing.',
  'Build 已即時同步，但這個槽位目前沒有可試射的武器，請檢查槽位選擇。': 'The build is synchronized, but this slot has no weapon to test. Check the selected slot.',
  '目前沒有裝備武器，請先在三個槽位中選擇武器。': 'No weapon is equipped. Choose weapons for the three slots first.',
  '目前沒有可展示的武器效果。': 'No weapon effect is ready to display.',
  '擊敗敵人取得光點；升級時會在這裡暫停並提供選擇。': 'Defeat enemies for motes. Upgrade choices will pause the action and appear here.',
  '已升級：先選擇武器或被動能力。': 'Level gained: choose Weapons or Passives first.',
  '請先完成升級選擇，再操控潛水員。': 'Complete the upgrade choice before controlling the diver.',
  '目前無法操控潛水員。': 'The diver cannot be controlled right now.',
  '蓄力中：拖曳方向與距離，放開滑鼠即可彈射。': 'Charging: drag for direction and power, then release to launch.',
  '目前是潛水員操控模式；請點擊潛水員周圍高亮區。要放置敵人，先開啟放置敵人模式。': 'Diver control mode is active. Press the highlighted zone around the diver. Turn on placement mode to add an enemy.',
  '已放置敵人；可點擊敵人或選擇技能驗收。': 'Enemy placed. Select it or choose a skill for validation.',
  '放置模式已開啟；點擊潛水員周圍仍優先操控潛水員。': 'Placement mode is on; the diver control zone still takes priority.',
  '放置模式已關閉；目前點擊場地不會召喚敵人。': 'Placement mode is off; clicking the arena will not summon enemies.',
  '沙盒繼續運行。': 'Sandbox resumed.',
  '沙盒已暫停；可逐一閱讀場上狀態。': 'Sandbox paused; arena states can be inspected safely.',
  '敵人會自動循環可用技能。': 'Enemies will automatically cycle available skills.',
  '敵人自動技能已關閉。': 'Automatic enemy skills are off.',
  '請從兩個合法升級選項中選一個。': 'Choose one of the two valid upgrades.',
  '這個升級類別目前沒有合法選項。': 'This upgrade category has no valid options.',
  '升級已套用；可繼續拾取經驗光點。': 'Upgrade applied; experience motes can be collected again.',
  '這個升級選項已失效，請重新選擇。': 'That upgrade is no longer valid. Choose again.',
  '技能目前仍在冷卻中。': 'The skill is still on cooldown.',
  '還有新的升級選擇，請先完成 Build。': 'Another upgrade is waiting. Finish the build choice first.',
  '升級選擇完成，玩家可以繼續探索。': 'Upgrade selection complete. Exploration can continue.',
  '目前沒有已裝備武器可切換。': 'No equipped weapon is available to focus.',
  '沙盒自動重置玩家生命，方便繼續驗收。': 'The sandbox restored player health for continued testing.',
  '已清除沙盒敵人與場上技能效果。': 'All sandbox enemies and active skill effects were cleared.',
  '玩家已重置。': 'Player reset.',
  '目前沒有裝備武器，無法發動攻擊。': 'No weapon is equipped, so no attack can be used.',
  '沒有可攻擊的敵人。': 'There are no enemies in range to attack.',
  '正在潛入水域…': 'Entering the abyss…',
  '地圖載入失敗': 'Map Load Failed',
  '暈眩中，暫時無法彈射。': 'Stunned: launching is temporarily disabled.',
  '能量不足，無法彈射。': 'Not enough energy to launch.',
  '這次彈射距離太短。': 'The launch pull was too short.',
  '主角已回到最近的安全水域；Build、減傷與篇章進度保留。': 'The player returned to the nearest safe water. Build, damage reduction, and chapter progress were preserved.',
  '跨段完成：生命、氧氣、能量、經驗與 Build 已保留。': 'Part transition complete: health, oxygen, energy, experience, and build were preserved.',
  '深淵抹香鯨已擊敗：下沉篇完成。': 'Abyssal Sperm Whale defeated: Descent complete.',
  '生命歸零': 'Health depleted',
  '已離開水草，重力重新生效。': 'Detached from seaweed; gravity is active again.',
  '已附著邊緣水草：暫停重力並回復體力。': 'Attached to edge seaweed: gravity paused and energy recovery accelerated.',
  '已附著水草：暫停重力並回復體力。': 'Attached to seaweed: gravity paused and energy recovery accelerated.',
  '附近沒有可附著的水草。': 'No attachable seaweed nearby.',
  '碰到測試區邊界：速度已反彈。': 'Test-area boundary hit: velocity reflected.',
  '多邊傳送門尚未連接另一端：入口暫時阻擋。': 'Multi-portal has no destination: entry is blocked.',
  '不可通行障礙物：已阻擋並反彈玩家。': 'Impassable terrain blocked and reflected the player.',
  '彈簧水母：依入射角反射並加速。': 'Spring Jelly: reflected along the impact angle and accelerated.',
  '障礙 Edge 阻擋：速度已反彈。': 'Barrier Edge blocked passage and reflected velocity.',
  '不可通行障礙物：接觸邊界後反彈。': 'Impassable terrain reflected the player at its boundary.',
  '邊緣珊瑚群落：玩家處於保護範圍。': 'Edge coral colony: the player is inside its protection field.',
  '按鈕：已切換，但沒有可切換的條件通行門。': 'Button toggled, but no linked conditional gate could change.',
  '按鈕：已按下，但沒有可開啟的條件通行門。': 'Button pressed, but no linked conditional gate could open.',
  '剃刀：碰觸後被強制推開；珊瑚保護範圍抵銷了傷害。': 'Razor contact forced the player away; coral protection cancelled the damage.',
  '深海地雷：珊瑚群落保護範圍抵銷了傷害。': 'Abyss Mine: coral protection cancelled the damage.',
  '重石已被足夠的撞擊力擊碎。': 'The Weight Stone shattered under sufficient impact force.',
  '重石壓下玩家：撞擊力不足以擊碎。': 'The Weight Stone forced the player down; impact force was insufficient.',
  'Checkpoint：已更新重生點並回滿資源。': 'Checkpoint updated the respawn point and restored all resources.',
  '墨水區：預覽視野受限。': 'Ink cloud: visor visibility reduced.',
  '深海地雷': 'Abyss Mine', '危險物': 'Hazard',
  '接近或撞擊會引爆；爆炸也可能波及附近敵人。': 'Proximity or impact triggers an explosion that can also hit nearby enemies.',
  '剃刀': 'Razor', '接觸會造成傷害，並把潛水員強制推離。': 'Contact deals damage and forcibly pushes the diver away.',
  '氧氣礦石': 'Oxygen Ore', '補給物': 'Supply',
  '以足夠速度撞開後，會釋放氧氣補給。': 'Strike it at sufficient speed to release oxygen.',
  '光合作用氣泡': 'Photosynthesis Bubble', '取得後會暫時隔絕水域重力。': 'Collect it to temporarily ignore water gravity.',
  '托里切利空間': 'Torricelli Pocket', '偏離主路的氧氣補給區，可恢復呼吸資源。': 'An off-route oxygen refuge that restores breathing resources.',
  '機關': 'Mechanism', '啟動後記錄重生位置，並補滿玩家資源。': 'Activates a respawn point and restores player resources.',
  '重石': 'Weight Stone', '需要高速撞擊才能破壞，並打開原本封住的路。': 'Requires a high-speed impact to break and open the blocked route.',
  '一次性開門按鈕': 'One-use Gate Button', '觸發後會永久開啟與它連接的條件門。': 'Permanently opens its linked conditional gate.',
  '水草': 'Seaweed', '支援補給': 'Support Supply', '附著後可暫停重力，並加快能量恢復。': 'Attach to pause gravity and accelerate energy recovery.',
  '珊瑚群落': 'Coral Colony', '靠近時會形成保護區，降低環境威脅。': 'Creates a nearby protection zone that reduces environmental threats.',
  '尖刺邊界': 'Spike Boundary', '接觸尖刺會直接受到傷害。': 'Touching spikes deals direct damage.',
  '彈簧水母': 'Spring Jelly', '撞上後會沿反方向彈開，可用來改變移動路線。': 'Reflects the diver on impact and can redirect a route.',
  '通用邊界': 'Barrier', '封鎖這一側的通行，必須改走其他路線。': 'Blocks passage on this side, forcing another route.',
  '潮流': 'Current', '持續把玩家推向標示方向。': 'Continuously pushes the player in the indicated direction.',
  '層間轉接門': 'Layer Portal', '允許玩家穿越不同水域層級的交界。': 'Allows travel across boundaries between water layers.',
  '多邊傳送門': 'Multi-Portal', '進入後會被傳送到同組的另一個邊界。': 'Teleports the player to another boundary in the same group.',
  '條件通行門': 'Conditional Gate', '找到並觸發相連按鈕後，這道門才會永久開啟。': 'Find and trigger its linked button to open this gate permanently.',
  '敵對生物，會主動妨礙玩家。': 'A hostile creature that actively obstructs the player.',
  '上升篇': 'Ascent',
  '主槽': 'Primary Slot', '副槽': 'Secondary Slot', '副副槽': 'Tertiary Slot',
  '未裝備': 'Unequipped', '武器槽位': 'Weapon Slot', '被動能力槽位': 'Passive Slot',
  '（已擊敗）': ' (Defeated)', '三發散射': 'Three-shot Spread', '一發': 'Single Shot',
  '目前沒有留在場上的光點': 'No experience motes remain in the arena',
  '武器\n槽位': 'WEAPON\nSLOT', '被動\n能力': 'PASSIVE\nABILITY', '主動武器': 'Active Weapon',
  '請拉出更長距離。': 'Pull farther before releasing.', '玩家目前附著中。': 'The player is currently attached.',
  '能量不足。': 'Not enough energy.', '沙盒已準備：點擊場地放置敵人。': 'Sandbox ready: click the arena to place an enemy.',
  '蓄力距離太短': 'charge distance too short', '玩家目前附著中': 'player is currently attached', '能量不足': 'not enough energy',
  '武士刀・強化揮擊': 'Katana · Empowered Swing', '武士刀・順時針揮擊': 'Katana · Clockwise Swing',
  '沙盒已暫停': 'sandbox paused', '等待升級選擇': 'waiting for upgrade choice', '玩家死亡': 'player defeated',
  '拉射中': 'charging launch', '附著中': 'attached', '準備自動發射': 'Ready to Auto-fire',
  '準備自動六連射': 'Ready for Automatic Six-shot Burst', '與白色飛行衝擊波': ' and a white flying shockwave',
  '自動發射': 'Auto-fire', '玩家使用': 'Player used', '自動發動': 'Auto-activated',
  '玩家投射物': 'Player Projectile', '敵人投射物': 'Enemy Projectile', '小刀 Lv.3 停止範圍': 'Knife Lv.3 Stopping Field',
  '毒刺持續傷害': 'Venom Damage over Time', 'Phase 2 / Boss 2.0（音檔待提供）': 'Phase 2 / Boss 2.0 (Audio Pending)',
});

const TERM_ENGLISH = Object.freeze({
  '變異鸚鵡螺祭司': 'Mutant Nautilus Oracle', '變異蝦蛄戰將': 'Mutant Mantis Shrimp Brute',
  '變異弧潮獵鰩': 'Mutant Arc-Tide Ray', '變異潮律鸚鵡螺': 'Mutant Tide-Law Nautilus',
  '變異稜鏡巨蟹': 'Mutant Prism Crab Guardian', '鸚鵡螺祭司': 'Nautilus Oracle',
  '蝦蛄戰將': 'Mantis Shrimp Brute', '弧潮獵鰩': 'Arc-Tide Ray', '潮律鸚鵡螺': 'Tide-Law Nautilus',
  '稜鏡巨蟹': 'Prism Crab Guardian', '深淵抹香鯨': 'Abyssal Sperm Whale',
  '爆腹燈籠魚': 'Burst-Belly Anglerfish', '求援幼年海馬': 'Juvenile Seahorse Caller',
  '螃蟹守衛': 'Crab Guard', '龍蝦士兵': 'Lobster Soldier', '獅子魚砲手': 'Lionfish Gunner',
  '魷魚刺客': 'Squid Assassin', '裂殖燈籠魚': 'Splitting Anglerfish', '珊瑚背海馬': 'Coralback Seahorse',
  '氧循環器': 'Oxygen Circulator', '潮壓穩定器': 'Pressure Stabilizer', '生態甲殼': 'Ecological Carapace',
  '深淵增幅器': 'Abyssal Amplifier', '輕量機槍': 'Light Machine Gun', '三叉戟': 'Trident',
  '武士刀': 'Katana', '小刀': 'Knife', '深海甲殼（強化）': 'Deep-Sea Carapace (Enhanced)',
  '潮汐護盾（強化）': 'Tidal Shield (Enhanced)', '深海甲殼': 'Deep-Sea Carapace', '潮汐護盾': 'Tidal Shield',
  '深淵覺醒': 'Abyssal Awakening',
  '毒刺持續傷害': 'Venom Damage over Time',
  '中段': 'Centered', '左外緣鎖定': 'Locked to Left Edge', '右外緣鎖定': 'Locked to Right Edge',
  '60% 錨點': '60% Anchor', '上外緣': 'Top Edge', '下外緣': 'Bottom Edge', '滑動': 'Tracking',
  '上升': 'Ascent', '下沉': 'Descent', '開': 'On', '關': 'Off', '繼續': 'Resume', '釋放': 'release',
  '正在逆游上升…': 'Beginning the ascent…',
  '潛水員完成強化後的逆重力返航，從第三部分抵達海面出口。': 'Empowered for the return, the diver crossed the reversed-gravity route and reached the surface exit from Part III.',
  '定點自爆': 'Locked-Point Detonation', '求援呼叫': 'Call for Help', '巨螯揮擊': 'Giant Claw Swipe',
  '衝刺夾擊': 'Dash Clamp', '長螯刺擊': 'Long-Claw Stab', '投擲長矛／珊瑚刺': 'Spear / Coral Spine Throw',
  '毒刺直射': 'Venom Straight Shot', '棘刺散射': 'Spine Scatter', '墨影瞬移斬': 'Inkshadow Blink Slash',
  '墨槍狙擊': 'Ink-Gun Snipe', '裂殖衝撞': 'Splitting Rush', '死亡分裂': 'Death Split',
  '生命連結': 'Life Link', '珊瑚脈衝': 'Coral Pulse', '拳甲蓄力／拳擊': 'Charged Gauntlet Punch',
  '震海重擊': 'Seaquake Smash', '信標突襲': 'Beacon Assault', '前方短距離刺擊': 'Short Forward Thrust',
  '迫擊珊瑚彈': 'Coral Mortar', '雙核魔彈': 'Dual-Core Bolt', '翼刃撞擊': 'Wing-Blade Ram',
  '弧潮投射': 'Arc-Tide Bombardment', '持續雙核魔彈': 'Sustained Dual-Core Volley',
  '潮汐召集': 'Tidal Gathering', '折射雷射': 'Refracted Laser', '深海重力場': 'Deep-Sea Gravity Field',
  '深海召令': 'Abyssal Summoning', '迴潮散彈': 'Returning Buckshot', '潮汐法則': 'Tidal Law',
  '法則疊加': 'Law Overlap', '遺跡重現': 'Ancient Reconstruction', '深淵化身': 'Abyss Echo',
  '深淵幼體': 'Miniature Abyss Form', '重力支配': 'Gravity Dominion', '氧氣侵蝕': 'Corrupted Oxygen',
  '強化': 'Empowered', '技能': 'Skill', '敵人': 'Enemy', '武器': 'Weapon', '被動能力': 'Passive',
  '生命': 'Health', '角色': 'Role', '移速': 'Move Speed', '狀態': 'State', '秒': 's', '級': ' level(s)',
});

const SENTENCE_REPLACEMENTS = Object.freeze([
  [/^速度 (\d+)$/, 'SPEED $1'],
  [/^目前下沉 (\d+) 公尺$/, 'Current depth: $1 meters'],
  [/^剩餘嘗試次數 (\d+)，共 (\d+) 次$/, '$1 attempts remaining out of $2'],
  [/^主角 60% 錨點 · (.+)$/, 'Player 60% Anchor · $1'],
  [/^彈射距離 (\d+)$/, 'Launch distance $1'],
  [/^Lv\.(\d+) 上限$/, 'Lv.$1 cap'],
  [/^已選取 (.+)。$/, 'Selected $1.'],
  [/^下一個放置：(.+)。$/, 'Next placement: $1.'],
  [/^已施放 (.+)。$/, 'Cast $1.'],
  [/^已放置 (.+)。$/, 'Placed $1.'],
  [/^(.+) 冷卻中：([\d.]+) 秒。$/, '$1 cooldown: $2s.'],
  [/^(.+) 已被擊敗。$/, '$1 defeated.'],
  [/^(.+) 召喚 (\d+) 名援軍。$/, '$1 summoned $2 reinforcements.'],
  [/^拾取經驗光點 \+(\d+)。$/, 'Collected experience mote +$1.'],
  [/^經驗光點 \+(\d+) 留在原地，靠近後才會拾取。$/, 'An experience mote worth $1 remains here until collected.'],
  [/^受到 (\d+) 傷害 · (.+)$/, 'Took $1 damage · $2'],
  [/^玩家減傷已調整為 (\d+)%[$。]?$/, 'Player damage reduction set to $1%.'],
  [/^前往(.+)…$/, 'Entering $1…'],
  [/^(.+) 已載入。$/, '$1 loaded.'],
  [/^已生成 (\d+) 名敵人（(\d+) 個遭遇群）。$/, 'Spawned $1 enemies across $2 encounter groups.'],
  [/^目前 Build：(.+)。$/, 'Current Build: $1.'],
  [/^地圖載入失敗：(.+)$/, 'Map load failed: $1'],
  [/^目前(.+) (\d+) 公尺$/, 'Current $1: $2 meters'],
  [/^(.+)空槽$/, '$1 Empty Slot'],
  [/^還有 (\d+) 次升級待選；選擇一個合法項目。$/, '$1 upgrade(s) remain; choose one valid option.'],
  [/^還有 (\d+) 次升級待選；先決定武器或被動能力。$/, '$1 upgrade(s) remain; choose Weapons or Passives first.'],
  [/^彈射 (\d+) px · 初速度 (\d+) · 能量 -(\d+) · 氧氣持續倒數$/, 'Launch $1 px · Initial speed $2 · Energy -$3 · Oxygen timer continues'],
  [/^([◉○]) 潛水環境音（240 秒循環）：(.+)$/, '$1 Diving Ambience (240s loop): $2'],
  [/^武士刀 Lv\.(\d+)( 強化)?斬擊命中 (\d+) 隻，造成 (\d+) 傷害。$/, 'Katana Lv.$1$2 slash hit $3 targets for $4 damage.'],
  [/^(.+)：(.+)，本次航線結束。$/, '$1: $2. This route is over.'],
  [/^(.+)：(.+)，已回到最近啟用的 Checkpoint。$/, '$1: $2. Returned to the most recently activated Checkpoint.'],
  [/^(.+)航線完成$/, '$1 Route Complete'],
  [/^深淵抹香鯨已擊敗：(.+)完成。$/, 'Abyssal Sperm Whale defeated: $1 complete.'],
  [/^Build 已更新：(.+)。$/, 'Build updated: $1.'],
  [/^拾取 (\d+) EXP，提升 (\d+) 級。$/, 'Collected $1 EXP and gained $2 level(s).'],
  [/^拾取 (\d+) EXP。$/, 'Collected $1 EXP.'],
  [/^多邊傳送門：已傳送至另一端 Edge（(.+)）。$/, 'Multi-portal: teleported to destination Edge ($1).'],
  [/^水域層級邊界：T(.+) 與 T(.+) 之間沒有層間轉接門。$/, 'Water-layer boundary: no layer portal connects T$1 and T$2.'],
  [/^層間轉接門：已從 (.+) 進入 (.+)。$/, 'Layer portal: moved from $1 to $2.'],
  [/^尖刺阻擋：反彈並受到 (\d+) 點傷害。$/, 'Spike boundary reflected the player and dealt $1 damage.'],
  [/^按鈕：已切換 (\d+) 個條件通行門。$/, 'Button toggled $1 conditional gate(s).'],
  [/^按鈕：已開啟 (\d+) 個條件通行門。$/, 'Button opened $1 conditional gate(s).'],
  [/^剃刀：碰觸後被強制推開並受到 (\d+) 點傷害。$/, 'Razor contact forced the player away and dealt $1 damage.'],
  [/^深海地雷：強力反彈並受到 (\d+) 點傷害。$/, 'Abyss Mine caused a powerful rebound and dealt $1 damage.'],
  [/^氧氣礦石：撞擊後釋放 (\d+) O₂。$/, 'Oxygen Ore released $1 O₂ after impact.'],
  [/^氧氣礦石：需要 (\d+) px\/s 撞擊才會釋放氧氣。$/, 'Oxygen Ore requires an impact of $1 px/s to release oxygen.'],
  [/^托里切利空間：以 (.+) O₂\/s 回復氧氣。$/, 'Torricelli Pocket restores oxygen at $1 O₂/s.'],
  [/^光合作用氣泡：\+(\d+) O₂，(.+) 秒免疫水域重力。$/, 'Photosynthesis Bubble: +$1 O₂ and immunity to water gravity for $2s.'],
  [/^氧氣耗盡：生命 -([\d.]+)，請尋找氧氣補給。$/, 'Oxygen depleted: health -$1. Find an oxygen supply.'],
  [/^(.+)等級$/, '$1 tier'],
  [/^｜讀條 (.+) (.+)s$/, ' | Cast $1 $2s'],
  [/^｜信標 (.+)s$/, ' | Beacon $1s'],
  [/^已套用武器 (.+)；被動 (.+)。$/, 'Equipped weapons: $1; passives: $2.'],
  [/^已選取 (.+) Lv\.(\d+) 作為檢視焦點；已裝備武器仍同時運作。$/, 'Inspection focus: $1 Lv.$2; every equipped weapon continues to operate.'],
  [/^(.+) 仍在冷卻中。$/, '$1 is still on cooldown.'],
  [/^(.+) 連射尚未完成。$/, '$1 burst is still active.'],
  [/^(.+) 目前無法試射。$/, '$1 cannot be test-fired right now.'],
  [/^三叉戟 Lv\.(\d+) 已發射(.+)，請看潛水員前方的亮色投射物。$/, 'Trident Lv.$1 fired $2. Watch the bright projectile ahead of the diver.'],
  [/^輕量機槍 Lv\.(\d+) 已開始六連射，子彈會沿固定方向連續出膛。$/, 'Light Machine Gun Lv.$1 began a six-shot burst along one locked direction.'],
  [/^(.+) Lv\.(\d+) 已開始試射。$/, '$1 Lv.$2 test fire started.'],
  [/^三槽武器目前(.+)。$/, 'The three weapon slots are currently $1.'],
  [/^三槽同時發動：(.+)。各武器仍依自己的冷卻與條件運作。$/, 'All three slots activated: $1. Each weapon keeps its own cooldown and trigger conditions.'],
  [/^(\d+) 顆留在場上的光點$/, '$1 experience motes remain in the arena'],
  [/^(.+)；靠近玩家才會拾取。$/, '$1; move close to the player to collect them.'],
  [/^點擊設定檢視焦點（快捷鍵 (\d+)）；三把已裝備武器仍會同時運作$/, 'Select to change inspection focus (shortcut $1); all equipped weapons still operate together'],
  [/^彈射成功：初速 (\d+)；沙盒零重力已接管，方向不會被重力改彎。$/, 'Launch successful: initial speed $1. Sandbox zero-gravity preserves the selected direction.'],
  [/^彈射失敗：(.+)$/, 'Launch failed: $1'],
  [/^(.+) 已鎖定定點，抵達後將在 (.+) 秒後爆炸。$/, '$1 locked a destination and will explode $2s after arrival.'],
  [/^(.+) 抵達定點後爆炸。$/, '$1 exploded after reaching its locked destination.'],
  [/^(.+) 已抵達定點，倒數 (.+) 秒。$/, '$1 reached its destination; detonation in $2s.'],
  [/^升級完成：(.+) Lv\.(\d+)。$/, 'Upgrade complete: $1 Lv.$2.'],
  [/^切換武器：(.+) Lv\.(\d+)。$/, 'Weapon focus: $1 Lv.$2.'],
  [/^玩家升級至 Lv\.(\d+)，請選擇武器或能力。$/, 'Player reached Lv.$1. Choose a weapon or passive.'],
  [/^玩家受到 (\d+) 傷害（(.+)）。$/, 'Player took $1 damage ($2).'],
  [/^無敵模式抵銷了 (.+)。$/, 'Invincibility cancelled $1.'],
  [/^(.+) 仍受生命連結保護，必須先清除 Lv\.2 夥伴。$/, '$1 remains protected by Life Link. Defeat the Lv.2 partners first.'],
  [/^(.+) 受到生命連結保護，必須先切斷支援。$/, '$1 is protected by Life Link. Break the support first.'],
  [/^(.+) 受到 (\d+) 傷害（(.+)）。$/, '$1 took $2 damage ($3).'],
  [/^(.+) 死亡分裂成 (\d+) 隻更快的小型個體。$/, '$1 split into $2 faster offspring on death.'],
  [/^(.+) 進入 (.+) 預警，(.+) 秒後施放。$/, '$1 telegraphed $2 and will cast in $3s.'],
  [/^玩家彈射：距離 (\d+)、初速 (\d+)；沙盒零重力物理已接管。$/, 'Player launch: distance $1, initial speed $2; sandbox zero-gravity is active.'],
  [/^(.+) 已啟動。$/, '$1 activated.'],
  [/^(.+) 投出信標，0\.8 秒後突襲。$/, '$1 placed a beacon and will assault it in 0.8s.'],
  [/^(.+) 立即分裂出 (\d+) 隻小型個體。$/, '$1 immediately split into $2 offspring.'],
  [/^武士刀 Lv\.(\d+) 順時針揮刀命中 (\d+) 個目標。$/, 'Katana Lv.$1 clockwise swing hit $2 targets.'],
  [/^暫停：(.+)$/, 'Paused: $1'],
  [/^移動中；停止後蓄能 (.+) 秒$/, 'Moving; stop to charge for $1s'],
  [/^(.+) 秒後自動發射$/, 'Auto-fire in $1s'],
  [/^自動六連射 (\d+)\/(\d+)$/, 'Automatic six-shot burst $1/$2'],
  [/^(.+) 秒後下一輪$/, 'Next burst in $1s'],
  [/^(.+)：能量不足。$/, '$1: not enough energy.'],
  [/^(.+)：目標不在 (\d+) px 近戰距離內。$/, '$1: target is outside the $2 px melee range.'],
  [/^(.+)：展示刀身順時針揮擊(.+)（目前沒有目標）。$/, '$1: demonstrating the clockwise blade swing$2 (no target present).'],
  [/^(.+) 輕量機槍 Lv\.(\d+)：固定方向六發連射。$/, '$1 Light Machine Gun Lv.$2: six-shot burst along one locked direction.'],
  [/^(.+) 被三叉戟 Lv\.(\d+) 暈眩 (.+) 秒。$/, '$1 was stunned by Trident Lv.$2 for $3s.'],
  [/^三叉戟 Lv\.(\d+) 命中：下次發射提前 (.+) 秒。$/, 'Trident Lv.$1 hit: next shot advanced by $2s.'],
  [/^小刀 Lv\.(\d+) 側刃$/, 'Knife Lv.$1 side blade'],
  [/^移動路徑・(.+)$/, 'Movement path · $1'],
  [/^(.+) 進入怒氣模式：攻擊冷卻縮短。$/, '$1 entered enrage: attack cooldowns shortened.'],
  [/^敵對生物。主要行動：(.+)。$/, 'Hostile creature. Primary actions: $1.'],
]);

function replaceTerms(value) {
  let output = value;
  Object.entries({ ...EXACT_ENGLISH, ...TERM_ENGLISH })
    .sort(([a], [b]) => b.length - a.length)
    .forEach(([source, target]) => { output = output.replaceAll(source, target); });
  return output
    .replaceAll('（', ' (').replaceAll('）', ')')
    .replaceAll('，', ', ').replaceAll('。', '.').replaceAll('；', '; ')
    .replaceAll('：', ': ').replaceAll('、', ', ').replaceAll('｜', ' | ')
    .replaceAll('／', ' / ');
}

export function translateGameplayText(value, language = getLanguage()) {
  const source = String(value ?? '');
  if (language === 'zh-Hant' || !CJK_PATTERN.test(source)) return source;
  const shared = translateText(source, language);
  if (shared !== source && !CJK_PATTERN.test(shared)) return shared;
  if (EXACT_ENGLISH[source]) return EXACT_ENGLISH[source];
  for (const [pattern, replacement] of SENTENCE_REPLACEMENTS) {
    if (pattern.test(source)) return replaceTerms(source.replace(pattern, replacement));
  }
  const translated = replaceTerms(source);
  return CJK_PATTERN.test(translated) ? 'English copy pending review' : translated;
}

function walkTextNodes(root, visit) {
  if (!root) return;
  if (root.nodeType === 3) { visit(root); return; }
  root.childNodes?.forEach((child) => walkTextNodes(child, visit));
}

export function installLiveLocalization(root = document) {
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const attributes = ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt'];
  let applying = false;

  function localizeTextNode(node, refreshSource = false) {
    if (!originalText.has(node) || refreshSource) originalText.set(node, node.nodeValue ?? '');
    const source = originalText.get(node);
    const next = translateGameplayText(source);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function localizeElement(element, refreshAttribute) {
    if (!element?.getAttribute) return;
    const stored = originalAttributes.get(element) ?? {};
    attributes.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      if (!(name in stored) || refreshAttribute === name) stored[name] = element.getAttribute(name);
      const next = translateGameplayText(stored[name]);
      if (element.getAttribute(name) !== next) element.setAttribute(name, next);
    });
    originalAttributes.set(element, stored);
  }

  function isAppliedTextMutation(node) {
    if (!originalText.has(node)) return false;
    return node.nodeValue === translateGameplayText(originalText.get(node));
  }

  function isAppliedAttributeMutation(element, attribute) {
    const stored = originalAttributes.get(element);
    if (!stored || !(attribute in stored)) return false;
    return element.getAttribute(attribute) === translateGameplayText(stored[attribute]);
  }

  function localizeTree(target, refreshSource = false) {
    applying = true;
    walkTextNodes(target, (node) => localizeTextNode(node, refreshSource));
    if (target?.nodeType === 1) localizeElement(target);
    target?.querySelectorAll?.('*').forEach((element) => localizeElement(element));
    if (root.documentElement) root.documentElement.lang = getLanguage();
    if (root.title) root.title = translateGameplayText(originalText.get(root.querySelector?.('title')?.firstChild) ?? root.title);
    applying = false;
  }

  localizeTree(root);
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver((mutations) => {
    if (applying) return;
    applying = true;
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData' && !isAppliedTextMutation(mutation.target)) localizeTextNode(mutation.target, true);
      if (mutation.type === 'attributes' && !isAppliedAttributeMutation(mutation.target, mutation.attributeName)) localizeElement(mutation.target, mutation.attributeName);
      mutation.addedNodes?.forEach((node) => localizeTree(node, true));
    });
    applying = false;
  });
  observer?.observe(root.documentElement ?? root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  const unsubscribe = subscribeLanguage(() => localizeTree(root));
  return () => { observer?.disconnect(); unsubscribe?.(); };
}

export function bindLanguageSelect(select) {
  if (!select) return () => {};
  select.value = getLanguage();
  const onChange = () => setLanguage(select.value);
  select.addEventListener('change', onChange);
  const unsubscribe = subscribeLanguage((language) => { select.value = language; });
  return () => { select.removeEventListener('change', onChange); unsubscribe?.(); };
}
