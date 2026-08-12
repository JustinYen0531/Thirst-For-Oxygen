const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME_TYPES = Object.freeze({
  '.aiff': 'audio/aiff',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

function resolveRequestPath(webRoot, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  } catch {
    return null;
  }
  const normalized = path.posix.normalize(pathname.replaceAll('\\', '/'));
  const relative = (normalized === '/' ? '/index.html' : normalized).replace(/^\/+/, '');
  const root = path.resolve(webRoot);
  const resolved = path.resolve(root, relative);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? '');
  if (!match) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function sendFile(request, response, filePath, stat) {
  const range = request.headers.range ? parseRange(request.headers.range, stat.size) : null;
  if (request.headers.range && !range) {
    response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
    response.end();
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };
  if (range) {
    headers['Content-Length'] = range.end - range.start + 1;
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
    response.writeHead(206, headers);
  } else {
    headers['Content-Length'] = stat.size;
    response.writeHead(200, headers);
  }
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = fs.createReadStream(filePath, range ?? undefined);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

function startStaticServer(webRoot) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
      }
      const filePath = resolveRequestPath(webRoot, request.url ?? '/');
      if (!filePath) {
        response.writeHead(400);
        response.end('Bad request');
        return;
      }
      fs.stat(filePath, (error, stat) => {
        if (error || !stat.isFile()) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        sendFile(request, response, filePath, stat);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

let webServer;
let mainWindow;

async function createWindow() {
  const webRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.join(__dirname, '..', 'output', 'itch-stage');
  if (!webServer) webServer = await startStaticServer(webRoot);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#020d17',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(webServer.origin)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  await mainWindow.loadURL(`${webServer.origin}/`);
}

app.setAppUserModelId('io.itch.thirstforoxygen.game');
app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
app.on('before-quit', () => webServer?.server.close());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { parseRange, resolveRequestPath, startStaticServer };
