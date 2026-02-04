import { app, BrowserWindow, session, dialog } from 'electron';
import { createWindow } from './window';
import ipc from './ipc';
import { config } from 'dotenv';
import { BackendManager } from './backend-manager';
import fs from 'fs';
import path from 'path';

const ensureCwd = (): void => {
  try {
    const current = process.cwd();
    if (!fs.existsSync(current)) {
      throw new Error('cwd does not exist');
    }
  } catch {
    const fallback = app.getPath('userData');
    fs.mkdirSync(fallback, { recursive: true });
    process.chdir(fallback);
  }
};

ensureCwd();
config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const isSquirrelStartup: boolean = require('electron-squirrel-startup');

if (isSquirrelStartup) {
  app.quit();
}

const backendManager = new BackendManager();

app.whenReady().then(async () => {
  console.info('App is ready, environment:', process.env.NODE_ENV);

  const backendResult = await backendManager.startBackend();

  if (!backendResult.success) {
    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Backend Startup Failed',
      message: 'Failed to start the backend server.',
      detail: 'Check the console for detailed error messages.',
      buttons: ['Continue Anyway', 'Exit'],
      defaultId: 1,
    });

    if (response.response === 1) {
      app.quit();
      return;
    }
  } else {
    console.info(`Backend server started successfully at ${backendResult.url}`);
    // Store backend URL in environment for the renderer process to access
    process.env.IBEX_BACKEND_URL = backendResult.url;
  }

  createWindow();

  ipc.initialize();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': '',
      },
    });
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    backendManager.stopBackend();
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  console.info('Application is quitting, stopping backend...');
  await backendManager.stopBackend();
});
