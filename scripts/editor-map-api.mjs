import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const EDITOR_MAP_FILES = Object.freeze({
  'descent-1': 'maps/下沉篇/下沉篇-第1部分.json',
  'descent-2': 'maps/下沉篇/下沉篇-第2部分.json',
  'descent-3': 'maps/下沉篇/下沉篇-第3部分.json',
});

const MAX_MAP_BYTES = 20 * 1024 * 1024;

export function isEditorMapDocument(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.cells
    && typeof value.cells === 'object'
    && value.edges
    && typeof value.edges === 'object'
    && value.chapterStates
    && typeof value.chapterStates === 'object',
  );
}

export function getEditorMapFilePath(root, mapId) {
  const relativePath = EDITOR_MAP_FILES[mapId];
  if (!relativePath) throw new Error('Unknown playable map.');
  return resolve(root, relativePath);
}

export async function writeEditorMap(root, mapId, map) {
  if (!isEditorMapDocument(map)) throw new Error('Invalid map document.');
  const filePath = getEditorMapFilePath(root, mapId);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  return filePath;
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_MAP_BYTES) throw new Error('Map file is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createEditorMapApiPlugin({ root = process.cwd() } = {}) {
  return {
    name: 'thirst-for-oxygen-editor-map-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = request.url?.match(/^\/api\/editor\/maps\/([a-z0-9-]+)(?:\?.*)?$/);
        if (!match || request.method !== 'PUT') return next();

        try {
          const map = await readJsonBody(request);
          const mapId = decodeURIComponent(match[1]);
          await writeEditorMap(root, mapId, map);
          sendJson(response, 200, { ok: true, mapId });
        } catch (error) {
          const status = error instanceof SyntaxError ? 400 : 422;
          sendJson(response, status, { ok: false, error: error.message });
        }
      });
    },
  };
}
