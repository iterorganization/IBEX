// Relative, not the `src/*` alias: this module is covered by `npm run test:unit`,
// and ts-node does not resolve that alias without `tsconfig-paths/register`.
import { DataGridPlot } from '../types';

/**
 * Copies a grid's *structure*, sharing its payload arrays by reference.
 *
 * Every object a transform reassigns fields on is copied - the grid, each
 * coordinate, each trace, each error band, each geometry, the axis descriptors -
 * so the original grid in the store is never written through. The bulk arrays
 * hanging off them (`coordinates[].data`, `plot[].yData`,
 * `error_bands[].yData`, `geometries[].x`/`.y`) are not copied: they are
 * payloads, they are replaced rather than mutated, and on a 2-D node they are
 * the entire cost of `structuredClone`.
 *
 * This is the contract the payload registry assumes. A transform that writes
 * *into* one of those arrays instead of assigning a new one would corrupt every
 * grid sharing it, so transforms narrow a payload by registering the narrowed
 * array under its own key.
 */
export const cloneGridStructure = (grid: DataGridPlot): DataGridPlot => ({
  ...grid,
  coordinates: grid.coordinates?.map((coordinate) => ({ ...coordinate })),
  plot: grid.plot?.map((plot) => ({
    ...plot,
    error_bands: plot.error_bands?.map((band) => ({ ...band })),
  })),
  geometries: grid.geometries?.map((geometry) => ({ ...geometry })),
  xAxisData: grid.xAxisData && { ...grid.xAxisData },
  yAxisData: grid.yAxisData && { ...grid.yAxisData },
  y2AxisData: grid.y2AxisData && { ...grid.y2AxisData },
  synchronizedGrids: grid.synchronizedGrids && {
    ...grid.synchronizedGrids,
    list: [...grid.synchronizedGrids.list],
  },
});
