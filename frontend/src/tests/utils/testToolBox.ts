import {
  By,
  error as seleniumError,
  Key,
  until,
  WebElement,
} from 'selenium-webdriver';
import { expect } from 'chai';
import { getDriver } from '../setup';

/**
 * Re-runs `fn` when it throws a StaleElementReferenceError.
 *
 * A stale reference happens when the DOM node is detached (React/Mantine/Plotly
 * re-render) between the moment an element is located and the moment we act on
 * it. Retrying the whole locate-then-act sequence re-resolves a fresh node.
 */
async function retryOnStale<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 200,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof seleniumError.StaleElementReferenceError &&
        i < retries - 1
      ) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error('retryOnStale exhausted its retries');
}

export async function getCssElementFromDataTestId(
  cssElementDataTestIdName: string,
  timeout = 10000,
): Promise<WebElement> {
  const cssElement = await getDriver().wait(
    until.elementLocated(By.css(`[data-testid="${cssElementDataTestIdName}"]`)),
    timeout,
    `Element "${cssElementDataTestIdName}" not found`,
  );
  await getDriver().wait(until.elementIsVisible(cssElement), timeout);
  return cssElement;
}

export async function getCssElementByText(
  text: string,
  timeout = 10000,
): Promise<WebElement> {
  const driver = getDriver();

  const element = await driver.wait(
    until.elementLocated(
      By.xpath(`//*[contains(normalize-space(text()), "${text}")]`),
    ),
    timeout,
  );

  if (!element) {
    throw new Error(`No element found with text "${text}", abort`);
  }

  return element;
}

export async function waitForElementToDisappear(
  element: WebElement,
  timeout = 10000,
) {
  try {
    if (await element.isDisplayed()) {
      const start = Date.now();
      await getDriver().wait(until.elementIsNotVisible(element), timeout);
      const elapsed = Date.now() - start;
      console.info(`Waited ${elapsed} ms for element to disappear`);
    }
  } catch {
    console.warn('Element did not disappear within timeout');
  }
}

export async function ensureCssElementIsDisplayed(
  cssElementDataTestIdName: string,
  retries = 100,
  delayMs = 100,
): Promise<WebElement> {
  console.info('Ensuring element is displayed : ', cssElementDataTestIdName);
  const cssElement: WebElement = await getCssElementFromDataTestId(
    cssElementDataTestIdName,
    retries * delayMs,
  );

  await getDriver().wait(until.elementIsVisible(cssElement), retries * delayMs);

  expect(
    await cssElement.isDisplayed(),
    `Element "${cssElementDataTestIdName}" was found but isDisplayed() returned false.`,
  ).to.be.true;
  return cssElement;
}

export async function writeTextInCssElement(
  cssElementDataTestIdName: string,
  text: string,
  clearText: boolean = false,
) {
  await retryOnStale(async () => {
    const input = await getCssElementFromDataTestId(cssElementDataTestIdName);
    if (clearText) {
      if (
        (await input.getAttribute('value')) != undefined &&
        (await input.getAttribute('value'))?.length > 0
      ) {
        while ((await input.getAttribute('value')).length > 0) {
          await input.sendKeys(Key.BACK_SPACE);
        }
      }
    }
    await input.sendKeys(text);
  });
}

export async function findCssElementAndClickIt(
  cssElementDataTestIdName: string,
  retries = 100,
  delayMs = 100,
) {
  await retryOnStale(async () => {
    const button = await getCssElementFromDataTestId(
      cssElementDataTestIdName,
      retries * delayMs,
    );

    await getDriver().wait(until.elementIsEnabled(button), retries * delayMs);

    expect(
      await button.isDisplayed(),
      `Button "${cssElementDataTestIdName}" was found but isDisplayed() returned false.`,
    ).to.be.true;
    await button.click();
  });
}

export async function findTextElementAndClickIt(
  text: string,
  retries = 5,
  delayMs = 300,
) {
  const timeout = retries * delayMs;
  const button = await getCssElementByText(text, timeout);

  for (let i = 0; i < retries; i++) {
    await new Promise((res) => setTimeout(res, delayMs));

    if (await button.isEnabled()) {
      break;
    }
  }

  expect(await button.isEnabled()).to.be.true;
  await button.click();
}

/**
 * Opens a Mantine `Select` identified by its test id and clicks the option
 * matching `optionValue`.
 *
 * Mantine forwards the option `value` onto the rendered node, so the option is
 * looked up by that attribute first and only falls back to its visible label.
 * Matching by text alone is not enough here: the operand select lists plot
 * names, which also appear in the Plotly legend and in the customization tabs.
 */
export async function selectMantineOption(
  selectTestId: string,
  optionValue: string,
  timeout = 10000,
) {
  await retryOnStale(async () => {
    const select = await getCssElementFromDataTestId(selectTestId, timeout);
    await getDriver().wait(until.elementIsEnabled(select), timeout);
    await select.click();

    // The dropdown is portalled outside the select, so it is looked up globally
    await getDriver().wait(
      until.elementLocated(By.css('[data-combobox-option]')),
      timeout,
      `Dropdown of "${selectTestId}" did not open`,
    );

    const options = await getDriver().findElements(
      By.css('[data-combobox-option]'),
    );
    for (const option of options) {
      // Closed dropdowns keep their options in the DOM, and several selects of
      // the page offer the same values: only the visible ones belong to the
      // dropdown that was just opened
      if (!(await option.isDisplayed())) continue;

      const value = await option.getAttribute('value');
      const label = (await option.getText()).trim();
      if (value === optionValue || label === optionValue) {
        await option.click();
        return;
      }
    }

    throw new Error(
      `Option "${optionValue}" not found in the open dropdown of "${selectTestId}"`,
    );
  });
}

/**
 * Clicks a Mantine `Button` that switches to its loading state and waits until
 * it settles back.
 *
 * The button is first given a short window to enter the loading state, so that
 * the wait cannot succeed before React has even rendered it.
 */
export async function clickAndAwaitLoading(testId: string, timeout = 30000) {
  await findCssElementAndClickIt(testId);

  const isLoading = async () =>
    (await getCssElementFromDataTestId(testId, timeout)).getAttribute(
      'data-loading',
    );

  // Entering the loading state is best effort: a request answered instantly
  // never shows it, and that is not a failure.
  const enteredLoadingDeadline = Date.now() + 2000;
  while (Date.now() < enteredLoadingDeadline) {
    if ((await isLoading()) !== null) break;
    await new Promise((res) => setTimeout(res, 50));
  }

  await getDriver().wait(
    async () => (await isLoading()) === null,
    timeout,
    `Button "${testId}" stayed in loading state`,
  );
}

/**
 * Clicks a control that disables itself while it works, and waits until it
 * accepts input again.
 *
 * Used for actions whose only progress signal is the disabled state, such as
 * adding a URI while the back-end verifies it.
 */
export async function clickAndAwaitEnabled(testId: string, timeout = 60000) {
  await findCssElementAndClickIt(testId);

  const isEnabled = async () =>
    (await getCssElementFromDataTestId(testId, timeout)).isEnabled();

  // Entering the busy state is best effort: an action answered instantly never
  // shows it, and that is not a failure.
  const busyDeadline = Date.now() + 2000;
  while (Date.now() < busyDeadline) {
    if (!(await isEnabled())) break;
    await new Promise((res) => setTimeout(res, 50));
  }

  await getDriver().wait(
    async () => await isEnabled(),
    timeout,
    `Control "${testId}" stayed disabled`,
  );
}

/**
 * Reads every Mantine notification currently displayed.
 */
export async function readNotifications(): Promise<
  { title: string; description: string }[]
> {
  return await getDriver().executeScript(() =>
    Array.from(document.querySelectorAll('.mantine-Notification-root')).map(
      (notification) => ({
        title:
          notification.querySelector('.mantine-Notification-title')
            ?.textContent ?? '',
        description:
          notification.querySelector('.mantine-Notification-description')
            ?.textContent ?? '',
      }),
    ),
  );
}

/**
 * Waits for a notification carrying `title` and returns its description.
 *
 * Notifications close on their own after a few seconds, so this polls fast and
 * must be called right after the action that raises it.
 */
export async function waitForNotification(
  title: string,
  timeout = 15000,
): Promise<string> {
  const deadline = Date.now() + timeout;
  let seen: string[] = [];

  while (Date.now() < deadline) {
    const notifications = await readNotifications();
    const match = notifications.find(
      (notification) => notification.title === title,
    );
    if (match) return match.description;
    seen = notifications.map((notification) => notification.title);
    await new Promise((res) => setTimeout(res, 100));
  }

  throw new Error(
    `Notification "${title}" never appeared. Last seen: ${JSON.stringify(seen)}`,
  );
}

/**
 * Asserts that no notification carrying `title` shows up during `durationMs`.
 */
export async function expectNoNotification(title: string, durationMs = 2500) {
  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline) {
    const notifications = await readNotifications();
    const match = notifications.find(
      (notification) => notification.title === title,
    );
    expect(match, `Unexpected notification "${title}": ${match?.description}`)
      .to.be.undefined;
    await new Promise((res) => setTimeout(res, 100));
  }
}

export async function waitForValue<T>(
  checkDescription: string,
  callback: () => Promise<T>,
  expected: T,
  comparator: (actual: T, expected: T) => boolean = (a, b) => a === b,
  retries = 5,
  delayMs = 300,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const actual = await callback();
      if (comparator(actual, expected)) {
        return; // success
      }
    } catch (err) {
      // A transient error while the DOM re-renders (e.g. a stale element read)
      // should not fail the test: keep polling until the retries run out.
      if (!(err instanceof seleniumError.StaleElementReferenceError)) {
        throw err;
      }
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }

  // final assertion
  const final = await callback();
  expect(
    comparator(final, expected),
    `${checkDescription} failed :
    Expected: ${JSON.stringify(expected)}
    Received: ${JSON.stringify(final)}`,
  ).to.be.true;
}
