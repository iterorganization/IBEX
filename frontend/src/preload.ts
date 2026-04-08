// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { ConfigurationState } from './renderer/types';
import { contextBridge, ipcRenderer } from 'electron';

const STUB_BACKEND_FUNCTIONS = process.env.E2E_TEST;

export const stubDataStorage: {
  lastReaddenFilePath?: string;
  lastWrittenFilePath?: string;
  lastWrittenFileContent?: string;
  trashStringValue?: string;
} = {};

export const API = {
  fs: {
    readFile: STUB_BACKEND_FUNCTIONS
      ? // Stub function for E2E tests
        async (filePath: string): Promise<string> => {
          if (filePath.includes('PlotKineticProfilesIbexState.json')) {
            // We are in the template E2E test, so we return the real template content
            return ipcRenderer.invoke('readFile', filePath);
          }
          stubDataStorage.lastReaddenFilePath = filePath;
          return stubDataStorage.lastWrittenFileContent;
        }
      : // Real function
        (filePath: string) => ipcRenderer.invoke('readFile', filePath),

    writeFile: STUB_BACKEND_FUNCTIONS
      ? // Stub function for E2E tests
        async (path: string, data: string) => {
          stubDataStorage.lastWrittenFileContent = data;
          stubDataStorage.lastWrittenFilePath = path;
        }
      : // Real function
        (path: string, data: string) =>
          ipcRenderer.invoke('writeFile', path, data),

    getFilePathDialog: STUB_BACKEND_FUNCTIONS
      ? // Stub function for E2E tests
        async (type: string) => {
          stubDataStorage.trashStringValue = type;
          return '/stub/path/for/configuration.json';
        }
      : // Real function
        (type: string) => ipcRenderer.invoke('getFilePathDialog', type),

    selectFolder: () => ipcRenderer.invoke('selectFolder'),

    listFiles: (dirPath: string) => ipcRenderer.invoke('listFiles', dirPath),

    saveAsDialog: STUB_BACKEND_FUNCTIONS
      ? // Stub function for E2E tests
        async (name: string, ext: string) => {
          stubDataStorage.trashStringValue = name;
          stubDataStorage.trashStringValue = ext;
          return '/stub/path/for/configuration.json';
        }
      : // Real function
        (name: string, ext: string) =>
          ipcRenderer.invoke('saveAsDialog', name, ext),

    getHomePath: async () => await ipcRenderer.invoke('getHomePath'),

    getDefaultTemplatesPath: async () =>
      await ipcRenderer.invoke('getPathFromRessources', ['templates']),

    getZenodoDataPath: async () =>
      await ipcRenderer.invoke('getPathFromRessources', ['e2e_datasets']),
  },

  preferences: {
    onOpenTemplateModal: (callback: () => void) => {
      ipcRenderer.on('openTemplateModal', callback);
    },
  },

  getConfig: () => ipcRenderer.invoke('getConfig'),

  setTestState: (testState: Partial<ConfigurationState>) =>
    ipcRenderer.invoke('setTestState', testState),

  getTestState: () => ipcRenderer.invoke('getTestState'),

  onUpdateTestState: (
    callback: (
      event: Electron.IpcRendererEvent,
      state: Partial<ConfigurationState>,
    ) => void,
  ) => {
    ipcRenderer.on('updateTestState', callback);
  },

  removeUpdateTestStateListener: (
    callback: (
      event: Electron.IpcRendererEvent,
      state: Partial<ConfigurationState>,
    ) => void,
  ) => {
    ipcRenderer.removeListener('updateTestState', callback);
  },

  on: ipcRenderer.on.bind(ipcRenderer),
  send: ipcRenderer.send.bind(ipcRenderer),
  removeListener: ipcRenderer.removeListener.bind(ipcRenderer),
};
// Use `contextBridge` APIs to expose the API to the renderer process

contextBridge.exposeInMainWorld('api', API);
contextBridge.exposeInMainWorld('stubDataStorage', stubDataStorage);
contextBridge.exposeInMainWorld('env', {
  E2E_TEST: process.env.E2E_TEST,
});
