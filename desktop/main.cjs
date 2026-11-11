// Ownling for Windows: the game in its own phone-sized window. The game's files ship inside the
// app (app/, built by `npm run build:windows` in ../app) and load from a private app:// address, so
// the app opens even if the website is down. Talking to Mochi still goes to the hosted kitchen.
const { app, BrowserWindow, Menu, nativeTheme, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'app');
const START = 'app://ownling/index.html';

// A standard, secure scheme gets its own origin, so local storage (where the player's key lives)
// and the browser's crypto work as they do on the website.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function serveAppFile(request) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

/** Links to other sites (the chain explorer, downloads) open in the normal browser. */
function openOutside(url) {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 430,
    height: 880,
    minWidth: 360,
    minHeight: 600,
    title: 'Ownling',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14161B' : '#F5F2EC',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://ownling/')) return;
    event.preventDefault();
    openOutside(url);
  });
  win.loadURL(START);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    protocol.handle('app', serveAppFile);
    // The only permission the game asks for is the microphone, for talking out loud.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'media'));
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
