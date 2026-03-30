// test/setup.ts
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as chrome from 'selenium-webdriver/chrome';
import { Builder, WebDriver } from 'selenium-webdriver';
import { ConfigurationState } from 'src/renderer/types';

let driver: WebDriver;
let electron: ChildProcessWithoutNullStreams;
/**
 * Starts the Electron app and initializes WebDriver to connect to it.
 * @returns WebDriver instance connected to the Electron app
 */
export async function startApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronBinary = require('electron');
  const appDir = path.resolve(__dirname, '..', '..');
  const electronEntry = path.join(appDir, '.webpack', 'main', 'index.js');

  electron = spawn(
    electronBinary,
    ['--remote-debugging-port=9222', electronEntry],
    {
      cwd: appDir,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: 'true',
        ELECTRON_ENABLE_STACK_DUMPING: 'true',
        E2E_TEST: process.env.E2E_TEST,
      },
    },
  );

  await new Promise((r) => setTimeout(r, 5000));

  const options = new chrome.Options()
    .addArguments('--remote-debugging-port=9222')
    .addArguments('--no-sandbox')
    .addArguments('--disable-dev-shm-usage');

  // Initialize WebDriver to connect to Electron's Chromium instance
  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options as chrome.Options)
    .build();

  return driver;
}

/**
 * Gets the WebDriver instance.
 * @returns WebDriver instance connected to the Electron app
 */
export function getDriver(): WebDriver {
  return driver;
}

/**
 * Stops the Electron app and quits the WebDriver.
 */
export async function stopApp() {
  if (driver) await driver.quit();
  if (electron) electron.kill();
}

/**
 * Waits for the Electron app's API to be available.
 * This checks if the `window.api` object is defined in the Electron app.
 * @returns Promise that resolves when the API is available
 */
export const waitForApi = async () => {
  await driver.wait(async () => {
    const result = await driver.executeScript(
      'return typeof window.api !== "undefined"',
    );
    return result === true;
  }, 10000);
};

/**
 * Sets the test state in the Electron app.
 * This function allows you to set the state of the application for testing purposes.
 * @param state Partial state object to set in the application
 */
export const setTestState = async (state: Partial<ConfigurationState>) => {
  await driver.executeScript((s: Partial<ConfigurationState>) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.setTestState(s);
  }, state);
};

/**
 * Gets the current test state from the Electron app.
 * This function retrieves the current state of the application for testing purposes.
 * @returns Promise that resolves to the current ConfigurationState
 */
export const getTestState = async (): Promise<ConfigurationState> => {
  return await driver.executeScript(() => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.getTestState();
  });
};
