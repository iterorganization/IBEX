import { By } from 'selenium-webdriver';
import { getDriver, getTestState, setTestState } from '../setup';
// Declares `window.api`, used to resolve the dataset path from inside the app
import '../../config/bridge';
import {
  clickAndAwaitEnabled,
  ensureCssElementIsDisplayed,
  findCssElementAndClickIt,
  waitForElementToDisappear,
  waitForValue,
  writeTextInCssElement,
} from './testToolBox';

/**
 * Only this dataset can be used for smoothing: the back-end requires a `time`
 * coordinate whose target is the leaf node itself, and it must hold more than
 * one sample. `iter_scenario_53298_seq1_DD3.nc` has a single time step, and its
 * `profiles_1d[:]` nodes carry a time coordinate targeting the array of
 * structures rather than the leaf.
 */
export const DISRUPTION_FILE = 'iter_disruption_113112_1.nc';

/** IDS folders to unfold before reaching the `global_quantities` leaves. */
export const DISRUPTION_FOLDERS = [
  'disruption:0/',
  'disruption:0/global_quantities/',
];

/** Leaves used by the tests, all 1D over time and therefore smoothable. */
export const POWER_OHM = 'disruption:0/global_quantities/power_ohm';
export const POWER_OHM_HALO = 'disruption:0/global_quantities/power_ohm_halo';
export const CURRENT_HALO_POL =
  'disruption:0/global_quantities/current_halo_pol';

export interface GridSetup {
  configName: string;
  fileName?: string;
  folders: string[];
  leaves: string[];
}

export interface GridHandle {
  /** Absolute path of the dataset, as resolved inside the app. */
  dataPath: string;
  /** `${dataPath}#${leaf}`, in the order the leaves were checked. */
  nodeUris: string[];
  /** Plot names read from the store, never hard-coded. */
  plotNames: string[];
  /** Raw y values captured before any manipulation, one entry per plot. */
  rawY: number[][];
}

/**
 * Brings the app back to an empty, modal-free state.
 *
 * The Electron instance is shared by every spec and survives between runs, so a
 * test cannot assume it starts from a blank slate. A modal left open by a
 * failing test would also intercept every following click.
 */
export async function resetAppState() {
  const closeButtons = await getDriver().findElements(
    By.css('button.mantine-Modal-close'),
  );
  for (const button of closeButtons) {
    try {
      await button.click();
    } catch {
      // The modal closed on its own in the meantime
    }
  }

  await setTestState({ configurations: [], active: null });

  for (let attempt = 0; attempt < 20; attempt++) {
    const overlays = await getDriver().findElements(
      By.css('.mantine-Modal-overlay'),
    );
    if (overlays.length === 0) return;
    await new Promise((res) => setTimeout(res, 250));
  }
}

/**
 * Resolves the absolute path of a bundled Zenodo dataset from inside the app.
 */
export async function getDatasetPath(fileName: string): Promise<string> {
  return await getDriver().executeScript(async (name: string) => {
    return (await window.api.fs.getZenodoDataPath()) + '/' + name;
  }, fileName);
}

/**
 * Runs the whole "configuration -> URI -> tree -> plots" flow and captures the
 * raw data, which every later assertion is expressed against.
 *
 * All leaves land in a single grid: the grid created by the first leaf stays in
 * editing mode, and `getNodesChecked` routes any further node to it.
 */
export async function setupGrid(setup: GridSetup): Promise<GridHandle> {
  const { configName, folders, leaves } = setup;
  const fileName = setup.fileName ?? DISRUPTION_FILE;

  // Create the configuration
  await findCssElementAndClickIt('header-add-configuration');
  const configCreateModal = await ensureCssElementIsDisplayed(
    'config-create-modal',
  );
  await writeTextInCssElement('config-create-name-input', configName, true);
  await findCssElementAndClickIt('config-create-submit-button');
  await waitForElementToDisappear(configCreateModal);
  await waitForValue(
    'Configuration created',
    async () => (await getTestState()).configurations.length,
    1,
  );

  // Register the dataset URI
  const dataPath = await getDatasetPath(fileName);
  const uriModal = await ensureCssElementIsDisplayed(
    'config-uri-selection-modal',
  );
  await writeTextInCssElement(
    'config-uri-selection-modal-uri-text-input',
    dataPath,
    true,
  );
  // The button disables itself while the back-end verifies the URI
  await clickAndAwaitEnabled('config-uri-selection-modal-add-uri-button');
  await findCssElementAndClickIt(
    'config-uri-selection-modal-validate-button',
    100,
    300,
  );
  await waitForElementToDisappear(uriModal, 30000);

  // Unfold the tree down to the leaves
  await ensureCssElementIsDisplayed(`uriAccordion-${dataPath}`, 200, 100);
  await findCssElementAndClickIt(`uriAccordion-${dataPath}`, 200, 100);
  for (const folder of folders) {
    await findCssElementAndClickIt(`folder-${dataPath}#${folder}`, 200, 100);
  }

  // Check the leaves one by one, waiting for each plot to be added
  for (const [index, leaf] of leaves.entries()) {
    await findCssElementAndClickIt(`checkbox-${dataPath}#${leaf}`, 200, 100);
    await waitForValue(
      `Plot count after checking ${leaf}`,
      async () => (await getTestState()).active.dataPlot[0]?.plot.length,
      index + 1,
      (actual, expected) => actual === expected,
      100,
      300,
    );
  }

  const dataGrid = (await getTestState()).active.dataPlot[0];

  return {
    dataPath,
    nodeUris: leaves.map((leaf) => `${dataPath}#${leaf}`),
    plotNames: dataGrid.plot.map((plot) => plot.name),
    rawY: dataGrid.plot.map((plot) => plot.y as number[]),
  };
}

/**
 * Opens the "Data manipulation" panel and unfolds the requested accordion.
 *
 * No hover is needed: `generateNewGrid` marks tree-created grids as editing, so
 * the action buttons stay mounted.
 */
export async function openDataCustomization(
  panel: 'Data smoothing' | 'Data operations',
) {
  const accordionTestId = `customization-${panel}-accordion`;
  const accordionSelector = By.css(`[data-testid="${accordionTestId}"]`);

  const isPanelOpen = async () =>
    Boolean((await getTestState()).active?.customizedGridLayout);

  /** Closes the panel through the store, to mount it again from scratch. */
  const closePanel = async () => {
    const state = await getTestState();
    if (state.active) {
      await setTestState({
        configurations: state.configurations,
        active: { ...state.active, customizedGridLayout: null },
      });
    }
    await new Promise((res) => setTimeout(res, 500));
  };

  /** Clicks the access button until the store reports the panel as open. */
  const clickUntilOpen = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await isPanelOpen()) return true;
      // A click landing on a node React is about to replace, as happens while
      // the grid re-renders after a save, is simply lost
      await findCssElementAndClickIt(
        'data-customization-access-button',
        200,
        100,
      );
      for (let poll = 0; poll < 20; poll++) {
        await new Promise((res) => setTimeout(res, 150));
        if (await isPanelOpen()) return true;
      }
    }
    return false;
  };

  /**
   * Waits for the accordion to be both rendered and expanded.
   *
   * The control is a toggle and the accordion remembers its opened section, so
   * it is clicked only while collapsed. Every step re-locates the node: the
   * preview plot underneath re-renders and detaches it without warning.
   */
  const expandAccordion = async (timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const [control] = await getDriver().findElements(accordionSelector);
        if (control && (await control.isDisplayed())) {
          if ((await control.getAttribute('aria-expanded')) === 'true') {
            return true;
          }
          await control.click();
        }
      } catch {
        // Detached mid-interaction: retry with a fresh lookup
      }
      await new Promise((res) => setTimeout(res, 300));
    }
    return false;
  };

  // The page occasionally mounts before the grid it must display is resolved,
  // and then renders its tab bar without any accordion: remount it in that case
  for (let round = 0; round < 3; round++) {
    if (!(await clickUntilOpen())) {
      throw new Error('The data manipulation panel never opened');
    }
    if (await expandAccordion(20000)) return;
    await closePanel();
  }

  throw new Error(`Accordion "${panel}" never expanded`);
}

/**
 * Selects the plot the smoothing and operation panels apply to.
 */
export async function selectCustomizationTab(plotName: string) {
  await findCssElementAndClickIt(`customization-tab-${plotName}`, 200, 100);
}

/**
 * Saves the customization and waits until the store reflects it.
 *
 * The panel edits a local React state, so nothing reaches `getTestState()`
 * before this runs.
 */
export async function saveCustomization() {
  await findCssElementAndClickIt('customization-save-button', 200, 100);
  await waitForValue(
    'Customization panel closed',
    async () => (await getTestState()).active.customizedGridLayout,
    null,
    (actual, expected) => actual == expected,
    100,
    100,
  );
  // Wait for the grid view to be mounted back, so that a following interaction
  // is not swallowed by the re-render
  await ensureCssElementIsDisplayed(
    'data-customization-access-button',
    200,
    100,
  );
}

/**
 * Reads the traces currently rendered by Plotly.
 *
 * This is the only way to observe the panel before saving, since the edited
 * grid lives in component state until then.
 */
export async function readPlotlyTraces(): Promise<
  { name: string; y: number[]; yaxis?: string }[]
> {
  return await getDriver().executeScript(() => {
    const graphDiv = document.querySelector('.js-plotly-plot') as unknown as {
      data?: { name: string; y: number[]; yaxis?: string }[];
    };
    return (graphDiv?.data ?? []).map((trace) => ({
      name: trace.name,
      y: Array.from(trace.y ?? []),
      yaxis: trace.yaxis,
    }));
  });
}

/**
 * Reads the axis titles as rendered in the Plotly SVG, e.g. `power_ohm [W*W]`.
 */
export async function readAxisTitles(): Promise<{
  x: string;
  y: string;
  y2: string;
}> {
  return await getDriver().executeScript(() => {
    const titleOf = (selector: string) =>
      document.querySelector(selector)?.textContent?.trim() ?? '';
    return {
      x: titleOf('text.xtitle'),
      y: titleOf('text.ytitle'),
      y2: titleOf('text.y2title'),
    };
  });
}
