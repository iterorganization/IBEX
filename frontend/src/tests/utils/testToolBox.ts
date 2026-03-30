import { By, Key, until, WebElement } from 'selenium-webdriver';
import { expect } from 'chai';
import { getDriver } from '../setup';

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
}

export async function findCssElementAndClickIt(
  cssElementDataTestIdName: string,
  retries = 100,
  delayMs = 100,
) {
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

export async function waitForValue<T>(
  checkDescription: string,
  callback: () => Promise<T>,
  expected: T,
  comparator: (actual: T, expected: T) => boolean = (a, b) => a === b,
  retries = 5,
  delayMs = 300,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    const actual = await callback();
    if (comparator(actual, expected)) {
      return; // success
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
