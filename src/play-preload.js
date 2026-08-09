import { WEAPONS } from './game-data.js';
import { PLAYER_ANIMATION_ASSETS } from './player-animation.js';
import { PLAY_ENEMY_ASSET_PATHS } from './play-enemies.js';
import { getPlayWorldAssetPaths } from './play-world-visuals.js';
import {
  PLAYER_HUD_ICON_FAMILIES,
  VISOR_HUD_ASSET,
  getPlayerHudIconPath,
} from './visor-hud.js';

export const PLAY_TILE_ASSETS = Object.freeze({
  'L-1': '/assets/editor/water/L-1.png',
  L0: '/assets/editor/water/L0.png',
  L1: '/assets/editor/water/L1.png',
  L2: '/assets/editor/water/L2.png',
  L3: '/assets/editor/water/L3.png',
  blocked: '/assets/editor/terrain/blocked-dark-stone.png',
});

export const PLAY_AWAKENING_SHUTTER_ASSET = '/assets/editor/hud/awakening-pressure-shutter.png';

export const PLAY_WEAPON_ASSET_PATHS = Object.freeze([...new Set(
  Object.values(WEAPONS).flatMap((weapon) => (
    Object.values(weapon.levels).map((level) => level.effect?.sprite).filter(Boolean)
  )),
)]);

export const PLAY_HUD_ASSET_PATHS = Object.freeze([
  VISOR_HUD_ASSET,
  PLAY_AWAKENING_SHUTTER_ASSET,
  '/assets/editor/hud/visor-surround-balanced.png',
  '/assets/editor/hud/slot-locked-octagon.png',
  ...Object.entries(PLAYER_HUD_ICON_FAMILIES).flatMap(([kind, families]) => (
    Object.keys(families).flatMap((id) => [1, 2, 3].map((level) => getPlayerHudIconPath(kind, id, level)))
  )),
]);

export const PLAY_BASE_IMAGE_ASSET_PATHS = Object.freeze([...new Set([
  ...Object.values(PLAYER_ANIMATION_ASSETS).flat(),
  ...Object.values(PLAY_TILE_ASSETS),
  ...getPlayWorldAssetPaths(),
  ...PLAY_WEAPON_ASSET_PATHS,
  ...PLAY_HUD_ASSET_PATHS,
].filter(Boolean))]);

export const PLAY_MAP_ASSET_URLS = Object.freeze({
  descent: Object.freeze({
    1: new URL('../maps/下沉篇/下沉篇-第1部分.json', import.meta.url).href,
    2: new URL('../maps/下沉篇/下沉篇-第2部分.json', import.meta.url).href,
    3: new URL('../maps/下沉篇/下沉篇-第3部分.json', import.meta.url).href,
  }),
  ascent: Object.freeze({
    1: new URL('../maps/上升篇/上升篇-第1部分.json', import.meta.url).href,
    2: new URL('../maps/上升篇/上升篇-第2部分.json', import.meta.url).href,
    3: new URL('../maps/上升篇/上升篇-第3部分.json', import.meta.url).href,
  }),
});

export const PLAY_IMAGE_ASSET_PATHS = Object.freeze([...new Set([
  ...PLAY_BASE_IMAGE_ASSET_PATHS,
  ...PLAY_ENEMY_ASSET_PATHS,
].filter(Boolean))]);

export const PLAY_STARTUP_ASSET_PATHS = Object.freeze([
  // The homepage transition must not decode the complete animation library.
  // Play creates those images after navigation; decoding them here as well
  // temporarily keeps two documents' worth of large bitmaps alive and can
  // starve the first gameplay frames. Only warm the assets needed to reveal
  // the map, diver and visor immediately.
  ...PLAYER_ANIMATION_ASSETS.swim,
  ...Object.values(PLAY_TILE_ASSETS),
  VISOR_HUD_ASSET,
  PLAY_AWAKENING_SHUTTER_ASSET,
  '/assets/editor/hud/visor-surround-balanced.png',
  '/assets/editor/hud/slot-locked-octagon.png',
  getPlayerHudIconPath('weapon', 'knife', 1),
  PLAY_MAP_ASSET_URLS.descent[1],
].filter(Boolean));
