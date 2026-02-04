import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

export type TConfig = {
  API_URL: string;
  WEBPACK_PORT: number;
  LOGGER_PORT: number;
};

const defaultConfig: TConfig = {
  API_URL: 'http://localhost:8000',
  WEBPACK_PORT: 3001,
  LOGGER_PORT: 9013,
};

const getConfigPath = (): string => {
  const configDir = path.join(os.homedir(), '.config', 'ibex');
  const configPath = path.join(configDir, 'config.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  return configPath;
};

export const getConfigSync = (): TConfig => {
  // Check if backend URL is provided by Electron main process
  const backendUrl = process.env.IBEX_BACKEND_URL;
  
  if (backendUrl) {
    console.info(`Using backend URL from Electron: ${backendUrl}`);
    return {
      ...defaultConfig,
      API_URL: backendUrl,
    };
  }

  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf-8',
      );
    }

    const data = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(data);

    if (
      typeof parsed.API_URL === 'string' &&
      typeof parsed.WEBPACK_PORT === 'number' &&
      typeof parsed.LOGGER_PORT === 'number'
    ) {
      return parsed;
    }

    console.warn('Configuration invalide, retour à la config par défaut.');
    return defaultConfig;
  } catch (err) {
    console.error('Erreur de lecture de config:', err);
    return defaultConfig;
  }
};
