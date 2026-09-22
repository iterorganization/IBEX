// Relative, not the `src/*` alias: this module is covered by `npm run test:unit`,
// and ts-node does not resolve that alias without `tsconfig-paths/register`.
import { AxisData, Coordinates, DataPlotly, Datum } from '../types';
import { getArrayValueFromDependance, getVectorData } from '../utils/matrix';

/**
 * The vectors that are actually drawn.
 *
 * A trace's `y` is one row of a payload, taken with the integers the grid's
 * coordinates carry; its `x` is the vector of the axis on display. Both are
 * *derived*: payload plus cursor determines them completely, so storing them
 * means storing a copy that has to be rebuilt by every writer that touches
 * either half - which is what made stepping a slider rebuild every trace of
 * every synchronized grid.
 *
 * Nothing here is stored. The store holds the payload and the cursor; the
 * render path calls in here and hands the result to Plotly.
 *
 * ## The memo
 *
 * Keyed on the payload array itself - so the cursor moving does not invalidate
 * another grid's rows, and two synchronized grids sitting at the same cursor
 * derive once between them - and within that on the cursor. Entries are dropped
 * oldest-first past a small bound: dragging a slider walks through indices that
 * will not be asked for again, while a panel sits at one.
 *
 * The map is weak on the payload, so a family the sweep frees takes its derived
 * rows with it without any bookkeeping here.
 */

/** How many cursors' worth of rows to keep per payload. */
const REMEMBERED = 8;

const memo = new WeakMap<object, Map<string, unknown>>();

const remember = <T>(owner: AxisData, key: string, compute: () => T): T => {
  const anchor = owner as unknown as object;
  let byCursor = memo.get(anchor);
  if (!byCursor) {
    byCursor = new Map();
    memo.set(anchor, byCursor);
  }
  if (byCursor.has(key)) return byCursor.get(key) as T;

  const value = compute();
  if (byCursor.size >= REMEMBERED) {
    byCursor.delete(byCursor.keys().next().value);
  }
  byCursor.set(key, value);
  return value;
};

/**
 * Where the grid is looking, as a string.
 *
 * Both halves matter: `valueIndex` picks the row, and `axeIndex` decides which
 * axes are indexed at all and in what order.
 */
export const cursorOf = (coordinates: Coordinates[]): string =>
  coordinates
    .map((coord) => `${coord.name}@${coord.axeIndex}:${coord.valueIndex}`)
    .join(',');

/** The vector of the coordinate currently on `axeIndex`, at this cursor. */
export const axisVector = (
  coordinates: Coordinates[],
  axeIndex: number,
): (string | number)[] | undefined => {
  const coordinate = coordinates?.find((coord) => coord.axeIndex === axeIndex);
  if (!coordinate?.data) return undefined;
  return remember(coordinate.data, cursorOf(coordinates), () =>
    getArrayValueFromDependance(coordinates, axeIndex),
  );
};

/** The row of `payload` this cursor points at. */
export const lineVector = (
  payload: AxisData | undefined,
  coordinates: Coordinates[],
): number[] | undefined => {
  if (!payload) return undefined;
  return remember(payload, cursorOf(coordinates), () =>
    getVectorData(coordinates, payload),
  );
};

/** The rows of a trace's error bands, in band order. */
export const bandVectors = (
  plot: DataPlotly,
  coordinates: Coordinates[],
): Datum[][] =>
  (plot.error_bands ?? []).map(
    (band) => (lineVector(band.yData, coordinates) ?? []) as Datum[],
  );

/**
 * The per-point error values Plotly's hover template reads, paired up as it
 * expects them: two columns when the bands are asymmetric, one when they are.
 */
export const customdataOf = (bands: Datum[][]): Datum[][] | undefined => {
  if (!bands.length) return undefined;
  const [first, second] = bands;
  return bands.length === 2
    ? first.map((value, index) => [value, second[index]])
    : first.map((value) => [value]);
};

/**
 * The 2-D slab a heatmap draws: the payload walked down to two dimensions with
 * the cursor of every axis above them.
 */
export const slabMatrix = (
  payload: AxisData | undefined,
  coordinates: Coordinates[],
): (number | string)[][] | undefined => {
  if (!payload) return undefined;
  return remember(payload, `slab|${cursorOf(coordinates)}`, () => {
    let slab: unknown = payload;

    // Depth of the nested array. Replaces a tf.tensor() that was built only to
    // read shape.length: it copied the entire matrix and was never disposed.
    let depth = 0;
    let probe: unknown = slab;
    while (Array.isArray(probe)) {
      depth += 1;
      probe = probe[0];
    }

    for (let step = 0; step < depth - 2; step++) {
      if (!Array.isArray(slab)) break;
      const coordinate = coordinates.find(
        (coord) => coord.axeIndex === coordinates.length - 1 - step,
      );
      slab = slab[coordinate?.valueIndex ?? 0];
    }
    // For malformed data this can still be a scalar, which passes through
    // untouched exactly as it did before.
    return slab as (number | string)[][];
  });
};
