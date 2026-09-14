import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { getConfigSync } from '../config';
import { ConfigurationState } from 'src/renderer/types';
export default {
  initialize() {
    const config = getConfigSync();

    ipcMain.handle(
      'readFile',
      async (event: Electron.IpcMainInvokeEvent, filePath: string) => {
        try {
          const fileContent: string = await fs.readFile(filePath, 'utf-8');
          return fileContent;
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to read file: ${error.message}`);
          } else {
            throw new Error(`Failed to read file: ${String(error)}`);
          }
        }
      },
    );

    ipcMain.handle(
      'writeFile',
      async (_event, filePath: string, data: string) => {
        try {
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true }); // Creates recursively folders if needed
          await fs.writeFile(filePath, data, 'utf-8');
          return { success: true, message: 'File written successfully' };
        } catch (err) {
          console.error('Error writing file:', err);
          return { success: false, message: err.message };
        }
      },
    );

    ipcMain.handle(
      'getFilePathDialog',
      async (event: Electron.IpcMainInvokeEvent, type: string) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          filters: [
            { name: `${type.toLocaleUpperCase()} File`, extensions: [type] },
          ],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          return result.filePaths[0];
        }

        return null;
      },
    );

    ipcMain.handle(
      'selectFolder',
      async (event: Electron.IpcMainInvokeEvent) => {
        const win = BrowserWindow.fromWebContents(event.sender);

        if (!win) return null;

        const result = await dialog.showOpenDialog(win, {
          properties: ['openDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0]; // return selected filepath
      },
    );

    ipcMain.handle('listFiles', async (_event, dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to read files in folder: ${error.message}`);
        } else {
          throw new Error(`Failed to read files in folder: ${String(error)}`);
        }
      }
    });

    ipcMain.handle('saveAsDialog', async (event, name: string, ext: string) => {
      if (process.env.E2E_TEST === 'true') {
        // For E2E tests, we save to a temporary file
        return `/tmp/${name}.${ext}`;
      }

      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win, {
        title: 'Save As',
        defaultPath: name,
        filters: [{ name: `${ext} files`, extensions: [ext] }],
      });
      if (!result.canceled && result.filePath) {
        return result.filePath;
      }

      return null;
    });

    ipcMain.handle('getConfig', async () => {
      return config;
    });

    ipcMain.handle(
      'setTestState',
      async (event, testState: Partial<ConfigurationState>) => {
        const win = BrowserWindow.getAllWindows()[0]; // ou autre moyen d'avoir ta fenêtre principale
        if (win) {
          win.webContents.send('updateTestState', testState);
          return true;
        }
        return false;
      },
    );

    ipcMain.handle('getTestState', async () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return null;

      return new Promise<ConfigurationState>((resolve) => {
        const replyChannel = 'getTestState:reply';

        const listener = (
          _event: Electron.IpcMainEvent,
          state: ConfigurationState,
        ) => {
          ipcMain.removeListener(replyChannel, listener);
          resolve(state);
        };

        ipcMain.on(replyChannel, listener);
        win.webContents.send('getTestState', replyChannel);
      });
    });

    ipcMain.handle('getHomePath', () => {
      return app.getPath('home');
    });

    ipcMain.handle('getPathFromRessources', (event, folderSteps: string[]) => {
      const templatesPath =
        process.env.NODE_ENV === 'development'
          ? path.join(app.getAppPath(), '..', ...folderSteps) // root in dev
          : path.join(process.resourcesPath, ...folderSteps); // resources/ in prod
      return templatesPath;
    });
  },
};
