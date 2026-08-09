import { editorT } from './i18n-editor.js';

export const EDITOR_PLAYABLE_MAPS = Object.freeze([
  Object.freeze({ id: 'descent-1', labelKey: 'map.official.part1', url: new URL('../maps/下沉篇/下沉篇-第1部分.json', import.meta.url).href }),
  Object.freeze({ id: 'descent-2', labelKey: 'map.official.part2', url: new URL('../maps/下沉篇/下沉篇-第2部分.json', import.meta.url).href }),
  Object.freeze({ id: 'descent-3', labelKey: 'map.official.part3', url: new URL('../maps/下沉篇/下沉篇-第3部分.json', import.meta.url).href }),
]);

export function getEditorPlayableMap(mapId) {
  return EDITOR_PLAYABLE_MAPS.find((entry) => entry.id === mapId) ?? null;
}

export function assertEditorMapDocument(value) {
  if (!value || typeof value !== 'object' || !value.cells || !value.edges || !value.chapterStates) {
    throw new Error(editorT('map.official.invalidDocument'));
  }
  return value;
}

export async function loadEditorPlayableMap(mapId, { fetchImpl = fetch } = {}) {
  const entry = getEditorPlayableMap(mapId);
  if (!entry) throw new Error(editorT('map.official.chooseFirst'));
  const response = await fetchImpl(entry.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(editorT('map.official.loadFailed', { status: response.status }));
  return assertEditorMapDocument(await response.json());
}

export async function saveEditorPlayableMap(mapId, map, { fetchImpl = fetch } = {}) {
  if (!getEditorPlayableMap(mapId)) throw new Error(editorT('map.official.chooseFirst'));
  assertEditorMapDocument(map);
  const response = await fetchImpl(`/api/editor/maps/${encodeURIComponent(mapId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map),
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error ?? ''; } catch { /* Static hosts do not return JSON. */ }
    throw new Error(detail || editorT('map.official.saveUnavailable'));
  }
  return response.json();
}

export function attachEditorPlayableMapControls(root, {
  applyMap,
  getMap,
  onSaved = () => {},
  setStatus = () => {},
  fetchImpl = fetch,
} = {}) {
  const select = root.querySelector('#official-map-select');
  const loadButton = root.querySelector('#load-official-map');
  const saveButton = root.querySelector('#save-official-map');
  if (!select || !loadButton || !saveButton) return null;

  let currentMapId = null;
  let busy = false;

  const refreshButtons = () => {
    const hasSelection = Boolean(getEditorPlayableMap(select.value));
    loadButton.disabled = busy || !hasSelection;
    saveButton.disabled = busy || !hasSelection || currentMapId !== select.value;
  };

  select.addEventListener('change', () => {
    currentMapId = null;
    refreshButtons();
  });

  loadButton.addEventListener('click', async () => {
    busy = true;
    refreshButtons();
    setStatus(editorT('map.official.loading'));
    try {
      const map = await loadEditorPlayableMap(select.value, { fetchImpl });
      applyMap(map);
      currentMapId = select.value;
      setStatus(editorT('map.official.loaded', { name: editorT(getEditorPlayableMap(currentMapId).labelKey) }));
    } catch (error) {
      setStatus(editorT('map.official.error', { message: error.message }));
    } finally {
      busy = false;
      refreshButtons();
    }
  });

  saveButton.addEventListener('click', async () => {
    busy = true;
    refreshButtons();
    setStatus(editorT('map.official.saving'));
    try {
      const map = getMap();
      await saveEditorPlayableMap(currentMapId, map, { fetchImpl });
      onSaved(currentMapId);
      setStatus(editorT('map.official.saved', { name: editorT(getEditorPlayableMap(currentMapId).labelKey) }));
    } catch (error) {
      setStatus(editorT('map.official.error', { message: error.message }));
    } finally {
      busy = false;
      refreshButtons();
    }
  });

  refreshButtons();
  return {
    clearCurrentMap() {
      currentMapId = null;
      refreshButtons();
    },
    getCurrentMapId: () => currentMapId,
  };
}
