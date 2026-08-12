import { expect } from 'chai';
import { getTestState, startApp, stopApp, waitForApi } from './setup';
import {
  clickAndAwaitLoading,
  CURRENT_HALO_POL,
  DISRUPTION_FOLDERS,
  expectNoNotification,
  findCssElementAndClickIt,
  getCssElementFromDataTestId,
  openDataCustomization,
  POWER_OHM,
  POWER_OHM_HALO,
  readAxisTitles,
  readNotifications,
  readPlotlyTraces,
  resetAppState,
  saveCustomization,
  selectCustomizationTab,
  selectMantineOption,
  setupGrid,
  waitForNotification,
  waitForValue,
  writeTextInCssElement,
} from './utils';
import '../config/bridge';

/**
 * UI Test Suite for the "Data manipulation" panel (smoothing & data operations).
 *
 * Every numeric expectation is expressed against the raw values captured by
 * `setupGrid`, so the suite stays valid if the datasets or scipy change.
 */
describe('UI Tests for data manipulation', function () {
  // Each test drives several apply / save round trips against the real back-end
  this.timeout(300000);

  /** The tests always build a single grid, so its index is stable. */
  const getGrid = async () => (await getTestState()).active.dataPlot[0];

  /**
   * Asserts an optional field carries no value.
   *
   * A field the app explicitly resets travels through the IPC bridge as `null`,
   * while a field it never wrote stays `undefined`: both mean "not set".
   */
  const expectUnset = (value: unknown, label: string) =>
    expect(value ?? undefined, label).to.equal(undefined);

  before(async () => {
    await startApp();
    await waitForApi();
  });

  after(async () => {
    await stopApp();
  });

  // The Electron instance is shared across specs and runs, so each test starts
  // by clearing whatever the previous one left behind
  beforeEach(async () => {
    await resetAppState();
  });

  afterEach(async () => {
    await resetAppState();
  });

  it('Should apply a gaussian smoothing and restore the original data', async () => {
    const grid = await setupGrid({
      configName: 'Gaussian smoothing',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    await openDataCustomization('Data smoothing');
    await selectMantineOption('data-smoothing-method', 'gaussian_filter');
    await writeTextInCssElement('data-smoothing-sigma', '2', true);
    await clickAndAwaitLoading('data-smoothing-apply-button');

    // The panel edits a local state: the rendered graph is the only observable
    // proof that the request landed before the grid is saved
    await waitForValue(
      'Gaussian smoothing changed the rendered trace',
      async () => (await readPlotlyTraces())[0].y[0],
      grid.rawY[0][0],
      (actual, expected) => actual !== expected,
    );

    await saveCustomization();

    const smoothed = await getGrid();
    expect(smoothed.plot[0].smoothing.smoothing_method).to.equal(
      'gaussian_filter',
    );
    expect(smoothed.plot[0].smoothing.gaussian_smoothing_sigma).to.equal(2);
    expect(smoothed.plot[0].y.length).to.equal(grid.rawY[0].length);
    smoothed.plot[0].y.forEach((value, index) =>
      expect(value, `smoothed point ${index}`).to.not.equal(
        grid.rawY[0][index],
      ),
    );

    // Smoothing changes neither the unit nor the axis distribution
    expect(smoothed.plot[0].unit).to.equal('W');
    expect(smoothed.plot[0].yaxis).to.equal('');
    expectUnset(smoothed.y2AxisData, 'second Y axis after smoothing');

    // Only the plot of the selected tab is updated
    expect(smoothed.plot[1].y).to.deep.equal(grid.rawY[1]);

    await openDataCustomization('Data smoothing');
    await clickAndAwaitLoading('data-smoothing-restore-button');
    await saveCustomization();

    const restored = await getGrid();
    expectUnset(restored.plot[0].smoothing, 'smoothing after restore');
    expect(restored.plot[0].y).to.deep.equal(grid.rawY[0]);
  });

  it('Should apply a savitzky-golay smoothing and keep every parameter', async () => {
    const grid = await setupGrid({
      configName: 'Savgol smoothing',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    await openDataCustomization('Data smoothing');
    await selectMantineOption('data-smoothing-method', 'savitzky-golay_filter');

    // The shipped defaults cannot be used on this signal: it holds 3 samples,
    // so `window_length=5` with mode `interp` is rejected by scipy, and a
    // `window_length=3` / `polyorder=2` fit reproduces the input exactly.
    await writeTextInCssElement('data-smoothing-window-length', '3', true);
    await writeTextInCssElement('data-smoothing-polyorder', '1', true);
    await writeTextInCssElement('data-smoothing-deriv', '0', true);
    await writeTextInCssElement('data-smoothing-delta', '2', true);
    await selectMantineOption('data-smoothing-mode', 'nearest');
    await writeTextInCssElement('data-smoothing-cval', '5', true);
    await clickAndAwaitLoading('data-smoothing-apply-button');

    await waitForValue(
      'Savitzky-Golay smoothing changed the rendered trace',
      async () => (await readPlotlyTraces())[0].y[0],
      grid.rawY[0][0],
      (actual, expected) => actual !== expected,
    );

    await saveCustomization();

    const smoothed = await getGrid();
    expect(smoothed.plot[0].smoothing).to.deep.equal({
      smoothing_method: 'savitzky-golay_filter',
      savgol_smoothing_window_length: 3,
      savgol_smoothing_polyorder: 1,
      savgol_smoothing_deriv: 0,
      savgol_smoothing_delta: 2,
      savgol_smoothing_mode: 'nearest',
      savgol_smoothing_cval: 5,
    });
    smoothed.plot[0].y.forEach((value, index) =>
      expect(value, `smoothed point ${index}`).to.not.equal(
        grid.rawY[0][index],
      ),
    );
    expect(smoothed.plot[1].y).to.deep.equal(grid.rawY[1]);

    // Re-opening the panel must repopulate the inputs from the saved grid. The
    // fields are filled once the page has resolved its grid, so they are polled
    // rather than read straight after the accordion expands.
    await openDataCustomization('Data smoothing');
    const inputValue = (testId: string) => async () =>
      (await getCssElementFromDataTestId(testId)).getAttribute('value');

    await waitForValue(
      'Smoothing method repopulated',
      inputValue('data-smoothing-method'),
      'savitzky-golay_filter',
      (actual, expected) => actual === expected,
      100,
      100,
    );
    await waitForValue(
      'Window length repopulated',
      inputValue('data-smoothing-window-length'),
      '3',
      (actual, expected) => actual === expected,
      100,
      100,
    );
    await waitForValue(
      'Mode repopulated',
      inputValue('data-smoothing-mode'),
      'nearest',
      (actual, expected) => actual === expected,
      100,
      100,
    );
  });

  it('Should chain constant operations and restore the original data', async () => {
    const grid = await setupGrid({
      configName: 'Constant operations',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    await openDataCustomization('Data operations');
    await selectMantineOption('data-operation-type-0', 'mul');
    await writeTextInCssElement('data-operation-value-0', '2', true);
    await clickAndAwaitLoading('data-operations-apply-button');

    // Asserted on the rendered graph: the panel is kept open to chain the second
    // row, since each open/save round trip is by far the slowest step here
    const multiplied = await readPlotlyTraces();
    multiplied[0].y.forEach((value, index) =>
      expect(value, `multiplied point ${index}`).to.equal(
        grid.rawY[0][index] * 2,
      ),
    );
    expect(multiplied[1].y).to.deep.equal(grid.rawY[1]);

    // Chain a second row: rows are applied in order
    await findCssElementAndClickIt('data-operations-add-button');
    await selectMantineOption('data-operation-type-1', 'add');
    await writeTextInCssElement('data-operation-value-1', '1000', true);
    await clickAndAwaitLoading('data-operations-apply-button');

    await waitForValue(
      'Chained operations changed the rendered trace',
      async () => (await readPlotlyTraces())[0].y[0],
      grid.rawY[0][0] * 2 + 1000,
    );

    await saveCustomization();

    const chained = await getGrid();
    chained.plot[0].y.forEach((value, index) =>
      expect(value, `chained point ${index}`).to.equal(
        grid.rawY[0][index] * 2 + 1000,
      ),
    );
    expect(chained.plot[0].operations).to.deep.equal([
      { kind: 'unary', type: 'mul', value: 2 },
      { kind: 'unary', type: 'add', value: 1000 },
    ]);

    // Constant operations never change the unit, so no second axis is opened
    expect(chained.plot[0].unit).to.equal('W');
    expectUnset(chained.y2AxisData, 'second Y axis after constant operations');
    expect(chained.plot[1].y).to.deep.equal(grid.rawY[1]);

    await openDataCustomization('Data operations');
    await clickAndAwaitLoading('data-operations-restore-button');
    await saveCustomization();

    const restored = await getGrid();
    expectUnset(restored.plot[0].operations, 'operations after restore');
    expect(restored.plot[0].y).to.deep.equal(grid.rawY[0]);
  });

  it('Should move a plot to a second Y axis when a signal operation changes its unit', async () => {
    const grid = await setupGrid({
      configName: 'Signal operation unit',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    // Both signals are in watts, so the grid starts with a single Y axis
    const before = await getGrid();
    expect(before.yAxisData.unit).to.equal('W');
    expectUnset(before.y2AxisData, 'second Y axis before the operation');

    await openDataCustomization('Data operations');
    await selectMantineOption('data-operation-kind-0', 'signal');
    await selectMantineOption('data-operation-type-0', 'mul');
    await selectMantineOption('data-operation-signal-0', grid.nodeUris[1]);
    await clickAndAwaitLoading('data-operations-apply-button');

    // The unit computed by the back-end must reach the rendered second Y axis
    await waitForValue(
      'Second Y axis title shows the combined unit',
      async () => (await readAxisTitles()).y2,
      'W*W',
      (actual, expected) => actual.includes(expected),
    );

    await saveCustomization();

    const combined = await getGrid();
    expect(combined.plot[0].yaxis).to.equal('y2');
    expect(combined.plot[0].unit).to.equal('W*W');
    expect(combined.y2AxisData.unit).to.equal('W*W');
    expect(combined.y2AxisData.name).to.equal('power_ohm');
    expect(combined.yAxisData.unit).to.equal('W');
    combined.plot[0].y.forEach((value, index) =>
      expect(value, `combined point ${index}`).to.equal(
        grid.rawY[0][index] * grid.rawY[1][index],
      ),
    );
    expect(combined.plot[0].operations).to.deep.equal([
      { kind: 'signal', type: 'mul', value: grid.nodeUris[1] },
    ]);

    // The operand itself is left untouched on the primary axis
    expect(combined.plot[1].y).to.deep.equal(grid.rawY[1]);
    expect(combined.plot[1].yaxis).to.equal('');

    // Restoring brings the unit back and collapses the second axis
    await openDataCustomization('Data operations');
    await clickAndAwaitLoading('data-operations-restore-button');
    await saveCustomization();

    const restored = await getGrid();
    expect(restored.plot[0].y).to.deep.equal(grid.rawY[0]);
    expect(restored.plot[0].unit).to.equal('W');
    expect(restored.plot[0].yaxis).to.equal('');
    expectUnset(restored.y2AxisData, 'second Y axis after restore');
    expect(restored.yAxisData.unit).to.equal('W');
  });

  it('Should keep smoothing and operations applied together', async () => {
    const grid = await setupGrid({
      configName: 'Smoothing and operations',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    await openDataCustomization('Data smoothing');
    await selectMantineOption('data-smoothing-method', 'gaussian_filter');
    await writeTextInCssElement('data-smoothing-sigma', '2', true);
    await clickAndAwaitLoading('data-smoothing-apply-button');
    await waitForValue(
      'Gaussian smoothing changed the rendered trace',
      async () => (await readPlotlyTraces())[0].y[0],
      grid.rawY[0][0],
      (actual, expected) => actual !== expected,
    );
    await saveCustomization();

    // Captured from the app, never hard-coded
    const gaussY = (await getGrid()).plot[0].y as number[];

    await openDataCustomization('Data operations');
    await selectMantineOption('data-operation-type-0', 'mul');
    await writeTextInCssElement('data-operation-value-0', '2', true);
    await clickAndAwaitLoading('data-operations-apply-button');
    await waitForValue(
      'Operation applied on top of the smoothing',
      async () => (await readPlotlyTraces())[0].y[0],
      gaussY[0] * 2,
    );
    await saveCustomization();

    // The back-end applies constant operations before smoothing, and scaling by
    // a power of two is exact in IEEE-754, so gauss(2x) === 2 * gauss(x)
    const withBoth = await getGrid();
    withBoth.plot[0].y.forEach((value, index) =>
      expect(value, `point ${index}`).to.equal(gaussY[index] * 2),
    );
    expect(withBoth.plot[0].smoothing.smoothing_method).to.equal(
      'gaussian_filter',
    );
    expect(withBoth.plot[0].smoothing.gaussian_smoothing_sigma).to.equal(2);
    expect(withBoth.plot[0].operations).to.deep.equal([
      { kind: 'unary', type: 'mul', value: 2 },
    ]);

    // Re-applying the smoothing must not drop the operations
    await openDataCustomization('Data smoothing');
    await clickAndAwaitLoading('data-smoothing-apply-button');
    await saveCustomization();

    const reapplied = await getGrid();
    reapplied.plot[0].y.forEach((value, index) =>
      expect(value, `re-applied point ${index}`).to.equal(gaussY[index] * 2),
    );
    expect(reapplied.plot[0].operations).to.deep.equal([
      { kind: 'unary', type: 'mul', value: 2 },
    ]);

    // Restoring the operations must keep the smoothing
    await openDataCustomization('Data operations');
    await clickAndAwaitLoading('data-operations-restore-button');
    await saveCustomization();

    const restored = await getGrid();
    expectUnset(restored.plot[0].operations, 'operations after restore');
    expect(restored.plot[0].smoothing.smoothing_method).to.equal(
      'gaussian_filter',
    );
    expect(restored.plot[0].y).to.deep.equal(gaussY);
  });

  it('Should apply an operation only to the plot of the selected tab', async () => {
    const grid = await setupGrid({
      configName: 'Selected tab only',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, POWER_OHM_HALO],
    });

    await openDataCustomization('Data operations');
    await selectCustomizationTab(grid.plotNames[1]);
    await selectMantineOption('data-operation-type-0', 'mul');
    await writeTextInCssElement('data-operation-value-0', '3', true);
    await clickAndAwaitLoading('data-operations-apply-button');

    await waitForValue(
      'Operation applied on the second plot',
      async () => (await readPlotlyTraces())[1].y[0],
      grid.rawY[1][0] * 3,
    );

    await saveCustomization();

    const updated = await getGrid();
    updated.plot[1].y.forEach((value, index) =>
      expect(value, `operand point ${index}`).to.equal(grid.rawY[1][index] * 3),
    );
    expect(updated.plot[1].operations).to.deep.equal([
      { kind: 'unary', type: 'mul', value: 3 },
    ]);

    expect(updated.plot[0].y).to.deep.equal(grid.rawY[0]);
    expectUnset(updated.plot[0].operations, 'operations of the untouched plot');
  });

  it('Should refuse a signal operation needing a third Y axis', async () => {
    const grid = await setupGrid({
      configName: 'Too many units',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, CURRENT_HALO_POL],
    });

    // Watts and amperes already occupy both Y axes
    const before = await getGrid();
    expect(before.yAxisData.unit).to.equal('W');
    expect(before.y2AxisData.unit).to.equal('A');
    expect(before.plot[1].yaxis).to.equal('y2');

    await openDataCustomization('Data operations');
    await selectMantineOption('data-operation-kind-0', 'signal');
    await selectMantineOption('data-operation-type-0', 'mul');
    await selectMantineOption('data-operation-signal-0', grid.nodeUris[1]);
    await clickAndAwaitLoading('data-operations-apply-button');

    const message = await waitForNotification('Too many units');
    expect(message).to.contain('W*A');
    expect(message).to.contain('two y axes');

    // The whole update is discarded, so the rendered grid is untouched
    const traces = await readPlotlyTraces();
    expect(traces[0].y).to.deep.equal(grid.rawY[0]);
    expect((await readAxisTitles()).y2).to.contain('[A]');

    await saveCustomization();

    const after = await getGrid();
    expect(after.plot[0].y).to.deep.equal(grid.rawY[0]);
    expect(after.plot[0].unit).to.equal('W');
    expect(after.plot[0].yaxis).to.equal('');
    expect(after.y2AxisData.unit).to.equal('A');
    expect(after.plot[1].y).to.deep.equal(grid.rawY[1]);

    // The row the user typed is kept: it is persisted on change, not on apply
    expect(after.plot[0].operations[0].kind).to.equal('signal');
    expect(after.plot[0].operations[0].type).to.equal('mul');
  });

  it('Should report the server error when adding signals with different units', async () => {
    const grid = await setupGrid({
      configName: 'Incompatible units',
      folders: DISRUPTION_FOLDERS,
      leaves: [POWER_OHM, CURRENT_HALO_POL],
    });

    await openDataCustomization('Data operations');
    await selectMantineOption('data-operation-kind-0', 'signal');
    await selectMantineOption('data-operation-type-0', 'add');
    await selectMantineOption('data-operation-signal-0', grid.nodeUris[1]);
    await clickAndAwaitLoading('data-operations-apply-button');

    const message = await waitForNotification('Error 466');
    expect(message).to.contain('Cannot add signals with different units');

    // The detailed server message must not be doubled by the generic one
    const notifications = await readNotifications();
    expect(notifications.length).to.equal(1);
    await expectNoNotification('Error');

    const traces = await readPlotlyTraces();
    expect(traces[0].y).to.deep.equal(grid.rawY[0]);

    await saveCustomization();

    const after = await getGrid();
    expect(after.plot[0].y).to.deep.equal(grid.rawY[0]);
    expect(after.plot[0].unit).to.equal('W');
    expect(after.y2AxisData.unit).to.equal('A');
  });
});
