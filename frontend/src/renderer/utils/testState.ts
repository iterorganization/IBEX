import {
  Configuration,
  Coordinates,
  DataGridPlot,
  DataPlotly,
  ErrorBandData,
  Geometry,
  TestState,
} from '../types';
import {
  axisVector,
  bandVectors,
  customdataOf,
  lineVector,
} from '../derive/vectors';

/**
 * The projection the E2E state bridge sends, and its inverse.
 *
 * `getTestState` (`src/main/ipc.ts`) hands the store to Electron's structured
 * clone and then to the WebDriver JSON bridge. The store owns the fetched
 * payloads, so on a real data entry every poll serialises the whole matrix -
 * which times the WebDriver script out rather than the app (see
 * `src/tests/perf/BASELINE.md`).
 *
 * Four families are dropped on the way out:
 *
 *   dataPlot[].plot[].yData
 *   dataPlot[].plot[].error_bands[].yData
 *   dataPlot[].coordinates[].data
 *   dataPlot[].geometries[].x / .y
 *
 * Everything else passes through, and the derived vectors `plot.x`, `plot.y`,
 * `plot.customdata` and `error_bands[].array` are *computed* on the way out.
 * The store stopped holding them once derivation moved to the render path (see
 * `derive/vectors.ts`), but the specs assert exact floats on them, so the
 * projection derives them through the same functions the renderer draws from -
 * which is also what keeps those specs honest about what is drawn. They are a
 * single row each, so they stay small whatever the entry's size.
 *
 * This is deliberately a *denylist*. A spec reading a field nobody thought to
 * enumerate keeps working; only the four families above can go missing.
 *
 * ## Why the inverse is not optional
 *
 * Three specs read the whole state and write it straight back to flip one field
 * (`src/tests/utils/dataManipulation.ts`, `src/tests/perf/reactivity.perf.spec.ts`),
 * and `setState` replaces `configurations`/`active` wholesale. Without
 * `mergeTestState` re-attaching the payloads, the first such round trip would
 * empty every plot in the store and later specs would fail somewhere else
 * entirely. The two functions must always ship together.
 */

/** Set on a projected grid so the inverse knows its payloads were stripped. */
type ProjectedGrid = DataGridPlot & { __payloadsOmitted?: true };

const projectTrace = (
  plot: DataPlotly,
  coordinates: Coordinates[],
  x: (string | number)[] | undefined,
): DataPlotly => {
  const { yData, error_bands, ...rest } = plot;
  const projected = rest as DataPlotly;
  projected.x = x;
  projected.y = lineVector(yData, coordinates) as DataPlotly['y'];
  if (!error_bands) return projected;

  const bands = bandVectors(plot, coordinates);
  return {
    ...projected,
    customdata: customdataOf(bands),
    error_bands: error_bands.map((band, index) => {
      const { yData: bandData, ...bandRest } = band;
      void bandData;
      return { ...bandRest, array: bands[index] } as ErrorBandData;
    }),
  } as DataPlotly;
};

const projectGrid = (grid: DataGridPlot): ProjectedGrid => ({
  ...grid,
  __payloadsOmitted: true,
  plot: grid.plot?.map((plot) =>
    projectTrace(plot, grid.coordinates ?? [], axisVector(grid.coordinates, 0)),
  ),
  coordinates: grid.coordinates?.map((coordinate) => {
    const { data, ...rest } = coordinate;
    void data;
    return rest as Coordinates;
  }),
  geometries: grid.geometries?.map((geometry) => {
    const { x, y, ...rest } = geometry;
    void x;
    void y;
    return rest as Geometry;
  }),
});

const projectConfiguration = (configuration: Configuration): Configuration => ({
  ...configuration,
  dataPlot: configuration.dataPlot?.map(projectGrid),
});

/** Strips every bulk payload from a state snapshot. */
export const projectTestState = (state: TestState): TestState => ({
  configurations: state.configurations?.map(projectConfiguration) ?? [],
  active: state.active ? projectConfiguration(state.active) : state.active,
  editingGridId: state.editingGridId ?? null,
  metadataGridId: state.metadataGridId ?? null,
  customizing: state.customizing ?? null,
});

/**
 * Finds the trace a projected one came from: same position if the node matches,
 * otherwise the node wherever it moved to, otherwise the same position anyway.
 */
const sourceTrace = (
  sources: DataPlotly[] | undefined,
  plot: DataPlotly,
  index: number,
): DataPlotly | undefined => {
  if (!sources?.length) return undefined;
  if (sources[index]?.nodeUri === plot.nodeUri) return sources[index];
  return (
    sources.find((source) => source.nodeUri === plot.nodeUri) ?? sources[index]
  );
};

const rehydrateTrace = (
  plot: DataPlotly,
  source: DataPlotly | undefined,
): DataPlotly => {
  if (!source) return plot;

  // The derived vectors go back out: they are computed on the way in, and
  // writing them back would put into the store exactly what this stage took out
  // of it - where they would then go stale the moment a cursor moved.
  const { x, y, customdata, ...stored } = plot;
  void x;
  void y;
  void customdata;
  const rehydrated: DataPlotly = { ...stored, yData: source.yData };
  if (!plot.error_bands) return rehydrated;

  rehydrated.error_bands = plot.error_bands.map((band) => ({
    ...band,
    array: undefined,
    yData:
      source.error_bands?.find((candidate) => candidate.path === band.path)
        ?.yData ??
      band.yData ??
      [],
  }));
  return rehydrated;
};

const rehydrateGrid = (
  grid: ProjectedGrid,
  source: DataGridPlot | undefined,
): DataGridPlot => {
  const { __payloadsOmitted, ...rest } = grid;
  if (!__payloadsOmitted || !source) return rest;

  return {
    ...rest,
    plot: rest.plot?.map((plot, index) =>
      rehydrateTrace(plot, sourceTrace(source.plot, plot, index)),
    ),
    coordinates: rest.coordinates?.map((coordinate) => ({
      ...coordinate,
      data:
        source.coordinates?.find(
          (candidate) => candidate.name === coordinate.name,
        )?.data ??
        coordinate.data ??
        [],
    })),
    geometries: rest.geometries?.map((geometry, index) => {
      const candidate =
        source.geometries?.find(
          (item) => item.geometry_node === geometry.geometry_node,
        ) ?? source.geometries?.[index];
      return candidate
        ? { ...geometry, x: candidate.x, y: candidate.y }
        : geometry;
    }),
  };
};

const rehydrateConfiguration = (
  configuration: Configuration,
  current: TestState,
): Configuration => {
  const source =
    current.configurations?.find(
      (candidate) => candidate.name === configuration.name,
    ) ??
    (current.active?.name === configuration.name ? current.active : undefined);

  if (!source) return configuration;

  return {
    ...configuration,
    dataPlot: configuration.dataPlot?.map((grid) =>
      rehydrateGrid(
        grid as ProjectedGrid,
        source.dataPlot?.find((candidate) => candidate.i === grid.i),
      ),
    ),
  };
};

/**
 * Re-attaches the payloads a projected snapshot lost, from what the store still
 * holds. A configuration or grid the store does not know - the fixtures in
 * `src/tests/utils/state.ts`, whose `dataPlot` is empty - is taken as given.
 */
export const mergeTestState = (
  incoming: Partial<TestState>,
  current: TestState,
): Partial<TestState> => {
  const merged: Partial<TestState> = { ...incoming };

  if (incoming.configurations) {
    merged.configurations = incoming.configurations.map((configuration) =>
      rehydrateConfiguration(configuration, current),
    );
  }

  if ('active' in incoming) {
    merged.active = incoming.active
      ? rehydrateConfiguration(incoming.active, current)
      : incoming.active;
  }

  // `active` and its entry in `configurations` must stay the same object, which
  // is the invariant `updatedConfiguration` maintains. A spec that edits only
  // `active` would otherwise leave the two disagreeing - and the stale entry is
  // not inert: writers that start from `configurations` put it back over
  // `active`, silently undoing what the spec wrote.
  const configurations = merged.configurations ?? current.configurations;
  if (configurations && merged.active) {
    const active = merged.active;
    merged.configurations = configurations.map((configuration) =>
      configuration.name === active.name ? active : configuration,
    );
  }

  return merged;
};
