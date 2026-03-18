import { expect } from 'chai';
import { By, until, WebDriver } from 'selenium-webdriver';
import { mockConfigurationState, mockemptyConfigurationsState } from './utils';
import {
  startApp,
  getDriver,
  stopApp,
  waitForApi,
  setTestState,
  getTestState,
} from './setup';

/**
 * UI Test Suite for the Visualization Component
 */
describe('UI Tests for Visualization Component', function () {
  this.timeout(30000);
  let driver: WebDriver;

  before(async () => {
    await startApp();
    driver = getDriver();
    await waitForApi();
  });

  afterEach(async () => {
    await setTestState({ configurations: [], active: null });

    // Close any remaining modals if necessary
    try {
      const modalOverlay = await driver.findElement(
        By.css('.mantine-Modal-overlay'),
      );
      const isDisplayed = await modalOverlay.isDisplayed();
      if (isDisplayed) {
        const closeButton = await driver.findElement(
          By.css('[data-testid="modal-close-button"]'),
        );
        await closeButton.click();

        // Wait until the overlay disappears
        await driver.wait(until.stalenessOf(modalOverlay), 3000);
      }
    } catch {
      // Ignore if the modal does not exist
    }
  });

  after(async () => {
    await stopApp();
  });

  it('Should show "No configurations available" text if configurations is empty', async () => {
    // Empty state
    await setTestState(mockemptyConfigurationsState);

    // Wait for and locate the "no configurations" message
    const noConfigText = await driver.wait(
      until.elementLocated(
        By.xpath("//*[contains(text(), 'No configurations available')]"),
      ),
      10000,
    );

    expect(await noConfigText.isDisplayed()).to.be.true;
  });

  it('Should display the Visualization component and show the left and right panels', async () => {
    // Sample configuration
    await setTestState(mockConfigurationState);

    // Locate all required elements
    const container = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-container"]')),
      1000,
    );

    const leftPanel = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-left-panel"]')),
      1000,
    );

    const rightPanel = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-right-panel"]')),
      1000,
    );

    expect(await container.isDisplayed()).to.be.true;
    expect(await leftPanel.isDisplayed()).to.be.true;
    expect(await rightPanel.isDisplayed()).to.be.true;
  });

  it('Should verify the correct width for the left and right panels', async () => {
    // Sample configuration
    await setTestState(mockConfigurationState);

    // Locate all required elements
    const container = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-container"]')),
      1000,
    );
    const leftPanel = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-left-panel"]')),
      1000,
    );
    const rightPanel = await driver.wait(
      until.elementLocated(By.css('[data-testid="visualization-right-panel"]')),
      1000,
    );

    expect(await container.isDisplayed()).to.be.true;
    expect(await leftPanel.isDisplayed()).to.be.true;
    expect(await rightPanel.isDisplayed()).to.be.true;

    // Get bounding rectangles for dimension calculations
    const containerRect: DOMRect | null = await driver.executeScript(() => {
      const el = document.querySelector(
        '[data-testid="visualization-container"]',
      );
      return el?.getBoundingClientRect();
    });

    const leftRect: DOMRect | null = await driver.executeScript(() => {
      const el = document.querySelector(
        '[data-testid="visualization-left-panel"]',
      );
      return el?.getBoundingClientRect();
    });

    const rightRect: DOMRect | null = await driver.executeScript(() => {
      const el = document.querySelector(
        '[data-testid="visualization-right-panel"]',
      );
      return el?.getBoundingClientRect();
    });

    const containerWidth = containerRect?.width;
    const leftWidth = leftRect?.width;
    const rightWidth = rightRect?.width;

    const totalPanelsWidth = leftWidth + rightWidth;
    const remaining = containerWidth - totalPanelsWidth;

    expect(remaining).to.be.lessThan(32);

    const leftRatio = leftWidth / totalPanelsWidth;
    const rightRatio = rightWidth / totalPanelsWidth;

    // Assert expected ratios: 1/6 for left panel, 5/6 for right panel
    // Using closeTo() to account for floating-point precision and browser rendering differences
    expect(leftRatio).to.be.closeTo(0.1666, 0.01); // ~16.67%
    expect(rightRatio).to.be.closeTo(0.8333, 0.01); // ~83.33%
  });

  it('Should get active name from current state', async () => {
    // Sample configuration
    await setTestState(mockConfigurationState);

    const currentState = await getTestState();
    expect(currentState.active?.name).to.equal('Test Configuration 1');
  });

  it('Should update the active configuration when a new one is selected', async () => {
    // Sample configuration
    await setTestState(mockConfigurationState);

    const select = await driver.wait(
      until.elementLocated(
        By.css('[data-testid="header-select-configuration"]'),
      ),
      1000,
    );

    await select.click();

    const secondOption = await driver.wait(
      until.elementLocated(By.xpath('//div[@data-combobox-option][2]')),
      1000,
    );

    await secondOption.click();

    // Verify that the active configuration has been updated
    const currentState = await getTestState();
    expect(currentState.active?.name).to.equal('Test Configuration 2');
  });
});
