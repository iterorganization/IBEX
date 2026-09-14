// test/setup.ts
import * as path from 'path';
import * as chrome from 'selenium-webdriver/chrome';
import { Builder, WebDriver } from 'selenium-webdriver';
import { ConfigurationState } from 'src/renderer/types';

const DEBUGGER_ADDRESS = '127.0.0.1:9222';

let driver: WebDriver;

/**
 * Resolves the chromedriver shipped by electron-chromedriver. It must be used
 * instead of letting Selenium Manager pick one, because only that binary
 * matches the Chromium version embedded in the Electron we are driving.
 */
function getChromedriverPath(): string {
  const packageJson = require.resolve('electron-chromedriver/package.json');
  return path.join(path.dirname(packageJson), 'bin', 'chromedriver');
}

/**
 * Waits until the Electron app started by `npm run start:e2e` exposes its
 * DevTools endpoint, so tests do not depend on a fixed startup delay.
 */
async function waitForDebugger(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${DEBUGGER_ADDRESS}/json/version`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(
    `No Electron instance answering on ${DEBUGGER_ADDRESS}. Start the app with ` +
      `"npm run start:e2e" before running the tests. Last error: ${lastError}`,
  );
}

/**
 * Attaches WebDriver to the running Electron app.
 * The app itself is started by `npm run start:e2e` (see ci/run-e2e-test.sh):
 * it owns the webpack dev server the renderer is loaded from, so the tests
 * attach to that instance rather than launching a second one.
 * @returns WebDriver instance connected to the Electron app
 */
export async function startApp() {
  await waitForDebugger();

  const options = new chrome.Options()
    .addArguments('--no-sandbox')
    .addArguments('--disable-dev-shm-usage');
  options.debuggerAddress(DEBUGGER_ADDRESS);

  // Initialize WebDriver to connect to Electron's Chromium instance
  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeService(new chrome.ServiceBuilder(getChromedriverPath()))
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
 * Detaches WebDriver from the Electron app.
 * The app is left running: its lifecycle belongs to whoever started it
 * (ci/run-e2e-test.sh), and the remaining spec files attach to it in turn.
 */
export async function stopApp() {
  if (driver) await driver.quit();
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
