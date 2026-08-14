import {
  By,
  error as seleniumError,
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
  const typeText = () =>
    retryOnStale(async () => {
      const input = await getCssElementFromDataTestId(cssElementDataTestIdName);
      if (!clearText) {
        await input.sendKeys(text);
        return;
      }

      // Replacing the content through the DOM setter, then firing the event
      // React listens to.
      //
      // Typing it out cannot work on these fields. They are controlled, and
      // emptying a Mantine `NumberInput` makes its `onChange` write a default
      // straight back into it: `Number('')` is `0`, which is finite, so
      // `data-operation-value-*` returns to "0" after every keystroke and
      // deleting one character at a time never ends. Overwriting a selection
      // instead does terminate, but only updates the field on screen: the
      // component keeps its own state, and the operation was still applied
      // with its default value.
      await getDriver().executeScript(
        (element: HTMLInputElement, value: string) => {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        },
        input,
        text,
      );
    });

  await typeText();

  // Only a cleared field has a known expected value, so only that case can be
  // checked.
  if (!clearText) return;

  /**
   * Waits for the field to settle, and reports what it holds.
   *
   * These inputs are controlled by React: a re-render landing while the field
   * is being emptied puts the previous value back, which then gets prefixed to
   * the text being typed. The resulting URI is silently rejected by the
   * back-end, so the failure only surfaces much later as a button that never
   * becomes enabled.
   */
  const settledValue = async () => {
    let value: string;
    const deadline = Date.now() + 1000;
    do {
      value = await retryOnStale(async () =>
        (
          await getCssElementFromDataTestId(cssElementDataTestIdName)
        ).getAttribute('value'),
      );
      if (value === text) return value;
      await new Promise((res) => setTimeout(res, 100));
    } while (Date.now() < deadline);
    return value;
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await settledValue()) === text) return;
    await typeText();
  }

  expect(await settledValue(), `Field "${cssElementDataTestIdName}"`).to.equal(
    text,
  );
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

    await getDriver().wait(
      until.elementIsEnabled(button),
      retries * delayMs,
      `Control "${cssElementDataTestIdName}" never became enabled`,
    );

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
  /** Opens the dropdown, clicks the option, and returns its visible label. */
  const pickOption = () =>
    retryOnStale(async () => {
      const select = await getCssElementFromDataTestId(selectTestId, timeout);
      await getDriver().wait(until.elementIsEnabled(select), timeout);
      await select.click();

      // The dropdown is portalled outside the select, so it is looked up
      // globally
      await getDriver().wait(
        until.elementLocated(By.css('[data-combobox-option]')),
        timeout,
        `Dropdown of "${selectTestId}" did not open`,
      );

      const options = await getDriver().findElements(
        By.css('[data-combobox-option]'),
      );
      for (const option of options) {
        // Closed dropdowns keep their options in the DOM, and several selects
        // of the page offer the same values: only the visible ones belong to
        // the dropdown that was just opened
        if (!(await option.isDisplayed())) continue;

        const value = await option.getAttribute('value');
        const label = (await option.getText()).trim();
        if (value === optionValue || label === optionValue) {
          await option.click();
          return label;
        }
      }

      throw new Error(
        `Option "${optionValue}" not found in the open dropdown of "${selectTestId}"`,
      );
    });

  /**
   * Waits for the field to display the choice.
   *
   * A panel that finishes loading its grid re-renders its rows and drops a
   * selection made a moment earlier, without any error: the field simply goes
   * back to being empty. Only what the field shows tells the choice was kept.
   */
  const isSelected = async (label: string) => {
    const deadline = Date.now() + 2000;
    do {
      const shown = await retryOnStale(async () =>
        (await getCssElementFromDataTestId(selectTestId, timeout)).getAttribute(
          'value',
        ),
      );
      if (shown === label || shown === optionValue) return true;
      await new Promise((res) => setTimeout(res, 100));
    } while (Date.now() < deadline);
    return false;
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    if (await isSelected(await pickOption())) return;
  }

  throw new Error(
    `Option "${optionValue}" never stuck in the select "${selectTestId}"`,
  );
}

/**
 * Clicks a Mantine `Button` that switches to its loading state and waits until
 * it settles back.
 *
 * The button is first given a short window to enter the loading state, so that
 * the wait cannot succeed before React has even rendered it.
 */
export async function clickAndAwaitLoading(testId: string, timeout = 30000) {
  await findCssElementAndClickIt(testId, Math.ceil(timeout / 100), 100);

  /**
   * `null` while idle, the string of the `data-loading` attribute while busy,
   * and `undefined` once the button is gone.
   */
  const loadingState = async () => {
    const [button] = await getDriver().findElements(
      By.css(`[data-testid="${testId}"]`),
    );
    if (!button) return undefined;
    try {
      return await button.getAttribute('data-loading');
    } catch (err) {
      if (err instanceof seleniumError.StaleElementReferenceError) {
        return undefined;
      }
      throw err;
    }
  };

  // Entering the loading state is best effort: a request answered instantly
  // never shows it, and that is not a failure.
  const enteredLoadingDeadline = Date.now() + 2000;
  while (Date.now() < enteredLoadingDeadline) {
    if ((await loadingState()) !== null) break;
    await new Promise((res) => setTimeout(res, 50));
  }

  await getDriver().wait(
    async () => {
      const state = await loadingState();
      return state === null || state === undefined;
    },
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
  await findCssElementAndClickIt(testId, Math.ceil(timeout / 100), 100);

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

/**
 * Polls `callback` until it satisfies `comparator`, then asserts it one last
 * time.
 */
export async function waitForValue<T>(
  checkDescription: string,
  callback: () => Promise<T>,
  expected: T,
  comparator: (actual: T, expected: T) => boolean = (a, b) => a === b,
  retries = 100,
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
