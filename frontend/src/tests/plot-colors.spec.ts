import { expect } from 'chai';
import {
  getDriver,
  getTestState,
  startApp,
  stopApp,
  waitForApi,
} from './setup';
import {
  CURRENT_HALO_POL,
  DISRUPTION_FOLDERS,
  findCssElementAndClickIt,
  getCssElementFromDataTestId,
  openCustomization,
  POWER_OHM,
  POWER_OHM_HALO,
  resetAppState,
  saveCustomization,
  selectCustomizationTab,
  setupGrid,
  waitForValue,
} from './utils';
import '../config/bridge';

/**
 * UI Test Suite for the default colours of 1D curves.
 *
 * A curve gets the first palette colour no other curve of its grid uses, and
 * keeps it while other curves come and go. Plotly's own default colours by
 * trace index, which gave a re-added curve the colour of another one.
 */
describe('UI Tests for 1D curve colours', function () {
  this.timeout(300000);

  /** First entries of `defaultColorsRGB` (`src/renderer/utils/plotColors.ts`). */
  const BLUE = 'rgb(31, 119, 180)';
  const ORANGE = 'rgb(255, 127, 14)';
  const GREEN = 'rgb(44, 160, 44)';

  const LEAVES = [POWER_OHM, POWER_OHM_HALO, CURRENT_HALO_POL];

  /** The tests always build a single grid, so its index is stable. */
  const getGrid = async () => (await getTestState()).active.dataPlot[0];

  /** Colour of each stored trace, keyed by node URI. */
  const storedColors = async () =>
    Object.fromEntries(
      (await getGrid()).plot.map((plot) => [plot.nodeUri, plot.line?.color]),
    );

  /** Colours Plotly drew, keyed by trace name, error bands left out. */
  const renderedColors = async (): Promise<Record<string, string>> =>
    await getDriver().executeScript(() => {
      const graphDiv = document.querySelector('.js-plotly-plot') as unknown as {
        _fullData?: { name: string; line?: { color?: string } }[];
      };
      return Object.fromEntries(
        (graphDiv?._fullData ?? [])
          .filter((trace) => trace.name !== 'error bands' && trace.name)
          .map((trace) => [trace.name, trace.line?.color]),
      );
    });

  const expectDistinct = (colors: (string | undefined)[], label: string) => {
    colors.forEach((color, index) =>
      expect(color, `${label}: colour of trace ${index}`).to.be.a('string'),
    );
    expect(new Set(colors).size, `${label}: colours ${colors}`).to.equal(
      colors.length,
    );
  };

  /** Toggles a leaf in the tree and waits for the grid to hold `count` plots. */
  const toggleLeaf = async (nodeUri: string, count: number) => {
    await findCssElementAndClickIt(`checkbox-${nodeUri}`, 200, 100);
    await waitForValue(
      `Plot count after toggling ${nodeUri}`,
      async () => (await getGrid())?.plot.length,
      count,
      (actual, expected) => actual === expected,
      100,
      300,
    );
  };

  before(async () => {
    await startApp();
    await waitForApi();
  });

  after(async () => {
    await stopApp();
  });

  beforeEach(async () => {
    await resetAppState();
  });

  afterEach(async () => {
    await resetAppState();
  });

  it('Should keep curve colours distinct when curves are removed and added back', async () => {
    const grid = await setupGrid({
      configName: 'Curve colours',
      folders: DISRUPTION_FOLDERS,
      leaves: LEAVES,
    });
    const [a, b, c] = grid.nodeUris;

    // Colours are assigned when a curve is added, in palette order
    expect(await storedColors()).to.deep.equal({
      [a]: BLUE,
      [b]: ORANGE,
      [c]: GREEN,
    });

    // Plotly draws the stored colours, not its index-based default. It lists
    // traces in its own order (y2 ones first), so compare per name.
    const sorted = (colors: Record<string, string>) =>
      JSON.stringify(Object.entries(colors).sort());
    await waitForValue(
      'Rendered colours match the stored ones',
      async () => sorted(await renderedColors()),
      sorted(
        Object.fromEntries(
          (await getGrid()).plot.map((p) => [p.name, p.line?.color]),
        ),
      ),
      (actual, expected) => actual === expected,
      100,
      300,
    );

    // Removing the first curve leaves the others' colours alone...
    await toggleLeaf(a, 2);
    expect(await storedColors()).to.deep.equal({ [b]: ORANGE, [c]: GREEN });

    // ...and adding it back gives it the freed colour, although it now comes
    // last, where the index-based default would have made it green like `c`
    await toggleLeaf(a, 3);
    expect(await storedColors()).to.deep.equal({
      [b]: ORANGE,
      [c]: GREEN,
      [a]: BLUE,
    });

    // Same with the curve that is now first
    await toggleLeaf(b, 2);
    await toggleLeaf(b, 3);
    const colors = await storedColors();
    expect(colors).to.deep.equal({ [c]: GREEN, [a]: BLUE, [b]: ORANGE });
    expectDistinct(Object.values(colors), 'After removing and adding back');
  });

  it('Should show each curve colour in the customization panel and reset them to distinct ones', async () => {
    const grid = await setupGrid({
      configName: 'Curve colours reset',
      folders: DISRUPTION_FOLDERS,
      leaves: LEAVES,
    });
    const [a, b, c] = grid.nodeUris;

    // Out of palette order: trace order becomes c, a, b
    await toggleLeaf(a, 2);
    await toggleLeaf(a, 3);
    await toggleLeaf(b, 2);
    await toggleLeaf(b, 3);
    expect(await storedColors()).to.deep.equal({
      [c]: GREEN,
      [a]: BLUE,
      [b]: ORANGE,
    });

    // Opening the panel used to crash on the grid not being resolved yet
    await openCustomization(
      'visual-customization-access-button',
      '1D plots',
      'plot-colors-reset-button',
    );

    // The colour input shows the selected curve's colour
    const plotOfA = (await getGrid()).plot.find((p) => p.nodeUri === a);
    await selectCustomizationTab(plotOfA.name);
    await waitForValue(
      'Colour input of the selected curve',
      async () =>
        (await getCssElementFromDataTestId('plot-color-input')).getAttribute(
          'value',
        ),
      BLUE,
      (actual, expected) => actual === expected,
      100,
      300,
    );

    // Reset hands out the palette again, in trace order
    await findCssElementAndClickIt('plot-colors-reset-button', 200, 100);
    await waitForValue(
      'Colour input after reset',
      async () =>
        (await getCssElementFromDataTestId('plot-color-input')).getAttribute(
          'value',
        ),
      ORANGE,
      (actual, expected) => actual === expected,
      100,
      300,
    );
    await saveCustomization();

    const colors = await storedColors();
    expect(colors).to.deep.equal({ [c]: BLUE, [a]: ORANGE, [b]: GREEN });
    expectDistinct(Object.values(colors), 'After reset');
  });
});
