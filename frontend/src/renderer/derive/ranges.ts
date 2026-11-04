// Relative, not the `src/*` alias: this module is covered by `npm run test:unit`,
// and ts-node does not resolve that alias without `tsconfig-paths/register`.
import * as tf from '@tensorflow/tfjs';
import { AxisData } from '../types';
import { getTensorizedMatrix } from '../utils/tensor';
import {
  PayloadKey,
  Ranges,
  baseOf,
  payloadShape,
  rangedKey,
  rangesOf,
  readPayload,
  registerPayload,
  rememberPayloadShape,
  transposeOf,
} from '../stores/payloadRegistry';

/**
 * Taking a window of a payload without losing the payload.
 *
 * A range is a *view* parameter: it changes which part of the fetched array you
 * look at, never the bytes the backend sent. So a windowed array is derived from
 * the base rather than replacing it, its bounds are absolute against the base,
 * and every range is reachable from every other one - widening, narrowing and
 * restoring are all the same operation, and none of them can fetch.
 *
 * That is also why nothing here takes a "previous range" argument. The bounds
 * say where the window is, not how it got there.
 */

export interface DerivedPayload {
  value: AxisData;
  ref?: PayloadKey;
  shape?: number[];
}

/**
 * How many axes the base behind `ref` has, tensorising it at most once ever.
 *
 * The rank decides which axis a coordinate's own range applies to, and it has to
 * be known before the key can be built - so it cannot come from the slice.
 */
export const baseRank = async (
  ref: PayloadKey | undefined,
  fallback: AxisData,
): Promise<number> => {
  const key = ref === undefined ? undefined : baseOf(ref);
  const known = payloadShape(key);
  if (known) return known.length;

  const source = readPayload(key) ?? fallback;
  const tensor = await getTensorizedMatrix(source);
  const rank = tensor.shape.length;
  rememberPayloadShape(key, tensor.shape);
  tensor.dispose();
  return rank;
};

/** Slices `source` at `ranges`, then puts it back in the axis order `permutation` asks for. */
const sliceAndTranspose = async (
  source: AxisData,
  ranges: Ranges,
  permutation: number[] | null,
): Promise<{ value: AxisData; shape: number[] }> => {
  const tensor = await getTensorizedMatrix(source);
  const begin = tensor.shape.map((_, axis) => ranges[axis]?.[0] ?? 0);
  const size = tensor.shape.map((dimension, axis) =>
    ranges[axis] ? ranges[axis][1] + 1 - ranges[axis][0] : dimension,
  );

  const sliced = tf.slice(tensor, begin, size);
  const oriented = permutation ? sliced.transpose(permutation) : sliced;
  const value = (await oriented.array()) as AxisData;
  const shape = oriented.shape;

  tensor.dispose();
  sliced.dispose();
  if (oriented !== sliced) oriented.dispose();
  return { value, shape };
};

/**
 * The window `ranges` names, taken from the base `ref` was derived from.
 *
 * Whatever `ref` currently holds is irrelevant to the result: the window is cut
 * from the full array every time, which is what makes this idempotent. Applying
 * the grid's ranges again after a trace arrives narrowed, or after one arrives
 * un-narrowed, gives the same answer - the flag that used to guess which of the
 * two had happened has nothing left to decide.
 *
 * @param current The array in hand, used only when the registry has nothing.
 * @param needShape Whether the caller stores a shape; a band does not, and
 *   working one out for a payload the backend called irregular is not free.
 */
export const sliceFromBase = async (
  ref: PayloadKey | undefined,
  current: AxisData,
  ranges: Ranges,
  needShape = true,
): Promise<DerivedPayload> => {
  if (!ref) {
    // Nothing in the registry to cut from. An array the registry never saw is
    // an array nothing has windowed, so it is its own base - and with no window
    // to take, there is nothing to do at all.
    if (Object.keys(ranges).length === 0) return { value: current };
    const { value, shape } = await sliceAndTranspose(current, ranges, null);
    return { value, shape };
  }

  // An axis that was windowed and no longer is goes back to its full extent
  // rather than to the base itself. The base is the response as it was parsed;
  // every window is a tensor slice of it, and single precision, so restoring a
  // range has to land on the same kind of array the range produced - otherwise
  // the values move when the window is dropped. Naming it means the second
  // restore is a lookup.
  const shape = payloadShape(baseOf(ref));
  const effective: Ranges = { ...ranges };
  if (shape) {
    for (const axis of Object.keys(rangesOf(ref)).map(Number)) {
      if (!effective[axis]) effective[axis] = [0, shape[axis] - 1];
    }
  }

  const key = rangedKey(ref, effective);
  const hit = readPayload(key);
  if (hit) {
    let shape = payloadShape(key);
    if (!shape && needShape) {
      const tensor = await getTensorizedMatrix(hit);
      shape = tensor.shape;
      rememberPayloadShape(key, shape);
      tensor.dispose();
    }
    return { value: hit, ref: key, shape };
  }

  const base = readPayload(baseOf(key));
  const derived = await sliceAndTranspose(
    base ?? current,
    effective,
    base ? transposeOf(key) : null,
  );
  registerPayload(key, derived.value, derived.shape);
  return { value: derived.value, ref: key, shape: derived.shape };
};
