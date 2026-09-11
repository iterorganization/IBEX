import {
  startApp,
  getDriver,
  stopApp,
  waitForApi,
  getTestState,
} from './setup';
import {
  addUriAndAwaitSelection,
  ensureCssElementIsDisplayed,
  openCustomization,
  findCssElementAndClickIt,
  findTextElementAndClickIt,
  getCssElementFromDataTestId,
  resetAppState,
  waitForElementToDisappear,
  waitForValue,
  writeTextInCssElement,
} from './utils';
// import { expect } from 'chai';
import '../config/bridge';

/**
 * UI Test Suite for the Visualization Component
 */
describe('UI Tests for plotted data', function () {
  this.timeout(90000);

  before(async () => {
    await startApp();
    await waitForApi();
  });

  after(async () => {
    await stopApp();
  });

  // The Electron instance is shared with the other specs and survives between
  // runs, so each test starts by clearing whatever the previous one left behind.
  // A modal left open would otherwise intercept every click of the next test.
  beforeEach(async () => {
    await resetAppState();
  });

  afterEach(async () => {
    await resetAppState();
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
    /// Add the URI of iter_scenario_53298_seq1_DD3.nc to the configuration and navigate in the accordion node tree
    ///
    const dataPath1: string = await (
      await getDriver()
    ).executeScript(async () => {
      const path =
        (await window.api.fs.getZenodoDataPath()) +
        '/iter_scenario_53298_seq1_DD3.nc';
      return path;
    });
    await ensureCssElementIsDisplayed('config-uri-selection-modal');
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      dataPath1,
      true,
    );
    // Adding a URI is asynchronous: the button disables itself while the
    // back-end verifies it, and typing the next URI before it completes would
    // race the form
    await addUriAndAwaitSelection(dataPath1);
    /// Add the URI 2 of iter_disruption_113112_1.nc to test interpolation later
    const dataPath2: string = await (
      await getDriver()
    ).executeScript(async () => {
      const path =
        (await window.api.fs.getZenodoDataPath()) +
        '/iter_disruption_113112_1.nc';
      return path;
    });
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      dataPath2,
      true,
    );
    await addUriAndAwaitSelection(dataPath2);

    await findCssElementAndClickIt(
      'config-uri-selection-modal-validate-button',
      100,
      300,
    );
    // Building the tree of both datasets takes a while, the biggest one weighs
    // more than 170 MB
    await ensureCssElementIsDisplayed(`uriAccordion-${dataPath1}`, 600, 100);
    await findCssElementAndClickIt(`uriAccordion-${dataPath1}`, 200, 100);
    await findCssElementAndClickIt(
      `folder-${dataPath1}#equilibrium:0/`,
      200,
      100,
    );
    await findCssElementAndClickIt(
      `folder-${dataPath1}#equilibrium:0/time_slice[:]/`,
      200,
      100,
    );
    await findCssElementAndClickIt(
      `folder-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/`,
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
    // Regression guard for #135: double-clicking a structure label used to
    // leave a native text selection behind, which silently swallowed every
    // later checkbox click. Labels are no longer selectable, so the click
    // below must still register. The two clicks collapse then re-expand the
    // folder, leaving the tree as it was.
    const profiles1dFolder = await getCssElementFromDataTestId(
      `folder-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/`,
      20000,
    );
    await getDriver().actions().doubleClick(profiles1dFolder).perform();

    // Click on phi checkbox to start a new plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/phi`,
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
    // Click on pressure checkbox to plot a second axis
    await findCssElementAndClickIt(
      `checkbox-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/pressure`,
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

    ///
    /// Add the URI iter_disruption_113112_1.nc to ensure the interpolation works
    ///
    // Click on phi checkbox to remove the plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/phi`,
    );
    await getDriver().sleep(2000);

    // Click on pressure checkbox to remove the plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/pressure`,
    );
    await getDriver().sleep(2000);

    // Check that there is no dataplot
    await waitForValue(
      'DataPlot configuration length',
      async () => (await getTestState()).active.dataPlot.length,
      0,
    );
    await getDriver().sleep(2000);

    // Click on psi checkbox to display a new plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath1}#equilibrium:0/time_slice[:]/profiles_1d/psi`,
    );
    await waitForValue(
      'Shape of psi plot',
      async () =>
        (await getTestState()).active.dataPlot[0]?.coordinates[0]?.shape,
      [1, 298],
      (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected),
    );
    // Navigate to URI 2 psi to plot
    await findCssElementAndClickIt(`uriAccordion-${dataPath1}`, 200, 100);
    await getDriver().sleep(2000);
    await ensureCssElementIsDisplayed(`uriAccordion-${dataPath2}`, 200, 100);
    await findCssElementAndClickIt(`uriAccordion-${dataPath2}`, 200, 100);
    await getDriver().sleep(2000);
    await findCssElementAndClickIt(
      `folder-${dataPath2}#equilibrium:0/`,
      200,
      100,
    );
    await findCssElementAndClickIt(
      `folder-${dataPath2}#equilibrium:0/time_slice[:]/`,
      200,
      100,
    );
    await findCssElementAndClickIt(
      `folder-${dataPath2}#equilibrium:0/time_slice[:]/profiles_1d/`,
      200,
      100,
    );
    // Click on psi checkbox to display a new plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath2}#equilibrium:0/time_slice[:]/profiles_1d/psi`,
    );
    // Interpolating across the two datasets is a back-end round trip, well
    // beyond the 1.5 s the default retries allow for
    await waitForValue(
      'Shape of interpolated psi/pressure plot',
      async () => {
        const active = (await getTestState()).active;
        return active.dataPlot[0]?.coordinates[0]?.shape;
      },
      [4, 298],
      (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected),
      100,
      300,
    );
  });

  it('Should crop the data in all plots by applying a data range', async () => {
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
    /// Add the URI of iter_scenario_53298_seq1_DD3.nc to the configuration and navigate in the accordion node tree
    ///
    const dataPath: string = await (
      await getDriver()
    ).executeScript(async () => {
      const path =
        (await window.api.fs.getZenodoDataPath()) +
        '/iter_scenario_53298_seq1_DD3.nc';
      return path;
    });
    await ensureCssElementIsDisplayed('config-uri-selection-modal');
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      dataPath,
      true,
    );
    await addUriAndAwaitSelection(dataPath);
    await findCssElementAndClickIt(
      'config-uri-selection-modal-validate-button',
      100,
      300,
    );
    await ensureCssElementIsDisplayed(`uriAccordion-${dataPath}`, 200, 100);
    await findCssElementAndClickIt(`uriAccordion-${dataPath}`, 200, 100);
    await findCssElementAndClickIt(
      `folder-${dataPath}#core_profiles:0/`,
      200,
      100,
    );
    await findCssElementAndClickIt(
      `folder-${dataPath}#core_profiles:0/profiles_1d[:]/`,
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
    // Click on j_total checkbox to start a new plot
    await findCssElementAndClickIt(
      `checkbox-${dataPath}#core_profiles:0/profiles_1d[:]/j_total`,
    );
    // Check that there is one dataplot created
    await waitForValue(
      'DataPlot configuration length',
      async () => (await getTestState()).active.dataPlot.length,
      1,
    );
    // Click on j_ohmic checkbox to plot a second data
    await findCssElementAndClickIt(
      `checkbox-${dataPath}#core_profiles:0/profiles_1d[:]/j_ohmic`,
    );
    // Check that there is two dataplot created
    await waitForValue(
      'Plot configuration length',
      async () => (await getTestState()).active.dataPlot[0].plot.length,
      2,
    );
    // Now we check integrity of data manipulation
    // Step 1 - The minimum and maximum original data for the two plots
    const originalDataFromActive = (await getTestState()).active;
    await waitForValue(
      'First y value of j_total at origin',
      async () => originalDataFromActive.dataPlot[0]?.plot[0]?.y[0],
      -1018173.9490004762,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_total at origin',
      async () =>
        originalDataFromActive.dataPlot[0]?.plot[0]?.y[
          originalDataFromActive.dataPlot[0]?.plot[0]?.y.length - 1
        ],
      -379752.40595339175,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'First y value of j_ohmic at origin',
      async () => originalDataFromActive.dataPlot[0]?.plot[1]?.y[0],
      -942579.3029552045,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_ohmic at origin',
      async () =>
        originalDataFromActive.dataPlot[0]?.plot[1]?.y[
          originalDataFromActive.dataPlot[0]?.plot[1]?.y.length - 1
        ],
      -34126.34158638138,
      (actual, expected) => actual === expected,
    );

    // Step 2 - Enter the data range, apply a range, confirm the change, and check the values
    await openCustomization(
      'visual-customization-access-button',
      'Axis range',
      'data-range-apply-input',
    );
    await writeTextInCssElement('data-range-min-input', '0.2', true);
    await writeTextInCssElement('data-range-max-input', '0.8', true);
    await findCssElementAndClickIt('data-range-apply-input');
    await new Promise((r) => setTimeout(r, 1500));
    await findCssElementAndClickIt('customization-save-button');
    await new Promise((r) => setTimeout(r, 1500));
    const activeAtFirstApplied = (await getTestState()).active;
    await waitForValue(
      'First y value of j_total at first applied',
      async () => activeAtFirstApplied.dataPlot[0]?.plot[0]?.y[0],
      -1409056.125,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_total at first applied',
      async () =>
        activeAtFirstApplied.dataPlot[0]?.plot[0]?.y[
          activeAtFirstApplied.dataPlot[0]?.plot[0]?.y.length - 1
        ],
      -402749.40625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'First y value of j_ohmic at first applied',
      async () => activeAtFirstApplied.dataPlot[0]?.plot[1]?.y[0],
      -1058855.625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_ohmic at first applied',
      async () =>
        activeAtFirstApplied.dataPlot[0]?.plot[1]?.y[
          activeAtFirstApplied.dataPlot[0]?.plot[1]?.y.length - 1
        ],
      -274728.34375,
      (actual, expected) => actual === expected,
    );

    // Step 3 - Enter the data range, apply a second range, confirm the change, and check the values
    await openCustomization(
      'visual-customization-access-button',
      'Axis range',
      'data-range-apply-input',
    );
    await writeTextInCssElement('data-range-min-input', '0.4', true);
    await writeTextInCssElement('data-range-max-input', '0.6', true);
    await findCssElementAndClickIt('data-range-apply-input');
    await new Promise((r) => setTimeout(r, 1500));
    await findCssElementAndClickIt('customization-save-button');
    await new Promise((r) => setTimeout(r, 1500));
    const activeAtSecondApplied = (await getTestState()).active;
    await waitForValue(
      'First y value of j_total at second applied',
      async () => activeAtSecondApplied.dataPlot[0]?.plot[0]?.y[0],
      -1159740.25,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_total at second applied',
      async () =>
        activeAtSecondApplied.dataPlot[0]?.plot[0]?.y[
          activeAtSecondApplied.dataPlot[0]?.plot[0]?.y.length - 1
        ],
      -697106.25,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'First y value of j_ohmic at second applied',
      async () => activeAtSecondApplied.dataPlot[0]?.plot[1]?.y[0],
      -910444.625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_ohmic at second applied',
      async () =>
        activeAtSecondApplied.dataPlot[0]?.plot[1]?.y[
          activeAtSecondApplied.dataPlot[0]?.plot[1]?.y.length - 1
        ],
      -506609.75,
      (actual, expected) => actual === expected,
    );

    // Step 4 - Enter the data range, apply a third, wider range, confirm the change, and check the values
    await openCustomization(
      'visual-customization-access-button',
      'Axis range',
      'data-range-apply-input',
    );
    await writeTextInCssElement('data-range-min-input', '0.2', true);
    await writeTextInCssElement('data-range-max-input', '0.8', true);
    await findCssElementAndClickIt('data-range-apply-input');
    await waitForValue(
      'Restore button finished loading',
      async () =>
        (
          await getCssElementFromDataTestId('data-range-apply-input')
        ).getAttribute('data-loading'),
      null,
      (actual, expected) => actual === expected,
    );
    await findCssElementAndClickIt('customization-save-button');
    await new Promise((r) => setTimeout(r, 1500));
    const activeAtThirdApplied = (await getTestState()).active;
    await waitForValue(
      'First y value of j_total at third applied',
      async () => activeAtThirdApplied.dataPlot[0]?.plot[0]?.y[0],
      -1409056.125,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_total at third applied',
      async () =>
        activeAtThirdApplied.dataPlot[0]?.plot[0]?.y[
          activeAtThirdApplied.dataPlot[0]?.plot[0]?.y.length - 1
        ],
      -402749.40625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'First y value of j_ohmic at third applied',
      async () => activeAtThirdApplied.dataPlot[0]?.plot[1]?.y[0],
      -1058855.625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_ohmic at third applied',
      async () =>
        activeAtThirdApplied.dataPlot[0]?.plot[1]?.y[
          activeAtThirdApplied.dataPlot[0]?.plot[1]?.y.length - 1
        ],
      -274728.34375,
      (actual, expected) => actual === expected,
    );

    // Step 5 - Enter the data range, restore the range, confirm the change, and check if the values have returned to their original state
    await openCustomization(
      'visual-customization-access-button',
      'Axis range',
      'data-range-apply-input',
    );
    await findCssElementAndClickIt('data-range-restore-input');
    await waitForValue(
      'Restore button finished loading',
      async () =>
        (
          await getCssElementFromDataTestId('data-range-restore-input')
        ).getAttribute('data-loading'),
      null,
      (actual, expected) => actual === expected,
      10,
    );
    await findCssElementAndClickIt('customization-save-button');
    await new Promise((r) => setTimeout(r, 1500));
    const restoredDataFromActive = (await getTestState()).active;
    await waitForValue(
      'First y value of j_total at restoration',
      async () => restoredDataFromActive.dataPlot[0]?.plot[0]?.y[0],
      -1018173.9375,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_total at restoration',
      async () =>
        restoredDataFromActive.dataPlot[0]?.plot[0]?.y[
          restoredDataFromActive.dataPlot[0]?.plot[0]?.y.length - 1
        ],
      -379752.40625,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'First y value of j_ohmic at restoration',
      async () => restoredDataFromActive.dataPlot[0]?.plot[1]?.y[0],
      -942579.3125,
      (actual, expected) => actual === expected,
    );
    await waitForValue(
      'Last y value of j_ohmic at restoration',
      async () =>
        restoredDataFromActive.dataPlot[0]?.plot[1]?.y[
          restoredDataFromActive.dataPlot[0]?.plot[1]?.y.length - 1
        ],
      -34126.33984375,
      (actual, expected) => actual === expected,
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
    /// Add the URI of iter_scenario_53298_seq1_DD3.nc to the configuration and navigate in the accordion node tree
    ///
    const dataPath: string = await (
      await getDriver()
    ).executeScript(async () => {
      const path =
        (await window.api.fs.getZenodoDataPath()) +
        '/iter_scenario_53298_seq1_DD3.nc';
      return path;
    });
    const uriModal = await ensureCssElementIsDisplayed(
      'config-uri-selection-modal',
    );
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      dataPath,
      true,
    );
    await addUriAndAwaitSelection(dataPath);
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

  /*
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
      // TODO : use dataPath
      'config-uri-selection-modal-uri-text-input',
      'imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3',
      true,
    );
    await addUriAndAwaitSelection(
      'imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3',
    );
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
  */
});
