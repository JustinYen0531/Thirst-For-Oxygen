import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguage as getSharedLanguage,
  setLanguage as setSharedLanguage,
  subscribeLanguage,
} from './i18n.js';

export const EDITOR_LANGUAGE_STORAGE_KEY = LANGUAGE_STORAGE_KEY;
export const EDITOR_LANGUAGES = Object.freeze(['en', 'zh-Hant']);

const messages = Object.freeze({
  en: Object.freeze({
    'page.title': 'Thirst for Oxygen — Map Editor',
    'header.title': 'Thirst for Oxygen — Map Editor',
    'status.ready': 'Ready to create a map.',
    'nav.home': 'Control Room', 'nav.play': 'Play', 'nav.encyclopedia': 'World Encyclopedia', 'nav.sandbox': 'Enemy Sandbox',
    'mode.edit': 'Edit', 'mode.play': 'Physics Test', 'mode.reset': 'Reset Test Player (R)', 'mode.fullscreen': 'Fullscreen (F)',
    'language.en': 'English', 'language.zh': 'Traditional Chinese',
    'tools.heading': 'Tools', 'tools.currentBrush': 'Current Brush',
    'tools.hint': 'Change water-object positioning below the eraser in the asset palette. Attach edge objects by clicking the shared hex edge.',
    'map.heading': 'Map', 'map.chapter': 'Chapter State', 'map.chapter1': 'Chapter 1: Descent', 'map.chapter2': 'Chapter 2: Ascent',
    'map.currentDirection': 'Current Direction', 'map.direction.e': 'East', 'map.direction.ne': 'Northeast', 'map.direction.nw': 'Northwest', 'map.direction.w': 'West', 'map.direction.sw': 'Southwest', 'map.direction.se': 'Southeast', 'map.currentStrength': 'Current Strength',
    'map.reset': 'Reset Blank Map', 'map.save': 'Save Locally', 'map.export': 'Export JSON', 'map.import': 'Import JSON', 'map.validate': 'Validate Map',
    'canvas.viewportAria': 'Scrollable map viewport', 'canvas.aria': 'Hex map editor', 'hud.playerAria': 'Test player status',
    'hud.oxygen': 'Oxygen', 'hud.energy': 'Energy', 'hud.health': 'Health',
    'play.help': 'Physics test: drag and release the player to launch. Oxygen drains over time; a full tank lasts about 40 seconds regardless of launch distance. E attaches to or leaves seaweed. R resets.',
    'zoom.label': 'Map Zoom',
    'map.growthHelp': 'Extend downward: select a full-cell water gravity or water-layer brush, then click a dashed cell below the map. Each extension preserves the last row and keeps four more dashed rows available. To paint T2 in bulk, select T2 and drag.',
    'palette.aria': 'Map asset palette', 'palette.heading': 'Place Assets Directly',
    'palette.description': 'Choose an asset, then place it on the canvas. Hold and drag to paint cell assets continuously. Water objects keep their own outline as the hitbox.',
    'palette.eraser': '⌫ Eraser', 'palette.eraserTitle': 'Remove nearby assets or Edges',
    'palette.placement': 'Water Object Position', 'palette.placementAria': 'Water object positioning mode', 'palette.free': 'Free Snap', 'palette.center': 'Hex Center',
    'palette.tabsAria': 'Asset categories', 'palette.tab.gravity': 'Water Gravity / Layer · Full Cell', 'palette.tab.overlay': 'Water Objects · Free Snap', 'palette.tab.actor': 'Actor / Spawn', 'palette.tab.edge': 'Edge Attachments · Edge Snap',
    'inspector.heading': 'Inspector', 'inspector.empty': 'No Cell, Edge, or water object selected.', 'validation.heading': 'Validation Results', 'validation.notRun': 'Not run yet.', 'events.heading': 'Test Events', 'events.empty': 'No events yet.',
    'action.chooseAsset': 'Choose this asset', 'action.viewUse': 'View asset purpose', 'action.back': 'Back',
    'dirty.unsaved': 'Not saved locally or exported as JSON.', 'dirty.saved': 'Saved in this browser.',
    'editor.ready': 'Editor ready. New maps start as blank L0 water; saved local versions survive refresh.',
    'official.default': 'Official default: {value}', 'official.restore': 'Restore Official Defaults',
    'tool.select': 'Select', 'tool.terrain': 'Terrain', 'tool.gravity': 'Gravity', 'tool.waterLayer': 'Water Layer', 'tool.overlay': 'Environment Effect', 'tool.object': 'Cell Object', 'tool.actor': 'Actor / Spawn', 'tool.edge': 'Edge Interaction', 'tool.erase': 'Eraser',
    'label.water': 'Passable Water', 'label.blocked': 'Blocked', 'label.L-1': 'Upward 1.0G (L-1)', 'label.L0': 'Zero Gravity (L0)', 'label.L1': 'Downward 1.0G (L1)', 'label.L2': 'Downward 1.5G (L2)', 'label.L3': 'Downward 2.0G (L3)', 'label.T1': 'Water Layer 1 (T1)', 'label.T2': 'Water Layer 2 (T2)', 'label.ink': 'Ink Zone', 'label.coralCluster': 'Coral Cluster', 'label.mine': 'Deep-sea Mine', 'label.weightStone': 'Weight Stone', 'label.seaweed': 'Seaweed', 'label.oxygen': 'Oxygen Ore', 'label.checkpoint': 'Checkpoint', 'label.bubble': 'Photosynthesis Bubble', 'label.torricelli': 'Torricelli Space', 'label.razor': 'Razor', 'label.button': 'One-shot Gate Button', 'label.conditionalGate': 'Conditional Gate (L1)', 'label.noGate': 'Not a Conditional Gate', 'label.buttonGate': 'Conditional Gate', 'label.once': 'Open Once', 'label.toggle': 'Toggle Gate', 'label.playerStart': 'Player Start', 'label.enemySpawn': 'Enemy Spawn', 'label.miniBossSpawn': 'Mini Boss', 'label.bossSpawn': 'Boss', 'label.none': 'Clear Edge', 'label.springJelly': 'Spring Jellyfish', 'label.spike': 'Spike Boundary', 'label.barrier': 'Barrier', 'label.current': 'Current', 'label.layerPortal': 'Layer Portal', 'label.multiPortal': 'Multi-edge Portal',
  }),
  'zh-Hant': Object.freeze({
    'page.title': 'Thirst for Oxygen — 地圖編輯器', 'header.title': 'Thirst for Oxygen — 地圖編輯器', 'status.ready': '準備建立地圖。',
    'nav.home': '主控台', 'nav.play': '遊玩', 'nav.encyclopedia': '世界圖鑑', 'nav.sandbox': '敵人沙盒',
    'mode.edit': '編輯', 'mode.play': '物理測試', 'mode.reset': '重設測試玩家 (R)', 'mode.fullscreen': '全螢幕 (F)',
    'language.en': 'English', 'language.zh': '繁中',
    'tools.heading': '工具', 'tools.currentBrush': '目前筆刷', 'tools.hint': '水域上物件的定位切換在下方素材調色盤的橡皮擦按鈕下面；邊緣沾黏物件請點兩格中間的六角邊。',
    'map.heading': '地圖', 'map.chapter': '章節狀態', 'map.chapter1': '第一章：下沉篇', 'map.chapter2': '第二章：上浮篇',
    'map.currentDirection': '潮流方向', 'map.direction.e': '東', 'map.direction.ne': '東北', 'map.direction.nw': '西北', 'map.direction.w': '西', 'map.direction.sw': '西南', 'map.direction.se': '東南', 'map.currentStrength': '潮流強度',
    'map.reset': '重設空白地圖', 'map.save': '儲存到本機', 'map.export': '匯出 JSON', 'map.import': '匯入 JSON', 'map.validate': '驗證地圖',
    'canvas.viewportAria': '可上下捲動的地圖鏡頭', 'canvas.aria': '六邊形地圖編輯器', 'hud.playerAria': '測試玩家狀態', 'hud.oxygen': '氧氣', 'hud.energy': '能量', 'hud.health': '生命值',
    'play.help': '物理測試：拖曳玩家並放開以彈射；氧氣以時間倒數，滿氧約 40 秒，不受彈射距離影響；E 附著／離開水草；R 重設。',
    'zoom.label': '地圖縮放', 'map.growthHelp': '向下開拓：選「水域重力・整格」或「水域層級・整格」後，直接點最下方虛線格；每次會沿用最底列並自動保留下一段 4 列虛線。要批量改 T2，選水域層級的 T2 後拖曳即可。',
    'palette.aria': '地圖素材調色盤', 'palette.heading': '直接放置素材', 'palette.description': '先點素材，再在畫布放置；格子素材按住拖曳可連續塗色，水域上物件仍以自身輪廓作為 hitbox。', 'palette.eraser': '⌫ 橡皮擦', 'palette.eraserTitle': '清除游標附近的素材或 Edge', 'palette.placement': '水域上物件定位', 'palette.placementAria': '水域上物件定位模式', 'palette.free': 'Free Snap', 'palette.center': '六邊形中央', 'palette.tabsAria': '素材分類', 'palette.tab.gravity': '水域重力／層級・整格', 'palette.tab.overlay': '水域上物件・Free Snap', 'palette.tab.actor': 'Actor／出生點', 'palette.tab.edge': '邊緣沾黏・Edge Snap',
    'inspector.heading': 'Inspector', 'inspector.empty': '未選取 Cell、Edge 或水域上物件。', 'validation.heading': '驗證結果', 'validation.notRun': '尚未執行。', 'events.heading': '測試事件', 'events.empty': '尚無事件。',
    'action.chooseAsset': '選擇此素材', 'action.viewUse': '查看素材用途', 'action.back': '返回', 'dirty.unsaved': '尚未儲存到本機或匯出 JSON。', 'dirty.saved': '已儲存到瀏覽器本機。', 'editor.ready': '編輯器已就緒；新地圖從空白 L0 水域開始，儲存後刷新會保留本機版本。', 'official.default': '官方預設：{value}', 'official.restore': '恢復官方預設',
    'tool.select': '選取', 'tool.terrain': '地形', 'tool.gravity': '重力', 'tool.waterLayer': '水域層級', 'tool.overlay': '環境效果', 'tool.object': 'Cell 物件', 'tool.actor': 'Actor／出生點', 'tool.edge': 'Edge 互動', 'tool.erase': '橡皮擦',
    'label.water': '可通行水域', 'label.blocked': '不可通行', 'label.L-1': '向上 1.0G（L-1）', 'label.L0': '零重力（L0）', 'label.L1': '向下 1.0G（L1）', 'label.L2': '向下 1.5G（L2）', 'label.L3': '向下 2.0G（L3）', 'label.T1': '水域第一層（T1）', 'label.T2': '水域第二層（T2）', 'label.ink': '墨水區', 'label.coralCluster': '珊瑚群落', 'label.mine': '深海地雷', 'label.weightStone': '重石', 'label.seaweed': '水草', 'label.oxygen': '氧氣礦石', 'label.checkpoint': 'Checkpoint', 'label.bubble': '光合作用氣泡', 'label.torricelli': '托里切利空間', 'label.razor': '剃刀', 'label.button': '一次性開門按鈕', 'label.conditionalGate': '條件通行門（L1）', 'label.noGate': '不是條件通行門', 'label.buttonGate': '條件通行門', 'label.once': '一次性開門', 'label.toggle': '開關門', 'label.playerStart': '玩家起點', 'label.enemySpawn': '敵人出生點', 'label.miniBossSpawn': 'Mini Boss', 'label.bossSpawn': 'Boss', 'label.none': '清除 Edge', 'label.springJelly': '彈簧水母', 'label.spike': '尖刺邊界', 'label.barrier': '通用邊界', 'label.current': '潮流', 'label.layerPortal': '層間轉接門', 'label.multiPortal': '多邊傳送門',
  }),
});

const rawEnglish = Object.freeze({
  '水域物件將放在六邊形正中央。': 'Water objects will be placed at the exact center of a hex.',
  '水域物件使用 Free Snap，可放在游標位置。': 'Water objects use Free Snap and are placed at the pointer position.',
  '尚未儲存到本機或匯出 JSON。': 'Not saved locally or exported as JSON.', '已儲存到瀏覽器本機。': 'Saved in this browser.', '已儲存地圖到本機。': 'Map saved locally.',
  '選擇此素材': 'Choose this asset', '查看素材用途': 'View asset purpose', '返回': 'Back',
  '已取消素材選取；可拖曳地圖，游標移到畫布會變成抓取手勢。': 'Asset selection cancelled. Drag to pan the map; the canvas cursor changes to a grab hand.',
  '大小': 'Size', '可見範圍': 'Visibility Radius', '傷害': 'Damage', '剃刀數量': 'Razor Count', '強制位移': 'Knockback Speed', '旋轉速度': 'Rotation Speed', '破壞所需速度': 'Break Speed', '重量下壓': 'Downward Weight', '提供氧氣': 'Oxygen Supplied', '釋放所需速度': 'Activation Speed', '免疫重力時間': 'Gravity Immunity Duration', '氧氣恢復速度': 'Oxygen Recovery Rate', '彈力倍率': 'Bounce Multiplier', '箭頭大小': 'Arrow Size', '階梯大小': 'Stair Size', '傳送門大小': 'Portal Size', '秒': 'seconds', '個': 'count', '倍': '×', '度/s': 'deg/s',
  '恢復官方預設': 'Restore Official Defaults', '水域層級': 'Water Layer', '通行狀態': 'Passage State', '按鈕模式': 'Button Mode',
  '此物件已使用官方預設建立；改動只影響這一個實例。': 'This object was created with official defaults. Changes affect only this instance.',
  '條件通行門是整格水域重力 Tile，固定為 L1。關閉時鎖鏈封住且不可通行；開啟後只會變亮並恢復 L1 水域效果。': 'A conditional gate is a full-cell L1 water tile. Chains block passage while closed; opening it restores the brighter L1 water effect.',
  '這一條是多邊傳送門的一段；同一群組的連續 Edge 會一起形成一大片。': 'This Edge is one segment of a multi-edge portal. Consecutive Edges in the same group form one portal side.',
  '大小與效果值只影響這一條 Edge；可隨時回到官方預設。': 'Size and effect values apply only to this Edge and can be restored at any time.',
  '開始拖曳連線': 'Start Drag Connection', '結束拖曳連線': 'Finish Drag Connection', '清除所有門連線': 'Clear All Gate Links', '開始拖曳連接另一端': 'Drag to Connect Other Side', '結束傳送門連線': 'Finish Portal Connection', '清除這大片的傳送連線': 'Clear This Portal Link',
  '未選取 Cell、Edge 或水域上物件。': 'No Cell, Edge, or water object selected.', '尚未執行。': 'Not run yet.', '尚無事件。': 'No events yet.',
  '物理測試已開始：拖曳玩家並放開以彈射。': 'Physics test started. Drag and release the player to launch.', '回到編輯模式。': 'Returned to edit mode.', '測試玩家已回到玩家起點。': 'Test player returned to player start.', '測試玩家已重設。': 'Test player reset.',
  '已重設為空白 24×17 地圖：全水域為 L0，沒有物件、Actor 或 Edge。': 'Reset to a blank 24×17 map: all water is L0, with no objects, Actors, or Edges.', '地圖驗證完成，沒有結構錯誤。': 'Map validation complete with no structural errors.', '已匯出 JSON 地圖檔。': 'Exported the JSON map file.', '格式缺少 cells、edges 或 chapterStates': 'The file is missing cells, edges, or chapterStates.',
  '請在地圖寬度內放置素材；地圖可以向下繼續延伸。': 'Place assets within the map width; the map can continue extending downward.', '水域上物件只能放在水域格。': 'Water objects can only be placed on water cells.', '這個六角形沒有可清除的素材。': 'This hex has no removable asset.', '這類素材只能放在可通行水域格。': 'This asset can only be placed on passable water.', '水域上物件現在是自由放置，不會吸附到這個六角格。': 'Water objects are in Free Snap mode and will not snap to this hex.', '這條六角邊沒有可清除的 Edge。': 'This hex edge has no removable Edge.',
  '層間轉接門只能放在 T1 與 T2 相鄰的共享六角邊。': 'Layer portals can only be placed on a shared edge between adjacent T1 and T2 cells.', '邊緣沾黏素材只能放在至少一側是不可通行障礙的六角邊。': 'Edge attachments require a hex edge with blocked terrain on at least one side.',
  '請從按鈕圖示拖曳到條件通行門；放開即可建立連線。': 'Drag from the button icon to a conditional gate and release to create a link.', '已結束按鈕連線模式。': 'Button-link mode ended.', '已清除這個按鈕的所有門連線。': 'Cleared all gate links from this button.', '連線未完成：請把線放在條件通行門的六邊形中央。': 'Link incomplete: release over the center of a conditional-gate hex.',
  '請從這一大片多邊傳送門拖曳到另一大片；放開後會按段一對一連接。': 'Drag from this multi-edge portal side to another side; release to pair segments one to one.', '已結束多邊傳送門連線模式。': 'Multi-edge portal link mode ended.', '連線未完成：請把線放在另一大片多邊傳送門的 Edge 上。': 'Link incomplete: release over an Edge on another multi-edge portal side.', '連線未完成：不能把同一大片傳送門連回自己。': 'Link incomplete: a portal side cannot connect to itself.', '已清除多邊傳送門連線；兩端仍保留，可重新配對。': 'Portal link cleared. Both sides remain available for pairing.',
  '請從已選取的多邊傳送門群組任一段開始拖曳連線。': 'Start dragging from any segment of the selected multi-edge portal group.', '請從已選取的按鈕圖示開始拖曳連線。': 'Start dragging from the selected button icon.',
  '已重新繪製傳送門段；原本的對應線已解除，請重新連接。': 'Portal segments were redrawn. The previous pairing was cleared; reconnect the sides.',
  '附近沒有可附著的水草。': 'No attachable seaweed nearby.', '已離開水草，重力重新生效。': 'Left the seaweed; gravity is active again.', '已附著邊緣水草：暫停重力並回復體力。': 'Attached to edge seaweed: gravity is paused and energy recovers.', '已附著水草：暫停重力並回復體力。': 'Attached to seaweed: gravity is paused and energy recovers.',
  '碰到測試區邊界：速度已反彈。': 'Hit the test boundary and bounced.', '多邊傳送門尚未連接另一端：入口暫時阻擋。': 'This multi-edge portal has no paired side, so the entrance is blocked.', '不可通行障礙物：已阻擋並反彈玩家。': 'Blocked terrain stopped and bounced the player.', '彈簧水母：依入射角反射並加速。': 'Spring jellyfish: reflected and accelerated along the impact angle.', '障礙 Edge 阻擋：速度已反彈。': 'Barrier Edge blocked passage and reflected velocity.', '不可通行障礙物：接觸邊界後反彈。': 'Blocked terrain reflected the player at the boundary.', '邊緣珊瑚群落：玩家處於保護範圍。': 'Edge coral cluster: the player is inside the protection radius.', '按鈕：已切換，但沒有可切換的條件通行門。': 'Button toggled, but no conditional gate could be changed.', '按鈕：已按下，但沒有可開啟的條件通行門。': 'Button pressed, but no conditional gate could be opened.', '剃刀：碰觸後被強制推開；珊瑚保護範圍抵銷了傷害。': 'Razor contact caused knockback; coral protection cancelled the damage.', '深海地雷：珊瑚群落保護範圍抵銷了傷害。': 'Deep-sea mine: coral protection cancelled the damage.', '重石已被足夠的撞擊力擊碎。': 'The weight stone shattered from sufficient impact.', '重石壓下玩家：撞擊力不足以擊碎。': 'The weight stone pushed the player downward; impact was too weak to break it.', 'Checkpoint：已更新重生點並回滿資源。': 'Checkpoint activated: respawn point updated and resources restored.', '墨水區：預覽視野受限。': 'Ink zone: preview visibility is restricted.', '地圖結構有效。': 'Map structure is valid.',
  '整格水域重力 Tile：固定為 L1。關閉時由鎖鏈交叉封住且不可通行；按鈕開啟後解除鎖鏈，顯示較亮的 L1 水域，不會複製其他格子的重力。': 'Full-cell water gravity tile fixed at L1. Crossed chains block passage while closed; its button removes the chains and reveals brighter L1 water without copying gravity from another cell.',
  '向上 1.0G：把角色往上推。': 'Upward 1.0G: pushes the player upward.', '零重力：保留慣性，不產生垂直加速度。': 'Zero gravity: preserves momentum without vertical acceleration.', '向下 1.0G：標準水域重力。': 'Downward 1.0G: standard water gravity.', '向下 1.5G：下沉更快。': 'Downward 1.5G: faster descent.', '向下 2.0G：最強下沉水域。': 'Downward 2.0G: strongest descending water.',
  '水域層級整格筆刷：選取後點擊或拖曳，直接把連續六邊形改成 T2；不必逐格開 Inspector。': 'Full-cell water-layer brush: click or drag to paint consecutive hexes as T2 without opening each Inspector.', '水域層級整格筆刷：選取後點擊或拖曳，直接把連續六邊形恢復成 T1。': 'Full-cell water-layer brush: click or drag to restore consecutive hexes to T1.',
  '不可通行：角色不能進入此 Cell。選擇任一水域重力 Tile 可把這格還原為可通行水域。': 'Blocked: the player cannot enter this Cell. Choose any water-gravity tile to restore passable water.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸時遮蔽角色周圍以外的視野。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; contact obscures vision outside the player\'s immediate area.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，角色接觸時造成傷害。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox and damages the player on contact.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，高速撞擊可破壞它。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; a high-speed impact can destroy it.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可補給。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; touch it to collect the supply.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可更新重生位置並恢復資源。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; touch it to update the respawn point and restore resources.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸可暫時免疫重力。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; contact grants temporary gravity immunity.',
  '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可獲得氧氣補給。': 'Water object: supports Free Snap or Hex Center. Its outline is the hitbox; touch it to receive oxygen.',
  '水域上物件：可切換 Free Snap／六邊形中央；放置後可在右側 Inspector 選 1–4 個剃刀，刀片繞中心軸旋轉並造成接觸傷害。': 'Water object: supports Free Snap or Hex Center. After placement, choose 1–4 blades in the Inspector; they rotate around the center axis and deal contact damage.',
  '水域上物件：碰觸後只按下這一次，開啟右側 Inspector 指定的條件通行門。每個按鈕可以指定多個門。': 'Water object: activates once on contact and opens conditional gates assigned in the Inspector. One button may target multiple gates.',
  '出生點：放置該類 Actor 的起始位置。': 'Spawn marker: places the starting position for this Actor type.',
  '邊緣沾黏：清除兩格之間既有的邊緣物件。': 'Edge attachment: clears the existing edge object between two cells.', '邊緣沾黏：固定在兩格中間的六角邊；角色越過時反彈。通常放在不可通行障礙旁。': 'Edge attachment: anchors to the shared hex edge and bounces the player when crossed. Usually placed beside blocked terrain.', '邊緣沾黏：固定在兩格中間的六角邊，阻擋角色通過。通常放在不可通行障礙旁。': 'Edge attachment: anchors to the shared hex edge and blocks passage. Usually placed beside blocked terrain.', '邊緣沾黏：固定在兩格中間的六角邊，依左側設定的方向與強度推動角色。': 'Edge attachment: anchors to the shared hex edge and pushes the player using the direction and strength set on the left.',
  '層間轉接門：只能放在 T1 與 T2 相鄰的共享邊；玩家通過後即可進入另一個水域層。': 'Layer portal: place only on a shared edge between adjacent T1 and T2 cells; crossing enters the other water layer.',
  '多邊傳送門：按住滑鼠拖過貼著黑色不可通行六角形的連續邊，可畫出一整端；再畫另一端，從右側 Inspector 開始拖曳連線，畫面只顯示一條大範圍總線，兩端仍會逐段一對一傳送。': 'Multi-edge portal: drag across consecutive edges attached to blocked black hexes to draw one side, then draw the other. Connect them from the Inspector; one broad link is shown while segments teleport one to one.',
  '邊緣沾黏：以底座貼在六角邊，優先朝可通行水域一側伸出。物理測試按 E 可附著或離開。': 'Edge attachment: anchors its base to the hex edge and extends toward passable water. Press E in the physics test to attach or leave.', '邊緣沾黏：以底座貼在六角邊，優先朝可通行水域一側伸出。': 'Edge attachment: anchors its base to the hex edge and extends toward passable water.',
  '邏輯上是通用障礙；目前共用 edge-spike-barrier.png，沒有獨立 barrier 圖。': 'This is a generic logical barrier. It currently shares edge-spike-barrier.png because no separate barrier image exists.', '潮流是程式化方向與強度工具，不使用 bitmap。': 'Current is a procedural direction-and-strength tool and does not use a bitmap.', '清除 Edge 的操作，不是素材。': 'Clear Edge is an editor action, not an asset.', '多邊傳送門使用 imagegen 生成的透明 Edge 段，必須貼在黑色不可通行障礙物邊上；只有完成另一端連線後才會啟用。': 'The multi-edge portal uses transparent generated Edge segments. It must attach to blocked black terrain and activates only after its other side is connected.', '出生點是編輯器語意標記，不是本輪生成的靜態素材。': 'Spawn points are semantic editor markers, not static art assets.', '地形狀態工具；水域外觀由重力水域素材與畫布底圖處理。': 'Terrain state tool; water appearance comes from gravity-water assets and the canvas background.',
  '無效門': 'Invalid Gate', '已連接：尚未指定條件通行門。': 'Connected: no conditional gate assigned.', '中央放置': 'centered placement', '自由放置': 'free placement', '生命歸零': 'Health reached zero',
  '尚未放置玩家起點；物理測試會使用預設位置。': 'No player start has been placed; the physics test will use its default position.',
});

const dynamicRules = [
  [/^已選擇工具：(.+)$/, ([, value]) => `Selected tool: ${translateEditorText(value, 'en')}`],
  [/^已選取 Cell (.+)$/, ([, key]) => `Selected Cell ${key}`], [/^已選取 Edge (.+)$/, ([, key]) => `Selected Edge ${key}`],
  [/^拖曳繪製 Edge：已連續套用(.+)。$/, ([, value]) => `Edge drag: repeatedly applied ${translateEditorText(value, 'en')}.`],
  [/^已建立 (.+) 連線；可繼續拖曳到其他門。$/, ([, gate]) => `Linked ${gate}; keep dragging to link more gates.`],
  [/^連線未完成：兩端必須有相同數量的 Edge（目前 (\d+) 對 (\d+)）。$/, ([, first, second]) => `Link incomplete: both portal sides need the same number of Edges (currently ${first} vs ${second}).`],
  [/^多邊傳送門已連接：(\d+) 條 Edge 一對一對應。$/, ([, count]) => `Multi-edge portal connected with ${count} one-to-one Edge pair(s).`],
  [/^已建立多邊傳送關係：(\d+) 條 Edge 會逐段傳送。$/, ([, count]) => `Multi-edge portal link created; ${count} Edge segment(s) will teleport one to one.`],
  [/^已清除這大片多邊傳送門的對應連線（(\d+) 條 Edge）。$/, ([, count]) => `Cleared the link for this multi-edge portal side (${count} Edge segment(s)).`],
  [/^已將既有(.+)轉為可調整的 Free Snap 物件。$/, ([, value]) => `Converted the existing ${translateEditorText(value, 'en')} into an adjustable Free Snap object.`],
  [/^已選取(.+)；可在右側調整參數。$/, ([, value]) => `Selected ${translateEditorText(value, 'en')}; adjust its parameters in the Inspector.`],
  [/^已恢復(.+)的官方預設。$/, ([, value]) => `Restored official defaults for ${translateEditorText(value, 'en')}.`],
  [/^已調整(.+)參數。$/, ([, value]) => `Adjusted parameters for ${translateEditorText(value, 'en')}.`],
  [/^(.+) 已恢復水域層級與條件通行設定官方預設。$/, ([, key]) => `${key} restored official water-layer and conditional-gate defaults.`],
  [/^(.+) 已標記為條件通行門；按鈕可指定這個 Cell。$/, ([, key]) => `${key} is now a conditional gate that buttons can target.`],
  [/^(.+) 已切換為 (.+)。$/, ([, key, layer]) => `${key} switched to ${translateEditorText(layer, 'en')}.`],
  [/^已連接：(.+)$/, ([, targets]) => `Connected: ${targets.replaceAll('、', ', ')}`],
  [/^群組 (.+)：(\d+) 條 Edge，已連到 (.+)。$/, ([, group, count, target]) => `Group ${group}: ${count} Edge segment(s), connected to ${target}.`],
  [/^群組 (.+)：(\d+) 條 Edge，尚未連接另一端。$/, ([, group, count]) => `Group ${group}: ${count} Edge segment(s), not connected to another side.`],
  [/^已(中央放置|自由放置)(.+)；右側 Inspector 可調整參數或回復官方預設。$/, ([, placement, value]) => `${placement === '中央放置' ? 'Centered' : 'Freely placed'} ${translateEditorText(value, 'en')}; adjust parameters or restore defaults in the Inspector.`],
  [/^已清除(.+)。$/, ([, value]) => `Removed ${translateEditorText(value, 'en')}.`],
  [/^(.+) 已套用 (.+)。$/, ([, key, value]) => `${key} applied ${translateEditorText(value, 'en')}.`],
  [/^拖曳塗色：已連續套用(.+)「(.+)」。$/, ([, tool, value]) => `Drag paint: repeatedly applied ${translateEditorText(tool, 'en')} “${translateEditorText(value, 'en')}”.`],
  [/^(.+) 已加入多邊傳送門；完成另一端後可在 Inspector 拖曳連接。$/, ([, key]) => `${key} was added to a multi-edge portal. Draw the other side, then connect it in the Inspector.`],
  [/^已切換為(.+)。$/, ([, value]) => `Switched to ${translateEditorText(value, 'en')}.`],
  [/^地圖驗證完成：(\d+) 項錯誤。$/, ([, count]) => `Map validation complete: ${count} error(s).`],
  [/^已匯入 (.+)。$/, ([, file]) => `Imported ${file}.`], [/^匯入失敗：(.+)$/, ([, reason]) => `Import failed: ${translateEditorText(reason, 'en')}`],
  [/^已從虛線框向下擴充地圖至 (\d+) 列。$/, ([, rows]) => `Extended the map downward to ${rows} rows from the dashed guide.`],
  [/^官方預設：(.+)$/, ([, value]) => `Official default: ${translateEditorText(value, 'en')}`],
  [/^(.+)・可調參數$/, ([, value]) => `${translateEditorText(value, 'en')} · Adjustable Parameters`],
  [/^生命歸零：最後一條命已失去，永久死亡；請重新開始物理測試。$/, () => 'Health reached zero: the final life was lost permanently. Restart the physics test.'],
  [/^生命歸零：失去 1 條命，剩餘 (\d+) 條命，已回到最近 Checkpoint。$/, ([, lives]) => `Health reached zero: lost one life, ${lives} remaining, and returned to the latest Checkpoint.`],
  [/^彈射初速度：(\d+) px\/s；能量 -(\d+)。氧氣改為時間倒數，滿氧約 40 秒。$/, ([, speed, energy]) => `Launch speed: ${speed} px/s; energy -${energy}. Oxygen drains over time and lasts about 40 seconds when full.`],
  [/^快速向上彈射：(\d+) px\/s；能量 -(\d+)。氧氣改為時間倒數，滿氧約 40 秒。$/, ([, speed, energy]) => `Quick upward launch: ${speed} px/s; energy -${energy}. Oxygen drains over time and lasts about 40 seconds when full.`],
  [/^(氧氣|能量)不足：無法(.+)。$/, ([, resource, action]) => `${translateEditorText(resource, 'en')} is insufficient; cannot ${action === '快速彈射' ? 'quick-launch' : 'launch'}.`],
  [/^多邊傳送門：已傳送至另一端 Edge（(.+)）。$/, ([, edge]) => `Multi-edge portal: teleported to paired Edge (${edge}).`],
  [/^水域層級邊界：(.+) 與 (.+) 之間沒有層間轉接門。$/, ([, a, b]) => `Water-layer boundary: no layer portal connects ${a} and ${b}.`],
  [/^層間轉接門：已從 (.+) 進入 (.+)。$/, ([, a, b]) => `Layer portal: moved from ${a} to ${b}.`],
  [/^尖刺阻擋：反彈並受到 (.+) 點傷害。$/, ([, damage]) => `Spike boundary: bounced and took ${damage} damage.`],
  [/^按鈕：已(切換|開啟) (\d+) 個條件通行門。$/, ([, action, count]) => `Button ${action === '切換' ? 'toggled' : 'opened'} ${count} conditional gate(s).`],
  [/^剃刀：碰觸後被強制推開並受到 (.+) 點傷害。$/, ([, damage]) => `Razor contact caused knockback and ${damage} damage.`],
  [/^深海地雷：強力反彈並受到 (.+) 點傷害。$/, ([, damage]) => `Deep-sea mine caused a strong bounce and ${damage} damage.`],
  [/^氧氣礦石：撞擊後釋放 (.+) O₂。$/, ([, amount]) => `Oxygen ore released ${amount} O₂ on impact.`],
  [/^氧氣礦石：需要 (.+) px\/s 撞擊才會釋放氧氣。$/, ([, speed]) => `Oxygen ore requires an impact of ${speed} px/s to release oxygen.`],
  [/^托里切利空間：以 (.+) O₂\/s 回復氧氣。$/, ([, rate]) => `Torricelli space restores oxygen at ${rate} O₂/s.`],
  [/^光合作用氣泡：\+(.+) O₂，(.+) 秒免疫水域重力。$/, ([, amount, duration]) => `Photosynthesis bubble: +${amount} O₂ and ${duration} seconds of gravity immunity.`],
  [/^氧氣耗盡：生命 -(.+)，請尋找氧氣補給。$/, ([, damage]) => `Oxygen depleted: health -${damage}. Find an oxygen supply.`],
  [/^重複 Cell 座標：(.+)$/, ([, value]) => `Duplicate Cell coordinate: ${value}`],
  [/^Cell key 與座標不一致：(.+)$/, ([, key]) => `Cell key does not match its coordinate: ${key}`],
  [/^(.+) 的地形無效：(.+)$/, ([, key, value]) => `${key} has invalid terrain: ${value}`],
  [/^(.+) 的 gravityLevel 無效：(.+)$/, ([, key, value]) => `${key} has an invalid gravityLevel: ${value}`],
  [/^(.+) 的 waterLayer 無效：(.+)$/, ([, key, value]) => `${key} has an invalid waterLayer: ${value}`],
  [/^(.+) 的條件通行門資料無效。$/, ([, key]) => `${key} has invalid conditional-gate data.`],
  [/^(.+) 條件通行門已開啟，但地形仍不是可通行水域。$/, ([, key]) => `${key} is an open conditional gate, but its terrain is not passable water.`],
  [/^(.+) 條件通行門必須固定使用 L1 水域重力。$/, ([, key]) => `${key} is a conditional gate and must use L1 water gravity.`],
  [/^(.+) 條件通行門尚未開啟，但地形不是不可通行。$/, ([, key]) => `${key} is a closed conditional gate, but its terrain is not blocked.`],
  [/^(.+) 不可通行，不能放置玩家起點。$/, ([, key]) => `${key} is blocked and cannot contain a player start.`],
  [/^(.+) 有未知 (Actor|物件|自由物件)：(.+)$/, ([, key, kind, value]) => `${key} has an unknown ${kind === 'Actor' ? 'Actor' : kind === '物件' ? 'object' : 'free object'}: ${value}`],
  [/^(.+) 的按鈕模式無效：(.+)。$/, ([, key, value]) => `${key} has an invalid button mode: ${value}.`],
  [/^(.+) 的按鈕沒有指定條件通行門。$/, ([, key]) => `${key} button has no conditional-gate target list.`],
  [/^(.+) 的按鈕指定了不存在的門：(.+)。$/, ([, key, gate]) => `${key} button targets a missing gate: ${gate}.`],
  [/^(.+) 的按鈕目標 (.+) 尚未標成條件通行門。$/, ([, key, gate]) => `${key} button target ${gate} is not marked as a conditional gate.`],
  [/^(.+) 的自由物件缺少有效位置：(.+)$/, ([, key, value]) => `${key} free object has no valid position: ${value}`],
  [/^孤立 Edge：(.+)$/, ([, key]) => `Orphaned Edge: ${key}`], [/^Edge 並非相鄰 Cell：(.+)$/, ([, key]) => `Edge does not connect adjacent Cells: ${key}`],
  [/^(.+) 的 Edge 類型無效：(.+)$/, ([, key, value]) => `${key} has an invalid Edge type: ${value}`],
  [/^(.+) 的多邊傳送門缺少群組編號。$/, ([, key]) => `${key} multi-edge portal is missing a group ID.`],
  [/^(.+) 的多邊傳送門缺少有效順序。$/, ([, key]) => `${key} multi-edge portal is missing a valid segment order.`],
  [/^(.+) 的多邊傳送門指定了不存在的對應 Edge。$/, ([, key]) => `${key} multi-edge portal targets a missing Edge.`],
  [/^(.+) 的多邊傳送門目標不是多邊傳送門。$/, ([, key]) => `${key} multi-edge portal target is not a multi-edge portal.`],
  [/^玩家起點有 (\d+) 個；物理測試會使用第一個。$/, ([, count]) => `There are ${count} player starts; the physics test will use the first.`],
];

export function normalizeEditorLanguage(value) {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'zh' || normalized === 'zh-tw' || normalized === 'zh-hant' ? 'zh-Hant' : DEFAULT_LANGUAGE;
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

let language = normalizeEditorLanguage(getSharedLanguage());
const listeners = new Set();

export function getEditorLanguage() { return language; }

export function editorT(key, params = {}, requestedLanguage = language) {
  const locale = normalizeEditorLanguage(requestedLanguage);
  const template = messages[locale]?.[key] ?? messages.en[key] ?? key;
  return interpolate(template, params);
}

export function translateEditorText(value, requestedLanguage = language) {
  const text = String(value ?? '');
  if (normalizeEditorLanguage(requestedLanguage) === 'zh-Hant' || !/[一-龥]/.test(text)) return text;
  if (rawEnglish[text]) return rawEnglish[text];
  const messageKey = Object.keys(messages['zh-Hant']).find((key) => messages['zh-Hant'][key] === text);
  if (messageKey) return messages.en[messageKey] ?? text;
  for (const [pattern, format] of dynamicRules) {
    const match = text.match(pattern);
    if (match) return format(match);
  }
  return text;
}

export function applyEditorTranslations(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const locale = language;
  if (root.documentElement) root.documentElement.lang = locale === 'zh-Hant' ? 'zh-Hant' : 'en';
  root.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = editorT(node.dataset.i18n); });
  ['aria-label', 'title', 'placeholder'].forEach((attribute) => {
    const datasetKey = `i18n${attribute.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`;
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => { node.setAttribute(attribute, editorT(node.dataset[datasetKey])); });
  });
  root.querySelectorAll('[data-editor-language]').forEach((node) => {
    node.setAttribute('aria-pressed', String(normalizeEditorLanguage(node.dataset.editorLanguage) === locale));
  });
}

export function translateEditorTree(root) {
  if (!root || language === 'zh-Hant') return;
  const walker = root.ownerDocument?.createTreeWalker?.(root, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
  if (walker) {
    while (walker.nextNode()) walker.currentNode.nodeValue = translateEditorText(walker.currentNode.nodeValue);
  }
  root.querySelectorAll?.('[aria-label], [title], [placeholder]').forEach((node) => {
    ['aria-label', 'title', 'placeholder'].forEach((attribute) => {
      if (node.hasAttribute(attribute)) node.setAttribute(attribute, translateEditorText(node.getAttribute(attribute)));
    });
  });
}

export function setEditorLanguage(nextLanguage, options = {}) {
  const next = normalizeEditorLanguage(nextLanguage);
  if (Object.hasOwn(options, 'storage')) options.storage?.setItem?.(EDITOR_LANGUAGE_STORAGE_KEY, next);
  else setSharedLanguage(next);
  if (next === language) return language;
  language = next;
  listeners.forEach((listener) => listener(language));
  return language;
}

subscribeLanguage((nextLanguage) => {
  const next = normalizeEditorLanguage(nextLanguage);
  if (next === language) return;
  language = next;
  listeners.forEach((listener) => listener(language));
});

export function onEditorLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createEditorI18n({ storage = null, getLanguage = null, setLanguage = null, subscribe = null } = {}) {
  return {
    getLanguage: () => normalizeEditorLanguage(getLanguage?.() ?? storage?.getItem?.(EDITOR_LANGUAGE_STORAGE_KEY)),
    setLanguage: (next) => {
      const normalized = normalizeEditorLanguage(next);
      if (setLanguage) setLanguage(normalized);
      else storage?.setItem?.(EDITOR_LANGUAGE_STORAGE_KEY, normalized);
      return normalized;
    },
    subscribe: (listener) => subscribe?.((next) => listener(normalizeEditorLanguage(next))) ?? (() => {}),
    t: (key, params = {}, locale = null) => editorT(key, params, locale ?? getLanguage?.() ?? storage?.getItem?.(EDITOR_LANGUAGE_STORAGE_KEY)),
  };
}

if (globalThis.addEventListener) {
  globalThis.addEventListener('storage', (event) => {
    if (event.key === EDITOR_LANGUAGE_STORAGE_KEY) setEditorLanguage(event.newValue, { storage: null });
  });
}
