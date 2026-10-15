import type { DataPlotly } from '../types';
import { normalizeIndices } from './uri';

/**
 * Where a trace's data comes from: a data entry and an IDS occurrence. A grid
 * draws its traces against the union of the coordinates of its sources.
 *
 * Two occurrences of one IDS in one data entry are two sources: their time
 * vectors are independent. Keyed on the data entry alone, a grid holding
 * `summary:0` and `summary:1` of the same entry interpolated neither over the
 * other and drew both against the coordinates of only one of them.
 */
interface NodeSource {
  entry: string;
  ids: string;
  /** Occurrence 0 when the URI leaves it out, as the back-end reads it. */
  occurrence: number;
  /** The node path below `#<ids>:<occurrence>/`. */
  path: string;
}

/** Parses a node URI, `<entry>#<ids>[:<occurrence>][/<path>]`. */
export const sourceOf = (uri: string): NodeSource => {
  const [entry, fragment = ''] = normalizeIndices(uri).split('#');
  const match = /^([^:/]*)(?::(\d*))?(?:\/(.*))?$/.exec(fragment);
  return {
    entry,
    ids: match?.[1] ?? '',
    occurrence: Number(match?.[2] || 0),
    path: match?.[3] ?? '',
  };
};

/**
 * The key a source is told apart by. Without the IDS name: traces of several
 * IDSs from one occurrence of an entry share its coordinates, as they did when
 * sources were data entries.
 */
const sourceKey = ({ entry, occurrence }: NodeSource) =>
  `${entry}#${occurrence}`;

/** The sources a grid's traces come from, by key. */
const sourcesOf = (plots: DataPlotly[]) => {
  const sources = new Map<string, NodeSource>();
  for (const plot of plots) {
    const source = sourceOf(plot.nodeUri);
    sources.set(sourceKey(source), source);
  }
  return sources;
};

/**
 * The URIs to interpolate a trace over, for the `interpolate_over` parameter of
 * `fetchDataPlot`: its own node in every other source of the grid.
 *
 * The back-end puts a trace on the union of its coordinates and those of the
 * nodes it is interpolated over, which must have its path. Over the nodes of
 * the grid sharing its path only, traces of two paths from the same entries -
 * ip and tau_energy, say - ended up on two different unions while the grid
 * draws them all against one.
 * @param uriToAdd the trace's node URI
 * @param plots the grid's traces; the trace itself may be among them
 */
export const getUrisToInterpolate = (uriToAdd: string, plots: DataPlotly[]) => {
  const own = sourceOf(uriToAdd);
  const ownKey = sourceKey(own);
  const node = own.path ? `/${own.path}` : '';
  return [...sourcesOf(plots)]
    .filter(([key]) => key !== ownKey)
    .map(([, other]) => `${other.entry}#${own.ids}:${other.occurrence}${node}`);
};

/**
 * Whether adding or removing a trace changes the coordinates the grid shares:
 * only when its source joins or leaves the grid.
 * @param plots the grid's other traces
 * @param uri the trace added or removed
 */
export const commonCoordinatesChange = (plots: DataPlotly[], uri: string) =>
  !sourcesOf(plots).has(sourceKey(sourceOf(uri)));
