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
 *
 * An occurrence only means something for its own IDS: `summary:1` and
 * `core_profiles:0` may well be the only occurrences of their IDS in an entry.
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

/** The key a source is told apart by. */
const sourceKey = ({ entry, ids, occurrence }: NodeSource) =>
  `${entry}#${ids}:${occurrence}`;

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
  const others = [...sourcesOf(plots)]
    .filter(([key]) => key !== ownKey)
    .map(([, other]) => other);
  // The back-end interpolates over the trace's own IDS only, so another IDS
  // gives no occurrence to take: none in the trace's own entry, whose IDSs
  // share their coordinates, and the trace's own one in an entry where its IDS
  // is not drawn.
  const entriesWithOwnIds = new Set(
    others.filter((other) => other.ids === own.ids).map((other) => other.entry),
  );
  return [
    ...new Set(
      others.flatMap((other) => {
        let occurrence = other.occurrence;
        if (other.ids !== own.ids) {
          if (other.entry === own.entry || entriesWithOwnIds.has(other.entry)) {
            return [];
          }
          occurrence = own.occurrence;
        }
        return [`${other.entry}#${own.ids}:${occurrence}${node}`];
      }),
    ),
  ];
};

/**
 * Whether adding or removing a trace changes the coordinates the grid shares:
 * only when its source joins or leaves the grid.
 * @param plots the grid's other traces
 * @param uri the trace added or removed
 */
export const commonCoordinatesChange = (plots: DataPlotly[], uri: string) =>
  !sourcesOf(plots).has(sourceKey(sourceOf(uri)));

/**
 * The label of each trace's tab, keyed by `nodeUri` (unique in a grid). A
 * trace keeps its `name` unless another trace of the grid shares it - two
 * `measured` nodes of the same entry are both `measured_URI-0` - then it gets
 * the shortest end of its node path that tells them apart:
 * `diamagnetic_flux/measured_URI-0` and `ip/measured_URI-0`. One node of an
 * entry in several IDS occurrences only its IDS and occurrence tell apart:
 * `ip_URI-0#summary:0` and `ip_URI-0#summary:1`.
 */
export const plotTabLabels = (plots: DataPlotly[]): Map<string, string> => {
  const labels = new Map<string, string>();
  const byName = new Map<string, DataPlotly[]>();
  plots.forEach((plot) =>
    byName.set(plot.name, [...(byName.get(plot.name) ?? []), plot]),
  );

  byName.forEach((group) => {
    if (group.length === 1) {
      labels.set(group[0].nodeUri, group[0].name);
      return;
    }
    // The node path below `#ids:occurrence`, one entry per segment.
    const segments = group.map((plot) => {
      const fragment = plot.nodeUri.split('#')[1] ?? plot.nodeUri;
      return fragment.split('/').slice(1);
    });
    const paths = new Set(segments.map((path) => path.join('/'))).size;
    const longest = Math.max(...segments.map((path) => path.length));
    const suffixesOf = (depth: number) =>
      segments.map((path) => path.slice(-depth).join('/'));
    let depth = 1;
    while (depth < longest && new Set(suffixesOf(depth)).size !== paths) {
      depth++;
    }
    // With a single path, the shared name says it better than its last segment.
    const pathLabels =
      paths === 1
        ? group.map((plot) => plot.name)
        : suffixesOf(depth).map(
            (suffix, index) => `${suffix}_${group[index].labelUri}`,
          );
    const qualified = pathLabels.map((label, index) => {
      if (pathLabels.indexOf(label) === pathLabels.lastIndexOf(label)) {
        return label;
      }
      const { ids, occurrence } = sourceOf(group[index].nodeUri);
      return `${label}#${ids}:${occurrence}`;
    });
    const distinct = new Set(qualified).size === group.length;
    group.forEach((plot, index) =>
      labels.set(plot.nodeUri, distinct ? qualified[index] : plot.nodeUri),
    );
  });
  return labels;
};
