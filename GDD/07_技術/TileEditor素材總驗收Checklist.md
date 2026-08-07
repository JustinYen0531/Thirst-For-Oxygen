# Tile Editor 素材總驗收 Checklist

> 目標：驗收 CSS 分層版六邊形 Tile Editor 所需的圖片素材。
>
> 六邊形外框、拼接線、選取狀態、座標、方向、章節濾鏡與潮流動畫由 CSS／SVG／程式處理，不生成固定 bitmap。

## 既有 Cell 水域底圖

- [x] [L3 深色水域](六邊形水域素材/L3-deep-water.png)
- [x] [L2 深藍過渡水域](六邊形水域素材/L2-transition-water.png)
- [x] [L1 一般藍色水域](六邊形水域素材/L1-standard-water.png)
- [x] [L0 中性色帶](六邊形水域素材/L0-neutral-band.png)
- [x] [L-1 淺色上浮水域](六邊形水域素材/L-1-rising-water.png)

## 第一批：Cell Overlay

### 珊瑚安全區

- [x] [coral-safe-zone-overlay.png](TileEditor素材/cell-overlays/coral-safe-zone-overlay.png)
- [x] 透明背景，能覆蓋單一六邊形 Cell。
- [x] 不遮住底下的水域顏色與 Cell 物件。
- [x] 傳達安全、保護與停止追擊，不使用文字。

### 墨水區

- [x] [ink-zone-overlay.png](TileEditor素材/cell-overlays/ink-zone-overlay.png)
- [x] 透明背景，能覆蓋單一六邊形 Cell。
- [x] 中心較暗、邊界仍可辨認，方便 CSS 疊加。
- [x] 不把整張圖片做成不可調整的純黑背景。

## 第一批：Cell Object

- [x] [coral-cluster.png](TileEditor素材/cell-objects/coral-cluster.png)
- [x] [deep-sea-mine.png](TileEditor素材/cell-objects/deep-sea-mine.png)
- [x] [heavy-stone.png](TileEditor素材/cell-objects/heavy-stone.png)
- [x] [sea-grass.png](TileEditor素材/cell-objects/sea-grass.png)
- [x] [torricelli-space.png](TileEditor素材/cell-objects/torricelli-space.png)
- [x] [photosynthesis-bubble.png](TileEditor素材/cell-objects/photosynthesis-bubble.png)
- [x] [oxygen-ore.png](TileEditor素材/cell-objects/oxygen-ore.png)
- [x] [checkpoint.png](TileEditor素材/cell-objects/checkpoint.png)

每一張 Cell Object 都必須：

- [x] 是透明背景的單一物件，不包含六邊形底圖。
- [x] 可放在六邊形 Cell 中央或由 CSS 調整位置。
- [x] 符合古文明工程草圖、深海石雕、幾何仿生與海水侵蝕風格。
- [x] 沒有角色、文字、Logo、水印或固定章節標籤。
- [x] 縮小到 Cell 尺寸後仍能辨認用途。

## 第二批：Edge Object

### 彈簧水母

- [x] [spring-jellyfish.png](TileEditor素材/edge-objects/spring-jellyfish.png)
- [x] 預設為水平 Edge 方向。
- [x] CSS 可旋轉到六個方向。
- [x] 物件主體與兩端接點清楚，不包含固定六邊形底圖。

### 通用尖刺／邊界障礙

- [x] [edge-spike-barrier.png](TileEditor素材/edge-objects/edge-spike-barrier.png)
- [x] 預設為水平 Edge 方向。
- [x] CSS 可旋轉到六個方向。
- [x] 只提供通用阻擋視覺，不綁定下降篇或上升篇章節材質。

## CSS／程式處理，不生成圖片

- [x] 六邊形外框與 `clip-path`。
- [x] Cell 之間的拼接線與中心節點。
- [x] Hover、選取、鎖定、無效放置與警告狀態。
- [x] 六個鄰居方向與座標顯示。
- [x] 潮流方向、強度與動畫。
- [x] 玩家、敵人、Mini Boss、Boss 出生點標記。
- [x] 第一章／第二章與原始／變異版本的 CSS 變數。

## 通用圖片驗收

- [x] 所有新增 PNG 都是 RGBA。
- [x] 所有新增 PNG 四角透明，沒有綠幕殘留。
- [x] Cell Object 與 Edge Object 不包含固定背景。
- [x] 所有素材沒有立體方塊側面或不必要的透視。
- [x] 所有素材可以透過 CSS `transform`、`opacity`、`filter` 與 `mix-blend-mode` 客製化。
- [x] 所有素材的生成檔案已加入 Git 並推送遠端。

## 本輪範圍

| 類別 | 預計數量 | 狀態 |
| --- | ---: | --- |
| 既有水域底圖 | 5 | 已完成 |
| Cell Overlay | 2 | 已完成 |
| Cell Object | 8 | 已完成 |
| Edge Object | 2 | 已完成 |
| CSS／SVG／程式狀態 | 不生成 bitmap | 由 Editor 實作 |
