import { expect } from 'chai';
import { Key } from 'selenium-webdriver';
import {
  startApp,
  getDriver,
  stopApp,
  waitForApi,
  getTestState,
} from './setup';
import {
  addUriAndAwaitSelection,
  closeUriAccordion,
  ensureCssElementIsDisplayed,
  findCssElementAndClickIt,
  getCssElementFromDataTestId,
  getDatasetPath,
  openTreeFolder,
  openUriAccordion,
  resetAppState,
  waitForElementToDisappear,
  waitForValue,
  writeTextInCssElement,
} from './utils';
import '../config/bridge';

const SCENARIO_FILE = 'iter_scenario_53298_seq1_DD3.nc';
const DISRUPTION_FILE = 'iter_disruption_113112_1.nc';

const EQUILIBRIUM = 'equilibrium:0/';
const TIME_SLICE = `${EQUILIBRIUM}time_slice[:]/`;
const PROFILES_1D = `${TIME_SLICE}profiles_1d/`;

/** Creates a configuration browsing both datasets, and returns their URIs. */
async function setupConfiguration(name: string): Promise<[string, string]> {
  await findCssElementAndClickIt('header-add-configuration');
  const configCreateModal = await ensureCssElementIsDisplayed(
    'config-create-modal',
  );
  await writeTextInCssElement('config-create-name-input', name, true);
  await findCssElementAndClickIt('config-create-submit-button');
  await waitForElementToDisappear(configCreateModal);

  const paths: [string, string] = [
    await getDatasetPath(SCENARIO_FILE),
    await getDatasetPath(DISRUPTION_FILE),
  ];
  const uriModal = await ensureCssElementIsDisplayed(
    'config-uri-selection-modal',
  );
  for (const path of paths) {
    await writeTextInCssElement(
      'config-uri-selection-modal-uri-text-input',
      path,
      true,
    );
    await addUriAndAwaitSelection(path);
  }
  await findCssElementAndClickIt(
    'config-uri-selection-modal-validate-button',
    100,
    300,
  );
  await waitForElementToDisappear(uriModal, 30000);
  return paths;
}

/** Opens every folder down to `folder`, parents first. */
async function openPath(dataPath: string, folders: string[]) {
  for (const folder of folders) {
    await openTreeFolder(`folder-${dataPath}#${folder}`, 60000);
  }
}

const isFolderOpen = async (dataPath: string, folder: string) =>
  (await getDriver().executeScript(
    (testId: string) =>
      document
        .querySelector(`[data-testid="${testId}"]`)
        ?.getAttribute('data-open') === 'true',
    `folder-${dataPath}#${folder}`,
  )) as boolean;

const isUriOpen = async (dataPath: string) =>
  (await getDriver().executeScript(
    (testId: string) =>
      document
        .querySelector(`[data-testid="${testId}"]`)
        ?.hasAttribute('data-active') ?? false,
    `uriAccordion-${dataPath}`,
  )) as boolean;

/**
 * The folders showing an open icon over no subtree. A folder is either open
 * with its children on screen, or closed.
 */
const openFoldersWithoutSubtree = async () =>
  (await getDriver().executeScript(() =>
    Array.from(
      document.querySelectorAll('[data-testid^="folder-"][data-open="true"]'),
    )
      .filter(
        (folder) =>
          !folder.closest('li')?.querySelector(':scope > ul[role="group"] li'),
      )
      .map((folder) => folder.getAttribute('data-testid')),
  )) as string[];

/**
 * Toggles edit mode. Its button is only rendered while the grid is hovered,
 * and the hover is tracked with `mouseenter`, which does not bubble: it is
 * sent to the grid and everything in it.
 */
/**
 * The scroll areas of the tree panel reaching past its white card: the tree
 * must fill what the controls above it leave, and scroll inside it.
 */
const treeOverflowingPanel = async () =>
  (await getDriver().executeScript(() => {
    const panel = document
      .querySelector('[data-testid="visualization-left-panel"]')
      ?.querySelector('.mantine-Paper-root');
    if (!panel) return ['no panel'];
    const box = panel.getBoundingClientRect();
    // Only the outermost: the ones inside it are clipped by its viewport.
    return Array.from(panel.querySelectorAll('.mantine-ScrollArea-root'))
      .filter(
        (area) => !area.parentElement?.closest('.mantine-ScrollArea-root'),
      )
      .map((area) => area.getBoundingClientRect())
      .filter(
        (area) =>
          area.bottom > box.bottom + 0.5 ||
          area.right > box.right + 0.5 ||
          area.left < box.left - 0.5,
      )
      .map(
        (area) =>
          `${area.left},${area.bottom} beyond ${box.right},${box.bottom}`,
      );
  })) as string[];

async function toggleEditGrid(gridId: string) {
  await getDriver().executeScript((id: string) => {
    const grid = document.querySelector(`[data-testid="grid-${id}"]`);
    [grid, ...Array.from(grid?.querySelectorAll('*') ?? [])].forEach((el) =>
      el?.dispatchEvent(new MouseEvent('mouseenter')),
    );
  }, gridId);
  await findCssElementAndClickIt(`grid-edit-toggle-${gridId}`, 100, 100);
}

/** Flips a Mantine switch, whose test id lands on its hidden input. */
const toggleSwitch = async (testId: string) =>
  getDriver().executeScript((id: string) => {
    (document.querySelector(`[data-testid="${id}"]`) as HTMLElement)?.click();
  }, testId);

/** Ctrl+click: checks or unchecks a leaf in every data entry that has it. */
async function ctrlClick(testId: string) {
  const element = await ensureCssElementIsDisplayed(testId, 200, 100);
  await getDriver()
    .actions()
    .keyDown(Key.CONTROL)
    .click(element)
    .keyUp(Key.CONTROL)
    .perform();
}

const isLeafChecked = async (testId: string) =>
  (await getCssElementFromDataTestId(testId))
    .findElement({ css: 'input' })
    .isSelected();

async function checkLeaf(testId: string, traces: number) {
  await findCssElementAndClickIt(testId, 200, 100);
  await waitForValue(
    `Trace count after checking ${testId}`,
    async () => (await getTestState()).active.dataPlot[0]?.plot.length,
    traces,
  );
}

describe('UI Tests for the node tree', function () {
  this.timeout(240000);

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

  it('Should keep each data entry tree as the user left it', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Config');

    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openPath(scenario, [EQUILIBRIUM, TIME_SLICE, PROFILES_1D]);

    // Browsing another data entry used to reload this one's roots, leaving
    // open folders over nothing.
    await openUriAccordion(disruption);
    await openPath(disruption, [EQUILIBRIUM]);
    expect(await isUriOpen(scenario), 'scenario still open').to.be.true;

    // Closing and reopening the entry keeps what was expanded in it.
    await closeUriAccordion(scenario);
    await openUriAccordion(scenario);

    for (const folder of [EQUILIBRIUM, TIME_SLICE, PROFILES_1D]) {
      expect(await isFolderOpen(scenario, folder), folder).to.be.true;
    }
    await ensureCssElementIsDisplayed(`checkbox-${scenario}#${PROFILES_1D}psi`);
    expect(await isFolderOpen(disruption, EQUILIBRIUM)).to.be.true;
    expect(await openFoldersWithoutSubtree()).to.deep.equal([]);
    // Two expanded entries overflow the panel's height: they scroll inside it.
    expect(await treeOverflowingPanel()).to.deep.equal([]);

    // Only the user collapses a folder, with a single click.
    await findCssElementAndClickIt(
      `folder-${scenario}#${TIME_SLICE}`,
      200,
      100,
    );
    await waitForValue(
      'time_slice collapsed',
      () => isFolderOpen(scenario, TIME_SLICE),
      false,
    );
    expect(await isFolderOpen(scenario, EQUILIBRIUM)).to.be.true;
    expect(await openFoldersWithoutSubtree()).to.deep.equal([]);
  });

  it('Should reveal every signal of the plot being edited', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Edit');

    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openPath(scenario, [EQUILIBRIUM, TIME_SLICE, PROFILES_1D]);
    await checkLeaf(`checkbox-${scenario}#${PROFILES_1D}psi`, 1);
    await openUriAccordion(disruption);
    await openPath(disruption, [EQUILIBRIUM, TIME_SLICE, PROFILES_1D]);
    await checkLeaf(`checkbox-${disruption}#${PROFILES_1D}psi`, 2);

    // Leave edit mode, then fold everything away.
    const gridId = (await getTestState()).active.dataPlot[0].i;
    await toggleEditGrid(gridId);
    await waitForValue(
      'Edit mode left',
      async () => (await getTestState()).editingGridId,
      null,
    );
    for (const dataPath of [scenario, disruption]) {
      await findCssElementAndClickIt(
        `folder-${dataPath}#${EQUILIBRIUM}`,
        200,
        100,
      );
      await waitForValue(
        `${dataPath} folded`,
        () => isFolderOpen(dataPath, EQUILIBRIUM),
        false,
      );
      await closeUriAccordion(dataPath);
    }

    // Editing the grid again shows both signals, each in its data entry.
    await toggleEditGrid(gridId);
    await waitForValue(
      'Edit mode entered',
      async () => (await getTestState()).editingGridId,
      gridId,
    );
    for (const dataPath of [scenario, disruption]) {
      await waitForValue(
        `${dataPath} reopened`,
        () => isUriOpen(dataPath),
        true,
      );
      await waitForValue(
        `${dataPath} profiles_1d revealed`,
        () => isFolderOpen(dataPath, PROFILES_1D),
        true,
      );
      const checkbox = await getCssElementFromDataTestId(
        `checkbox-${dataPath}#${PROFILES_1D}psi`,
      );
      expect(
        await checkbox.findElement({ css: 'input' }).isSelected(),
        `${dataPath} psi checked`,
      ).to.be.true;
    }
    expect(await openFoldersWithoutSubtree()).to.deep.equal([]);
  });

  it('Should search all data entries and keep the browsed trees', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Search');

    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openPath(scenario, [EQUILIBRIUM]);

    await toggleSwitch('search-all-uris');
    // A regular expression, as the backend matches with `re.search`: only
    // the one leaf, filled in both datasets.
    await writeTextInCssElement('search-node-input', 'profiles_1d/psi$');
    await findCssElementAndClickIt('search-node-submit');

    // Results from both entries, both opened, all expanded.
    const leaf = `${PROFILES_1D}psi`;
    await ensureCssElementIsDisplayed(`checkbox-${scenario}#${leaf}`, 600, 100);
    await ensureCssElementIsDisplayed(
      `checkbox-${disruption}#${leaf}`,
      600,
      100,
    );
    await checkLeaf(`checkbox-${scenario}#${leaf}`, 1);
    await checkLeaf(`checkbox-${disruption}#${leaf}`, 2);

    // Clearing the search brings the browsed trees back as they were, with the
    // nodes checked among the results revealed in them.
    await writeTextInCssElement('search-node-input', '', true);
    for (const dataPath of [scenario, disruption]) {
      await waitForValue(
        `${dataPath} profiles_1d revealed`,
        () => isFolderOpen(dataPath, PROFILES_1D),
        true,
      );
      await ensureCssElementIsDisplayed(`checkbox-${dataPath}#${leaf}`);
      // Browsed, not searched: the siblings the search filtered out are back.
      await ensureCssElementIsDisplayed(`checkbox-${dataPath}#${PROFILES_1D}q`);
    }
    expect(await openFoldersWithoutSubtree()).to.deep.equal([]);
  });

  it('Should show where a single data entry search runs, and run it in the entries opened', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Search One');
    const leaf = `${PROFILES_1D}psi`;
    /** The data entries whose header is marked as the one searched. */
    const searchedUris = async () =>
      (await getDriver().executeScript(() =>
        Array.from(
          document.querySelectorAll('[data-testid="searched-uri"]'),
          (icon) =>
            icon
              .closest('[data-testid^="uriAccordion-"]')
              ?.getAttribute('data-testid'),
        ),
      )) as string[];

    // The switch is the tree's, which an earlier spec may have left on.
    const allUrisOn = await getDriver().executeScript(
      () =>
        (
          document.querySelector(
            '[data-testid="search-all-uris"]',
          ) as HTMLInputElement | null
        )?.checked,
    );
    if (allUrisOn) await toggleSwitch('search-all-uris');

    // The entry opened last is the one searched, and is marked so.
    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openUriAccordion(disruption);
    expect(await searchedUris()).to.deep.equal([`uriAccordion-${disruption}`]);

    await writeTextInCssElement('search-node-input', 'profiles_1d/psi$');
    await findCssElementAndClickIt('search-node-submit');
    await ensureCssElementIsDisplayed(
      `checkbox-${disruption}#${leaf}`,
      600,
      100,
    );
    // Not "No match": the search did not run there.
    await ensureCssElementIsDisplayed(`notSearched-${scenario}`);

    // One click runs it there too, which becomes the entry searched.
    await findCssElementAndClickIt(`searchEntry-${scenario}`);
    await ensureCssElementIsDisplayed(`checkbox-${scenario}#${leaf}`, 600, 100);
    await ensureCssElementIsDisplayed(`checkbox-${disruption}#${leaf}`);
    expect(await searchedUris()).to.deep.equal([`uriAccordion-${scenario}`]);

    // Opening an entry while searching runs the search in it.
    await closeUriAccordion(disruption);
    await openUriAccordion(disruption);
    await ensureCssElementIsDisplayed(
      `checkbox-${disruption}#${leaf}`,
      600,
      100,
    );
    expect(await searchedUris()).to.deep.equal([`uriAccordion-${disruption}`]);

    // Searching all of them, none is marked.
    await toggleSwitch('search-all-uris');
    expect(await searchedUris()).to.deep.equal([]);
    await toggleSwitch('search-all-uris');
    await writeTextInCssElement('search-node-input', '', true);
  });

  it('Should check a node in every data entry with one Ctrl+click', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Check All');

    // Only the scenario is browsed: the disruption's folders load on the way.
    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openPath(scenario, [EQUILIBRIUM, TIME_SLICE, PROFILES_1D]);
    const leaf = `${PROFILES_1D}psi`;
    await ctrlClick(`checkbox-${scenario}#${leaf}`);

    await waitForValue(
      'One grid with psi from both entries',
      async () => {
        const { dataPlot } = (await getTestState()).active;
        return dataPlot.length === 1
          ? dataPlot[0].plot.map(
              (p: { nodeUri: string }) => p.nodeUri.split('#')[0],
            )
          : dataPlot.length;
      },
      [scenario, disruption],
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    );
    await waitForValue(
      'disruption profiles_1d revealed',
      () => isFolderOpen(disruption, PROFILES_1D),
      true,
    );
    expect(await isUriOpen(disruption)).to.be.true;
    for (const dataPath of [scenario, disruption]) {
      expect(await isLeafChecked(`checkbox-${dataPath}#${leaf}`), dataPath).to
        .be.true;
    }
    expect(await openFoldersWithoutSubtree()).to.deep.equal([]);

    // Ctrl+click on a checked node unchecks it everywhere: the grid had
    // nothing else, so it goes with it.
    await ctrlClick(`checkbox-${disruption}#${leaf}`);
    await waitForValue(
      'psi unchecked in both entries',
      async () => (await getTestState()).active.dataPlot.length,
      0,
    );
    for (const dataPath of [scenario, disruption]) {
      expect(await isLeafChecked(`checkbox-${dataPath}#${leaf}`), dataPath).to
        .be.false;
    }
  });

  it('Should leave the other traces as they are when a compared node goes', async () => {
    const [scenario, disruption] = await setupConfiguration('Tree Compare');
    const QUANTITIES = 'summary:0/global_quantities/';
    const IP = `${QUANTITIES}ip/value`;
    const BETA_POL = `${QUANTITIES}beta_pol/value`;

    await ensureCssElementIsDisplayed(`uriAccordion-${scenario}`, 600, 100);
    await openUriAccordion(scenario);
    await openPath(scenario, ['summary:0/', QUANTITIES, `${QUANTITIES}ip/`]);
    await ctrlClick(`checkbox-${scenario}#${IP}`);
    await waitForValue(
      'ip from both entries',
      async () => (await getTestState()).active.dataPlot[0]?.plot.length,
      2,
    );

    // What is drawn of each ip: one time base for the grid, the union of the
    // two entries' (1 and 3 times).
    type Trace = { nodeUri: string; x: number[]; y: number[] };
    const drawnIp = async () =>
      JSON.stringify(
        ((await getTestState()).active.dataPlot[0].plot as Trace[])
          .filter((trace) => trace.nodeUri.endsWith('ip/value'))
          .map((trace) => [trace.nodeUri, trace.x, trace.y]),
      );
    const ipAlone = await drawnIp();
    expect(JSON.parse(ipAlone)[0][1]).to.have.length(4);

    // beta_pol has the same time bases: ip does not move when it joins...
    await openTreeFolder(`folder-${scenario}#${QUANTITIES}beta_pol/`);
    await ctrlClick(`checkbox-${scenario}#${BETA_POL}`);
    await waitForValue(
      'beta_pol from both entries',
      async () => (await getTestState()).active.dataPlot[0]?.plot.length,
      4,
    );
    expect(await drawnIp()).to.equal(ipAlone);

    // ...nor when it leaves. Each removal used to put the grid on the times of
    // the beta_pol left, and ip was drawn against them.
    await ctrlClick(`checkbox-${scenario}#${BETA_POL}`);
    await waitForValue(
      'beta_pol removed from both entries',
      async () => (await getTestState()).active.dataPlot[0]?.plot.length,
      2,
    );
    expect(await drawnIp()).to.equal(ipAlone);
    for (const dataPath of [scenario, disruption]) {
      expect(await isLeafChecked(`checkbox-${dataPath}#${IP}`), dataPath).to.be
        .true;
    }
  });
});
