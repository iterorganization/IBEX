// Relative, not the `src/*` alias: this module is covered by `npm run test:unit`,
// and ts-node does not resolve that alias without `tsconfig-paths/register`.
import type { Configuration, DataGridPlot, URITreeNodeData } from '../types';

/** What decides whether a trace's bands changed: which nodes, which payloads. */
const bandsSignature = (grid: DataGridPlot): string =>
  (grid.plot ?? [])
    .map((plot) =>
      plot.error_bands === undefined
        ? '-'
        : plot.error_bands
            .map((band) => `${band.path}@${band.yDataRef ?? ''}`)
            .join(','),
    )
    .join('|');

const sameNode = (a: URITreeNodeData, b: URITreeNodeData) =>
  a.name === b.name && a.uri === b.uri;

/**
 * Carries the error bands an asynchronous fetch produced over to the store as
 * it is *now*, rather than writing back the copy the fetch started from.
 *
 * Fetching bands awaits the backend, and anything written meanwhile - a slider
 * moved, a panel linked, another grid edited - is newer than that copy. Writing
 * the copy back undid all of it. So only what the fetch is about moves across:
 * each trace's `error_bands`, for the grids whose bands changed, and the band
 * nodes it checked or unchecked in the tree. Everything else comes from
 * `latest`.
 *
 * @param latest The active configuration when the fetch finished.
 * @param start The active configuration the fetch started from.
 * @param working `start`'s structural copy, which the fetch wrote into.
 * @returns The configuration to write, or `null` when there is nothing to
 *   write - `latest` is another configuration, or the fetch changed nothing.
 */
export const mergeErrorBands = (
  latest: Configuration | null,
  start: Configuration,
  working: Configuration,
): Configuration | null => {
  if (!latest || latest.name !== start.name) return null;

  const before = new Map(start.dataPlot.map((grid) => [grid.i, grid]));
  const changed = new Map<string, DataGridPlot>();
  for (const grid of working.dataPlot) {
    const original = before.get(grid.i);
    if (original && bandsSignature(original) !== bandsSignature(grid)) {
      changed.set(grid.i, grid);
    }
  }

  const added = working.checkedNodeURI.filter(
    (node) => !start.checkedNodeURI.some((other) => sameNode(node, other)),
  );
  const removed = start.checkedNodeURI.filter(
    (node) => !working.checkedNodeURI.some((other) => sameNode(node, other)),
  );

  if (!changed.size && !added.length && !removed.length) return null;

  const checkedNodeURI = [
    ...latest.checkedNodeURI.filter(
      (node) => !removed.some((other) => sameNode(node, other)),
    ),
    ...added.filter(
      (node) => !latest.checkedNodeURI.some((other) => sameNode(node, other)),
    ),
  ];

  return {
    ...latest,
    checkedNodeURI,
    dataPlot: latest.dataPlot.map((grid) => {
      const source = changed.get(grid.i);
      // A trace added or removed meanwhile leaves no way to pair the bands up;
      // that grid's own effects fetch its bands again.
      if (!source || source.plot.length !== grid.plot.length) return grid;
      return {
        ...grid,
        plot: grid.plot.map((plot, index) => {
          const bands = source.plot[index].error_bands;
          const next = { ...plot, error_bands: bands };
          // Removed bands leave no key behind, as `delete` did before.
          if (bands === undefined) delete next.error_bands;
          return next;
        }),
      };
    }),
  };
};
