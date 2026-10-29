import { expect } from 'chai';
import { By, Key } from 'selenium-webdriver';
import {
  addUriAndAwaitSelection,
  ensureCssElementIsDisplayed,
  findCssElementAndClickIt,
  getDatasetPath,
  waitForElementToDisappear,
  waitForValue,
  writeTextInCssElement,
  openTreeFolder,
  openUriAccordion,
} from './utils';
import {
  getDriver,
  getTestState,
  setTestState,
  startApp,
  stopApp,
  waitForApi,
} from './setup';

/**
 * Synchronized grids move together.
 *
 * The canvas is the shape the feature is actually used in: two panels, each
 * plotting a *different* node of one IDS, over the coordinate they share. Both
 * fetched `equilibrium/time` inside their own node's response, so the two time
 * arrays are equal values held under two different payload keys - precisely the
 * case a payload-key comparison gets wrong while every other spec stays green.
 */

const DATASET = 'iter_disruption_113112_1.nc';
const EQUILIBRIUM = 'equilibrium:0';
const TIME_SLICE = `${EQUILIBRIUM}/time_slice[:]`;
const PROFILES_2D = `${TIME_SLICE}/profiles_2d[:]`;
/** Retry budget for steps that wait on a backend round trip. */
const SLOW = { retries: 200, delay: 300 };

let firstGridId = '';
let secondGridId = '';

describe('Synchronized grids', function () {
  this.timeout(300000);

  before(async () => {
    await startApp();
    await waitForApi();
    await setTestState({ configurations: [], active: null });
    await buildCanvas();
  });

  after(async () => {
    await setTestState({ configurations: [], active: null });
    await stopApp();
  });

  it('moves a linked panel that holds the same coordinate under another key', async () => {
    // The two panels carry equal time values registered under different keys.
    const before = await getTestState();
    expect(
      timeRefOf(before, firstGridId),
      'the two panels must hold the shared coordinate under different payload keys, ' +
        'or this spec is not exercising the case it exists for',
    ).to.not.equal(timeRefOf(before, secondGridId));

    const started = cursorOf(before, firstGridId);
    expect(cursorOf(before, secondGridId)).to.equal(started);

    const moved = await stepSlider(firstGridId, Key.ARROW_UP);
    expect(moved, 'the slider must have somewhere to go').to.not.equal(started);

    await waitForValue(
      'linked panel cursor',
      async () => cursorOf(await getTestState(), secondGridId),
      moved,
      undefined,
      SLOW.retries,
      SLOW.delay,
    );
  });

  it('redraws the linked panel, not only its cursor', async () => {
    // Moving the cursor without repainting is the same bug from the user's
    // side, and a heatmap draws `z`, which is derived where it is drawn and so
    // never reaches the state bridge. The redraw counter is what can be asked.
    await getDriver().executeScript('window.__ibexPerf.reset()');

    const moved = await stepSlider(firstGridId, Key.ARROW_DOWN);
    await waitForValue(
      'linked panel cursor',
      async () => cursorOf(await getTestState(), secondGridId),
      moved,
      undefined,
      SLOW.retries,
      SLOW.delay,
    );

    const redraws: Record<string, number> = await getDriver().executeScript(
      'return window.__ibexPerf.snapshot().redraws',
    );
    expect(
      redraws[secondGridId] ?? 0,
      'the linked panel must repaint, not just move its cursor',
    ).to.be.greaterThan(0);
  });

  it('leaves an unlinked panel where it was', async () => {
    const linked = await getTestState();
    await setTestState({
      active: {
        ...linked.active,
        dataPlot: linked.active.dataPlot.map((grid) => ({
          ...grid,
          synchronizedGrids: { color: '', list: [] },
        })),
      },
    } as never);

    const before = cursorOf(await getTestState(), secondGridId);
    const moved = await stepSlider(firstGridId, Key.ARROW_UP);
    expect(moved, 'the slider must have somewhere to go').to.not.equal(before);

    expect(
      cursorOf(await getTestState(), secondGridId),
      'a panel nobody linked must not follow',
    ).to.equal(before);
  });
});

/** The cursor a grid's time coordinate sits on. */
function cursorOf(
  state: Awaited<ReturnType<typeof getTestState>>,
  gridId: string,
): number {
  const grid = state.active.dataPlot.find((item) => item.i === gridId);
  return grid.coordinates.find((coord) => coord.name === 'time').valueIndex;
}

/** The payload key naming a grid's time coordinate. */
function timeRefOf(
  state: Awaited<ReturnType<typeof getTestState>>,
  gridId: string,
): string | undefined {
  const grid = state.active.dataPlot.find((item) => item.i === gridId);
  return grid.coordinates.find((coord) => coord.name === 'time').dataRef;
}

/**
 * Steps one panel's time slider the way a user does, and returns where its
 * cursor ended up. The caller asserts against that rather than against a fixed
 * index: focusing the control is itself a pointer event, so the step it lands
 * on is the browser's to decide, not the spec's.
 */
async function stepSlider(gridId: string, key: string): Promise<number> {
  // Sliders are operable only while their grid is being edited.
  await setGridEditing(gridId, true);
  const slider = await getDriver().findElement(
    By.css(`[data-testid="grid-${gridId}"] [data-testid="slider-time"]`),
  );
  await slider.sendKeys(key);
  await getDriver().sleep(600);
  await setGridEditing(gridId, false);
  return cursorOf(await getTestState(), gridId);
}

/** Puts one grid in or out of edit mode through the e2e state bridge. */
async function setGridEditing(gridId: string, editing: boolean) {
  await setTestState({ editingGridId: editing ? gridId : null } as never);
  await waitForValue(
    `grid ${editing ? 'entered' : 'left'} edit mode`,
    async () => (await getTestState()).editingGridId ?? null,
    editing ? gridId : null,
  );
}

/**
 * Builds the two-panel canvas and links the panels. The link itself is written
 * through the state bridge: what is under test is which grids a slider moves,
 * not the synchronization panel that declares them.
 */
async function buildCanvas() {
  await findCssElementAndClickIt('header-add-configuration');
  await ensureCssElementIsDisplayed('config-create-modal');
  await writeTextInCssElement('config-create-name-input', 'Sync', true);
  await findCssElementAndClickIt('config-create-submit-button');
  await waitForValue(
    'configuration created',
    async () => (await getTestState()).configurations.length,
    1,
  );

  const dataPath = await getDatasetPath(DATASET);
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
  await waitForElementToDisappear(uriModal, 60000);

  await ensureCssElementIsDisplayed(`uriAccordion-${dataPath}`, 600, 100);
  await openUriAccordion(dataPath);
  await openTreeFolder(`folder-${dataPath}#${EQUILIBRIUM}/`);
  await openTreeFolder(`folder-${dataPath}#${TIME_SLICE}/`);
  await openTreeFolder(`folder-${dataPath}#${PROFILES_2D}/`);

  firstGridId = await addGrid(dataPath, `${PROFILES_2D}/psi`, 1);
  secondGridId = await addGrid(dataPath, `${PROFILES_2D}/b_field_r`, 2);

  await setTestState({
    active: {
      ...(await getTestState()).active,
      dataPlot: (await getTestState()).active.dataPlot.map((grid) => ({
        ...grid,
        synchronizedGrids: {
          color: '#18c42e',
          list: [grid.i === firstGridId ? secondGridId : firstGridId],
        },
      })),
    },
  } as never);
}

/**
 * Checks one leaf into a panel of its own, then leaves the panel and unchecks
 * the leaf again.
 *
 * Both steps are needed. A newly created grid stays in edit mode and would take
 * the next leaf as a second trace; and `handleNewPlot` plots `nodes[0]` of the
 * cumulative checked list, so a leaf checked on top of another one replots the
 * first. Unchecking keeps that list empty between panels.
 */
async function addGrid(
  dataPath: string,
  leaf: string,
  expectedGrids: number,
): Promise<string> {
  await findCssElementAndClickIt(`checkbox-${dataPath}#${leaf}`, 200, 100);
  await waitForValue(
    `grid count after ${leaf}`,
    async () => (await getTestState()).active.dataPlot.length,
    expectedGrids,
    undefined,
    SLOW.retries,
    SLOW.delay,
  );
  const gridId = (await getTestState()).active.dataPlot[expectedGrids - 1].i;
  await waitForValue(
    `coordinates of ${leaf}`,
    async () =>
      (await getTestState()).active.dataPlot[expectedGrids - 1].coordinates
        .length,
    4,
    undefined,
    SLOW.retries,
    SLOW.delay,
  );
  await setGridEditing(gridId, false);
  await findCssElementAndClickIt(`checkbox-${dataPath}#${leaf}`, 200, 100);
  await waitForValue(
    `${leaf} unchecked`,
    async () => (await getTestState()).active.checkedNodeURI.length,
    0,
    undefined,
    SLOW.retries,
    SLOW.delay,
  );
  return gridId;
}
