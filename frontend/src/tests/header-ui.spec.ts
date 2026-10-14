import { expect } from 'chai';
import { By, until, WebElement } from 'selenium-webdriver';
import {
  ensureCssElementIsDisplayed,
  findCssElementAndClickIt,
  mockConfigurationState,
  getCssElementFromDataTestId,
  waitForValue,
  writeTextInCssElement,
} from './utils';
import { TestState } from 'src/renderer/types';
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
describe('UI Tests for Header Component', function () {
  this.timeout(30000);

  before(async () => {
    await startApp();
    await waitForApi();
  });

  after(async () => {
    await stopApp();
  });

  afterEach(async () => {
    await setTestState({ configurations: [], active: null });

    try {
      const overlay = await getDriver().findElement(
        By.css('.mantine-Modal-overlay'),
      );
      const displayed = await overlay.isDisplayed();
      if (displayed) {
        const close = await getDriver().findElement(
          By.css('[data-testid="modal-close-button"]'),
        );
        await close.click();
        await getDriver().wait(until.stalenessOf(overlay), 10000);
      }
    } catch {
      // no modal to close
    }
  });

  async function waitForElementToDisappear(
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

  async function closeModal(modal: WebElement) {
    await modal.findElement(By.css('button.mantine-Modal-close')).click();
    await waitForElementToDisappear(modal);
  }

  // The mock configurations, the first one active and already saved to a file
  const savedFilePath = '/some/folder/Test Configuration 1IbexState.json';
  const savedConfigurationState: Partial<TestState> = {
    configurations: mockConfigurationState.configurations.map(
      (configuration, index) =>
        index === 0
          ? { ...configuration, path: savedFilePath, saved: true }
          : configuration,
    ),
    active: {
      ...mockConfigurationState.active,
      path: savedFilePath,
      saved: true,
    },
  };

  it('Should create new configuration from header', async () => {
    await findCssElementAndClickIt('header-add-configuration');
    const configCreateModal = await ensureCssElementIsDisplayed(
      'config-create-modal',
    );
    await writeTextInCssElement('config-create-name-input', 'My New Config');
    await findCssElementAndClickIt('config-create-submit-button');
    await waitForElementToDisappear(configCreateModal);

    await waitForValue(
      'Add configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
    await waitForValue(
      'Add configuration name',
      async () => (await getTestState()).configurations[0].name,
      'My New Config',
    );

    // The URI selection modal should apear, we should close it for the next test
    const configUriSelectionModal = await ensureCssElementIsDisplayed(
      'config-uri-selection-modal',
    );
    // Find the close button INSIDE the modal
    const closeButton = await configUriSelectionModal.findElement(
      By.css('button.mantine-Modal-close'),
    );
    // Click it to close
    await closeButton.click();
    // Wait for the modal to disappear
    await waitForElementToDisappear(configUriSelectionModal);
  });

  it('Should delete configuration from header', async () => {
    await setTestState(mockConfigurationState);
    await findCssElementAndClickIt('header-delete-configuration');
    const confirmationModal =
      await ensureCssElementIsDisplayed('confirm-modal');

    const confirmationText = await getDriver()
      .findElement(By.css('[data-testid="config-delete-confirmation-text"]'))
      .getText();
    expect(confirmationText).to.equal(
      'Are you sure you want to delete the configuration?',
    );

    await findCssElementAndClickIt('confirm-modal-confirm-button');
    await waitForElementToDisappear(confirmationModal);

    await waitForValue(
      'Delete configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
  });

  it('Should save configuration from header', async () => {
    await setTestState(mockConfigurationState);
    await ensureCssElementIsDisplayed('header-save-configuration');
    await waitForValue(
      'Save configuration saved',
      async () => (await getTestState()).active.saved,
      undefined,
    );
    await findCssElementAndClickIt('header-save-configuration');
    await waitForValue(
      'Save configuration saved',
      async () => (await getTestState()).active.saved,
      true,
    );
  });

  it('Should load the configuration from header', async () => {
    await ensureCssElementIsDisplayed('header-load-configuration');
    await waitForValue(
      'Load configuration length',
      async () => (await getTestState()).configurations.length,
      0,
    );
    await findCssElementAndClickIt('header-load-configuration');
    // The menu lists the launch directory below "Browse…"
    await ensureCssElementIsDisplayed('header-load-menu');
    await findCssElementAndClickIt('header-load-browse');
    await waitForValue(
      'Load configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
  });

  it('Should rename the active configuration from header', async () => {
    await setTestState(savedConfigurationState);
    await findCssElementAndClickIt('header-rename-configuration');
    const renameModal = await ensureCssElementIsDisplayed(
      'config-rename-modal',
    );

    // The field starts with the current name
    await waitForValue(
      'Rename field value',
      async () =>
        (
          await getCssElementFromDataTestId('config-rename-name-input')
        ).getAttribute('value'),
      'Test Configuration 1',
    );

    await writeTextInCssElement(
      'config-rename-name-input',
      'Renamed Config',
      true,
    );
    await findCssElementAndClickIt('config-rename-submit-button');
    await waitForElementToDisappear(renameModal);

    await waitForValue(
      'Renamed active name',
      async () => (await getTestState()).active.name,
      'Renamed Config',
    );
    const state = await getTestState();
    expect(state.configurations.map((c) => c.name)).to.deep.equal([
      'Renamed Config',
      'Test Configuration 2',
    ]);
    // Unsaved, but still bound to its file so that Save writes the new name
    expect(state.active.saved).to.equal(false);
    expect(state.active.path).to.equal(savedFilePath);
  });

  it('Should refuse to rename a configuration to a name in use', async () => {
    await setTestState(mockConfigurationState);
    await findCssElementAndClickIt('header-rename-configuration');
    const renameModal = await ensureCssElementIsDisplayed(
      'config-rename-modal',
    );

    await writeTextInCssElement(
      'config-rename-name-input',
      'Test Configuration 2',
      true,
    );
    await findCssElementAndClickIt('config-rename-submit-button');

    await waitForValue(
      'Rename error',
      async () =>
        renameModal
          .findElement(By.css('.mantine-TextInput-error'))
          .then((error) => error.getText())
          .catch((): string => null),
      'This name is already taken',
    );
    expect(await renameModal.isDisplayed()).to.equal(true);
    expect((await getTestState()).active.name).to.equal('Test Configuration 1');

    await closeModal(renameModal);
  });

  it('Should save a saved configuration to another file from header', async () => {
    await setTestState(savedConfigurationState);

    // Save has nothing to do, Save as is still offered
    await waitForValue(
      'Save button enabled',
      async () =>
        (
          await getCssElementFromDataTestId('header-save-configuration')
        ).isEnabled(),
      false,
    );
    await findCssElementAndClickIt('header-save-as-configuration');

    // The E2E stub of the save dialog always picks this file
    await waitForValue(
      'Save as path',
      async () => (await getTestState()).active.path,
      '/stub/path/for/configuration.json',
    );
    expect((await getTestState()).active.saved).to.equal(true);
  });

  it('Should not offer rename or save as without a configuration', async () => {
    await setTestState({ configurations: [], active: null });
    for (const testId of [
      'header-rename-configuration',
      'header-save-as-configuration',
    ]) {
      await waitForValue(
        `${testId} enabled`,
        async () => (await getCssElementFromDataTestId(testId)).isEnabled(),
        false,
      );
    }
  });
});
