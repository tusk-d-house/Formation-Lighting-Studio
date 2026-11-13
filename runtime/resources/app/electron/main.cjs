const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const FIXED_PORT = 48921;

function tryListen(server, port) {
  return new Promise((resolve) => {
    let resolved = false;
    const onError = () => {
      if (resolved) return;
      resolved = true;
      server.removeListener('listening', onListening);
      resolve(null);
    };
    const onListening = () => {
      if (resolved) return;
      resolved = true;
      server.removeListener('error', onError);
      const addr = server.address();
      resolve(addr ? addr.port : null);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function startEmbeddedServer(distDir) {
  const createServer = () =>
    http.createServer((req, res) => {
      const safeUrl = (req.url || '/').split('?')[0];
      const relPath = safeUrl.replace(/^\/+/, '');
      let filePath = path.join(distDir, relPath === '' ? 'index.html' : relPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

  // 1. Try fixed port first so that browser localStorage origin is always consistent
  let server = createServer();
  let port = await tryListen(server, FIXED_PORT);
  if (port) return port;

  // 2. Fallback to dynamic port if fixed port is already in use
  server = createServer();
  port = await tryListen(server, 0);
  return port;
}

// Persistent storage path in app userData directory (%APPDATA%/FormationStudio)
function getUserDataProjectsPath() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'formation_studio_projects.json');
}

function getAudioStorageDir() {
  const dir = path.join(app.getPath('userData'), 'audio');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// IPC Handlers for Permanent Project Storage
ipcMain.handle('storage:load-projects', async () => {
  try {
    const filePath = getUserDataProjectsPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, projects: parsed };
      }
    }
    return { success: true, projects: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('storage:save-projects', async (event, { projectsJson }) => {
  try {
    const filePath = getUserDataProjectsPath();
    fs.writeFileSync(filePath, projectsJson, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handlers for Project Audio Persistence
ipcMain.handle('storage:save-audio', async (event, data) => {
  try {
    if (!data || !data.projectId) return { success: false, error: 'Missing projectId' };
    const dir = getAudioStorageDir();
    const filePath = path.join(dir, `${data.projectId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('storage:load-audio', async (event, { projectId }) => {
  try {
    if (!projectId) return { success: false, data: null };
    const dir = getAudioStorageDir();
    const filePath = path.join(dir, `${projectId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return { success: true, data: parsed };
    }
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('storage:delete-audio', async (event, { projectId }) => {
  try {
    if (!projectId) return { success: true };
    const dir = getAudioStorageDir();
    const filePath = path.join(dir, `${projectId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('storage:clone-audio', async (event, { sourceId, targetId }) => {
  try {
    if (!sourceId || !targetId) return { success: false };
    const dir = getAudioStorageDir();
    const srcFile = path.join(dir, `${sourceId}.json`);
    const dstFile = path.join(dir, `${targetId}.json`);
    if (fs.existsSync(srcFile)) {
      const raw = fs.readFileSync(srcFile, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.projectId = targetId;
      fs.writeFileSync(dstFile, JSON.stringify(parsed), 'utf8');
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handlers for File System Access & Dialogs
ipcMain.handle('dialog:open-project', async () => {
  const result = await dialog.showOpenDialog({
    title: 'プロジェクトファイル (.json) を開く',
    filters: [
      { name: 'Formation Studio Project (*.json)', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, content };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('dialog:save-project-as', async (event, { defaultFileName }) => {
  const result = await dialog.showSaveDialog({
    title: '名前を付けてプロジェクトを保存',
    defaultPath: defaultFileName || 'project.formation.json',
    filters: [
      { name: 'Formation Studio Project (*.json)', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
});

ipcMain.handle('fs:save-file', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:read-file', async (event, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 680,
    minWidth: 480,
    minHeight: 300,
    title: 'Formation & Lighting Studio',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.setMenuBarVisibility(false);

  // Handle window close confirmation if dirty
  let isClosingConfirmed = false;
  win.on('close', async (e) => {
    if (isClosingConfirmed) return;
    e.preventDefault();

    try {
      const isDirty = await win.webContents.executeJavaScript(
        'window.__isFormationProjectDirty ? window.__isFormationProjectDirty() : false'
      );

      if (isDirty) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['保存する', '保存せずに閉じる', 'キャンセル'],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
          title: 'Formation & Lighting Studio',
          message: '保存されていない変更があります',
          detail: 'プロジェクトに変更が加えられています。閉じる前に上書き保存しますか？',
        });

        if (response === 0) {
          // 保存する
          await win.webContents.executeJavaScript(
            'window.__saveFormationProject ? window.__saveFormationProject() : false'
          );
          isClosingConfirmed = true;
          win.close();
        } else if (response === 1) {
          // 保存せずに閉じる
          isClosingConfirmed = true;
          win.close();
        } else {
          // キャンセル: 閉じるのを中断
          return;
        }
      } else {
        isClosingConfirmed = true;
        win.close();
      }
    } catch {
      isClosingConfirmed = true;
      win.close();
    }
  });

  const distDir = path.join(__dirname, '../dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (process.env.VITE_DEV_SERVER === 'true') {
    win.loadURL('http://localhost:5173');
  } else {
    const port = await startEmbeddedServer(distDir);
    if (port) {
      win.loadURL(`http://127.0.0.1:${port}`).catch(() => {
        win.loadFile(indexHtmlPath);
      });
    } else {
      win.loadFile(indexHtmlPath);
    }
  }
}

function setupMacMenu() {
  if (process.platform !== 'darwin') return;
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'Formation & Lighting Studio について' },
        { type: 'separator' },
        { role: 'hide', label: '隠す' },
        { role: 'hideOthers', label: 'ほかを隠す' },
        { role: 'unhide', label: 'すべてを表示' },
        { type: 'separator' },
        { role: 'quit', label: '終了' },
      ],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべて選択' },
      ],
    },
    {
      label: 'ウィンドウ',
      submenu: [
        { role: 'minimize', label: 'しまう' },
        { role: 'zoom', label: '拡大/縮小' },
        { type: 'separator' },
        { role: 'front', label: 'すべてを手前に移動' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  setupMacMenu();
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
