import { By, until } from 'selenium-webdriver';
import {
  startApp,
  getDriver,
  stopApp,
  waitForApi,
  setTestState,
  getTestState,
} from './setup';
import {
  ensureCssElementIsDisplayed,
  findCssElementAndClickIt,
  findTextElementAndClickIt,
  waitForElementToDisappear,
  waitForValue,
  writeTextInCssElement,
} from './utils';
import { expect } from 'chai';

/**
 * UI Test Suite for the Visualization Component
 */
describe('UI Tests for plotted data', function () {
  this.timeout(60000);

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

  it('Should create a new configuration, and plot data on it', async () => {
    ///
    /// Create a new configuration named 'New Plot Config'
    ///
    await findCssElementAndClickIt('header-add-configuration');
    const configCreateModal = await ensureCssElementIsDisplayed(
      'config-create-modal',
    );
    await writeTextInCssElement('config-create-name-input', 'New Plot Config');
    await findCssElementAndClickIt('config-create-submit-button');
    await waitForElementToDisappear(configCreateModal);
    await waitForValue(
      'Plot configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
    await waitForValue(
      'Plot configuration name',
      async () => (await getTestState()).configurations[0].name,
      'New Plot Config',
    );

    ///
    /// Add the URI 'imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106' to the configuration and navigate in the accordion node tree
    ///
    await ensureCssElementIsDisplayed('config-uri-selection-modal');
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      'imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106',
    );
    await findCssElementAndClickIt('config-uri-selection-modal-add-uri-button');
    await findCssElementAndClickIt(
      'config-uri-selection-modal-validate-button',
      100,
      300,
    );
    await ensureCssElementIsDisplayed(
      'uriAccordion-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'uriAccordion-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106#core_profiles:0/',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106#core_profiles:0/profiles_1d[:]/',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106#core_profiles:0/profiles_1d[:]/ion[:]/',
      200,
      100,
    );

    ///
    /// The accordion node tree is now unfold, check that the plot are correctly added into the active configuration
    ///
    await waitForValue(
      'DataPlot configuration length',
      async () => (await getTestState()).active.dataPlot.length,
      0,
    );
    // Click on temperature checkbox to start a new plot
    await findCssElementAndClickIt(
      'checkbox-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106#core_profiles:0/profiles_1d[:]/ion[:]/temperature',
    );
    // Check that there is one dataplot created
    await waitForValue(
      'DataPlot configuration length',
      async () => (await getTestState()).active.dataPlot.length,
      1,
    );
    // Check that the Y plot is defined
    await waitForValue(
      'yAxis absence',
      async () => (await getTestState()).active.dataPlot[0].yAxisData,
      undefined,
      (actual, expected) => actual != expected,
    );
    // Check that the Y2 plot is undefined
    await waitForValue(
      'yAxis presence',
      async () => (await getTestState()).active.dataPlot[0].y2AxisData,
      undefined,
      (actual, expected) => actual == expected,
    );
    // Click on density checkbox to plot a second axis
    await findCssElementAndClickIt(
      'checkbox-imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106#core_profiles:0/profiles_1d[:]/ion[:]/density',
    );
    // Check that the Y plot is defined
    await waitForValue(
      'yAxis presence 2',
      async () => (await getTestState()).active.dataPlot[0].yAxisData,
      undefined,
      (actual, expected) => actual != expected,
    );
    // Check that the Y2 plot is defined too
    await waitForValue(
      'y2Axis presence',
      async () => (await getTestState()).active.dataPlot[0].y2AxisData,
      undefined,
      (actual, expected) => actual != expected,
    );
  });

  it('Should create a new configuration that follows a predefined template', async () => {
    ///
    /// Create a new configuration named 'New Plot Config' based on the 'PlotKineticProfilesIbexState.json' template
    ///
    await findCssElementAndClickIt('header-add-configuration');
    const configCreateModal = await ensureCssElementIsDisplayed(
      'config-create-modal',
    );
    await writeTextInCssElement(
      'config-create-name-input',
      'New Templated Plot Config',
    );
    await findCssElementAndClickIt('config-create-template-checkbox');
    await findCssElementAndClickIt('config-create-template-list');
    await findTextElementAndClickIt('PlotKineticProfilesIbexState.json');
    await findCssElementAndClickIt('config-create-submit-button');
    await waitForElementToDisappear(configCreateModal);
    await waitForValue(
      'Template configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
    await waitForValue(
      'Template configuration name',
      async () => (await getTestState()).configurations[0].name,
      'New Templated Plot Config',
    );

    ///
    /// Add the URI 'imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106' to the configuration and navigate in the accordion node tree
    ///
    const uriModal = await ensureCssElementIsDisplayed(
      'config-uri-selection-modal',
    );
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      'imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106',
      true,
    );
    await findCssElementAndClickIt('config-uri-selection-modal-add-uri-button');
    await findCssElementAndClickIt(
      'config-uri-selection-modal-validate-button',
      100,
      300,
    );
    await waitForElementToDisappear(uriModal, 30000);

    // Check that the 8 dataplot created has been created
    await waitForValue(
      'Dataplot length',
      async () => (await getTestState()).active.dataPlot.length,
      8,
    );

    const dataplotTitleList = (await getTestState()).active.dataPlot.map(
      (dataplot) => dataplot.title,
    );
    await waitForValue(
      'Dataplot title temperature profiles',
      async () =>
        dataplotTitleList.filter((title) => title === 'Temperature profiles')
          .length,
      1,
    );
    await waitForValue(
      'Dataplot title temperatures evolution',
      async () =>
        dataplotTitleList.filter((title) => title === 'Temperatures evolution')
          .length,
      1,
    );
    await waitForValue(
      'Dataplot title density profile',
      async () =>
        dataplotTitleList.filter((title) => title === 'Density profile').length,
      1,
    );
    await waitForValue(
      'Dataplot title density evolution',
      async () =>
        dataplotTitleList.filter((title) => title === 'Density evolution')
          .length,
      1,
    );
    await waitForValue(
      'Dataplot title zeff evolution',
      async () =>
        dataplotTitleList.filter((title) => title === 'Zeff evolution').length,
      1,
    );
    await waitForValue(
      'Dataplot title zeff profile',
      async () =>
        dataplotTitleList.filter((title) => title === 'Zeff profile').length,
      1,
    );
    await waitForValue(
      'Dataplot title poloidal velocity',
      async () =>
        dataplotTitleList.filter((title) => title === 'Poloidal velocity')
          .length,
      1,
    );
    await waitForValue(
      'Dataplot title toroidal velocity',
      async () =>
        dataplotTitleList.filter((title) => title === 'Toroidal velocity')
          .length,
      1,
    );
    await waitForValue(
      'Dataplot fullfil test',
      async () =>
        (await getTestState()).active.dataPlot.filter(
          (dataPlot) => dataPlot.plot.length === 0,
        ).length,
      0,
      (actual, expected) => actual == expected,
      100,
      300,
    );
  });

  it('Should create a new configuration containing error bands, and plot error band data', async () => {
    ///
    /// Create a new configuration named 'New Plot Config'
    ///
    await findCssElementAndClickIt('header-add-configuration');
    const configCreateModal = await ensureCssElementIsDisplayed(
      'config-create-modal',
    );
    await writeTextInCssElement('config-create-name-input', 'New Plot Config');
    await findCssElementAndClickIt('config-create-submit-button');
    await waitForElementToDisappear(configCreateModal);
    await waitForValue(
      'Error band configuration length',
      async () => (await getTestState()).configurations.length,
      1,
    );
    await waitForValue(
      'Error band configuration name',
      async () => (await getTestState()).configurations[0].name,
      'New Plot Config',
    );

    ///
    /// Add the URI 'imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3' to the configuration and navigate in the accordion node tree
    ///
    const uriModal = await ensureCssElementIsDisplayed(
      'config-uri-selection-modal',
    );
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      'imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3',
      true,
    );
    await findCssElementAndClickIt('config-uri-selection-modal-add-uri-button');
    await findCssElementAndClickIt(
      'config-uri-selection-modal-validate-button',
      100,
      300,
    );
    await waitForElementToDisappear(uriModal, 30000);
    await ensureCssElementIsDisplayed(
      'uriAccordion-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'uriAccordion-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3#ece:0/',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3#ece:0/channel[:]/',
      200,
      100,
    );
    await findCssElementAndClickIt(
      'folder-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3#ece:0/channel[:]/t_e/',
      200,
      100,
    );

    ///
    /// The accordion node tree is now unfold, check that the plot are correctly added into the active configuration
    ///
    await waitForValue(
      'Dataplot length',
      async () => (await getTestState()).active.dataPlot.length,
      0,
    );
    // Click on temperature checkbox to start a new plot
    await findCssElementAndClickIt(
      'checkbox-imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3#ece:0/channel[:]/t_e/data',
    );
    // Ensure that the plot is created
    await waitForValue(
      'Dataplot length',
      async () => (await getTestState()).active.dataPlot.length,
      1,
    );
    // Ensure that there is one plot in the dataplot
    await waitForValue(
      'Dataplot plot length',
      async () => (await getTestState()).active.dataPlot[0].plot.length,
      1,
    );
    // Ensure that error_y isn't undefined
    await waitForValue(
      'Dataplot plot error y presence',
      async () => (await getTestState()).active.dataPlot[0].plot[0].error_y,
      undefined,
      (actual, expected) => actual != expected,
    );
    // Ensure that error_y isn't undefined
    await waitForValue(
      'Dataplot plot error y type',
      async () =>
        (await getTestState()).active.dataPlot[0].plot[0].error_y.type,
      'data',
    );

    const plotWithErrorBand = (await getTestState()).active.dataPlot[0].plot[0]
      .error_y;
    if (plotWithErrorBand.type === 'data') {
      console.info('Checking Dataplot plot error y array length > 0');
      expect(plotWithErrorBand.array.length > 0);
      console.info('Checking Dataplot plot error y arrayminus length > 0');
      expect(plotWithErrorBand.arrayminus.length > 0);
    }
  });
});
