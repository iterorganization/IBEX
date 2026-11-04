// Relative, not the `src/*` alias: this module is covered by `npm run test:unit`,
// and ts-node does not resolve that alias without `tsconfig-paths/register`.
// It happens to work while the import is types-only, since TypeScript erases
// it - but that is luck, not a property worth relying on.
import { AxisData, Configuration } from '../types';
import { requestCacheKey } from '../utils/requestCache';

/**
 * Identity and lifetime for the bulk arrays the backend returns.
 *
 * ## What belongs here
 *
 * A payload is a numeric array that is *reproducible from a request*: the y
 * values of a trace, a coordinate's values, an error band, a geometry outline.
 * Everything that decides those bytes - the node uri, downsampling,
 * interpolation, smoothing, data operations - is already in the query string,
 * so the request is the identity and `payloadKey` is derived from it.
 *
 * Anything that is not reproducible that way is configuration, not payload, and
 * belongs on the grid: titles, colours, axis assignments, slider positions.
 *
 * A geometry outline is neither: `x` and `y` there are vectors *derived* from
 * two payloads, so they are registered when derivation itself moves out of the
 * store, not here.
 *
 * ## Why this is not a zustand slice
 *
 * Nothing renders a payload directly - components render vectors derived from
 * one - so a payload arriving must not notify a subscriber. Keeping the map
 * outside the store also keeps it out of `getState()`, which the e2e bridge
 * serialises, and out of every `structuredClone` of a configuration.
 *
 * ## Invariants
 *
 * - A key is reproducible: the same request, and the same chain of derivations
 *   applied to it, always name the same entry.
 * - Derivations compose against the **base**. Applying a range of [40,120] and
 *   then one of [50,60] yields `|range:1:50-60` derived from the base payload,
 *   never from the already-trimmed array. This is what lets a range be undone.
 * - A registered array is not written to. The request cache hands the same
 *   arrays to every caller and every grid, so a write into one would reach all
 *   of them and the cache entry too. Under E2E_TEST registration deep-freezes
 *   the array, which turns such a write into a TypeError the suites report;
 *   in a normal run it is a convention, because freezing a 2-D payload walks
 *   every row of it.
 */

/** A registry key. Opaque: build it with `payloadKey` or `derivedKey`. */
export type PayloadKey = string;

interface PayloadEntry {
  value: AxisData;
  /** The shape, once known. `undefined` while the backend only said "irregular". */
  shape?: number[];
  /** Element count, from the response's shape - a cheap stand-in for bytes. */
  elements: number;
}

const payloads = new Map<PayloadKey, PayloadEntry>();

/** Keys held by something the store cannot see, such as a detached grid copy. */
const pins = new Map<PayloadKey, number>();

const stats = {
  registered: 0,
  hits: 0,
  derivations: 0,
  swept: 0,
  /** Whether registered arrays are frozen. See the invariants above. */
  frozen: false,
};

/** Freezes an array and every array or object nested in it. */
const deepFreeze = (value: unknown): void => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    // Indexed rather than `Object.values`, which would copy every row.
    for (let index = 0; index < value.length; index += 1) {
      deepFreeze(value[index]);
    }
  } else {
    for (const item of Object.values(value)) deepFreeze(item);
  }
};

/** Turns freezing on registration on or off. See the invariants above. */
export const setFreezePayloads = (enabled: boolean): void => {
  stats.frozen = enabled;
};

/** Product of a shape, or 0 when the backend reported an irregular one. */
const elementsOf = (shape: number[] | 'irregular' | undefined): number =>
  Array.isArray(shape) ? shape.reduce((total, dim) => total * dim, 1) : 0;

/**
 * Names one member of a response. A single `plot_data` call yields the trace's
 * values and one array per coordinate, so the request key alone is not enough.
 */
export const payloadKey = (endpoint: string, member: string): PayloadKey =>
  `${requestCacheKey(endpoint)}#${member}`;

/**
 * Names the result of applying one derivation step to another payload.
 *
 * `|` separates the steps, and cannot occur inside a base key: `requestCacheKey`
 * percent-encodes every parameter value and the paths it keeps are fixed
 * back-end routes.
 */
export const derivedKey = (base: PayloadKey, step: string): PayloadKey =>
  `${base}|${step}`;

/** The request key a derived key was built from: everything before the steps. */
export const baseOf = (key: PayloadKey): PayloadKey => {
  const separator = key.indexOf('|');
  return separator === -1 ? key : key.slice(0, separator);
};

/** The derivation steps of a key, in application order. */
export const stepsOf = (key: PayloadKey): string[] => {
  const separator = key.indexOf('|');
  return separator === -1 ? [] : key.slice(separator + 1).split('|');
};

const TRANSPOSE = 'transpose:';

const isIdentity = (permutation: number[]): boolean =>
  permutation.every((axis, position) => axis === position);

/**
 * Names the transposition of `ref` by `permutation`, composed against the base.
 *
 * A transposition permutes axes: `out.dim[k] = in.dim[permutation[k]]`. Applying
 * `q` to an array that is already the base under `p` therefore leaves the base
 * under `p[q[k]]` - one step, never a stack of them. Two consequences, and both
 * are the reason this is not a plain `derivedKey` call:
 *
 * - Swapping two axes and swapping them back composes to the identity, which
 *   names the base itself. Undoing a transposition is a lookup, not a transpose.
 * - Reaching the same axis order by different routes names the same entry.
 */
export const transposedKey = (
  ref: PayloadKey,
  permutation: number[],
): PayloadKey => {
  const steps = stepsOf(ref);
  const last = steps[steps.length - 1];
  const previous = last?.startsWith(TRANSPOSE)
    ? last.slice(TRANSPOSE.length).split(',').map(Number)
    : null;
  const composed = previous
    ? permutation.map((axis) => previous[axis])
    : permutation;
  const kept = previous ? steps.slice(0, -1) : steps;
  const tail = isIdentity(composed)
    ? kept
    : [...kept, `${TRANSPOSE}${composed.join(',')}`];
  return [baseOf(ref), ...tail].join('|');
};

const RANGE = 'range:';

/**
 * Absolute, inclusive bounds per axis of the **base**, not of whatever the grid
 * is currently showing. `{ 3: [10, 50] }` means "elements 10 to 50 of axis 3 of
 * the fetched array", whether or not a narrower range was applied before.
 */
export type Ranges = Record<number, [number, number]>;

/** The permutation a key ends with, or `null` when it names an untransposed array. */
export const transposeOf = (key: PayloadKey | undefined): number[] | null => {
  const steps = key === undefined ? [] : stepsOf(key);
  const last = steps[steps.length - 1];
  return last?.startsWith(TRANSPOSE)
    ? last.slice(TRANSPOSE.length).split(',').map(Number)
    : null;
};

/** The ranges a key applies to its base, by base axis. */
export const rangesOf = (key: PayloadKey | undefined): Ranges => {
  const ranges: Ranges = {};
  for (const step of key === undefined ? [] : stepsOf(key)) {
    if (!step.startsWith(RANGE)) continue;
    const [axis, bounds] = step.slice(RANGE.length).split(':');
    const [low, high] = bounds.split('-').map(Number);
    ranges[Number(axis)] = [low, high];
  }
  return ranges;
};

/**
 * Names the slice of `ref`'s **base** given by `ranges`, keeping whatever axis
 * order `ref` is held in.
 *
 * Ranges are written before the transposition, in base axes, and they replace
 * rather than stack: a range is a window on the fetched array, so applying
 * [40,120] and then [50,60] names `|range:3:50-60` off the base, and asking for
 * no ranges at all names the base itself. That is what makes restoring a range
 * - and widening one - a lookup rather than a fetch, and it is why nothing here
 * needs to know which range was applied before.
 *
 * Keeping the transposition last is what lets `transposedKey` compose by looking
 * at a single step, and means a transposition and a range commute.
 */
export const rangedKey = (ref: PayloadKey, ranges: Ranges): PayloadKey => {
  const steps = Object.keys(ranges)
    .map(Number)
    .sort((a, b) => a - b)
    .map((axis) => `${RANGE}${axis}:${ranges[axis][0]}-${ranges[axis][1]}`);
  const permutation = transposeOf(ref);
  const tail = permutation ? [`${TRANSPOSE}${permutation.join(',')}`] : [];
  return [baseOf(ref), ...steps, ...tail].join('|');
};

/**
 * Records a payload under its key and returns that key.
 *
 * Registering the same key twice keeps the first array: two callers that
 * computed the same key computed the same bytes, and keeping one of them is the
 * point.
 */
export const registerPayload = (
  key: PayloadKey,
  value: AxisData,
  shape?: number[] | 'irregular',
): PayloadKey => {
  const existing = payloads.get(key);
  if (existing) {
    stats.hits += 1;
    return key;
  }
  if (stats.frozen) deepFreeze(value);
  payloads.set(key, {
    value,
    shape: Array.isArray(shape) ? shape : undefined,
    elements: elementsOf(shape),
  });
  stats.registered += 1;
  if (key !== baseOf(key)) stats.derivations += 1;
  return key;
};

/** The array behind a key, or `undefined` if it was never registered or swept. */
export const readPayload = (
  key: PayloadKey | undefined,
): AxisData | undefined =>
  key === undefined ? undefined : payloads.get(key)?.value;

/**
 * The shape of a registered payload, or `undefined` when nothing has computed
 * one - the backend reports some arrays as `irregular` and only a tensorisation
 * can then say how big they are.
 */
export const payloadShape = (
  key: PayloadKey | undefined,
): number[] | undefined =>
  key === undefined ? undefined : payloads.get(key)?.shape;

/**
 * Records a shape worked out after registration, so the next derivation from
 * this payload does not have to tensorise it again to find its rank.
 */
export const rememberPayloadShape = (
  key: PayloadKey | undefined,
  shape: number[],
): void => {
  const entry = key === undefined ? undefined : payloads.get(key);
  if (!entry || entry.shape) return;
  entry.shape = shape;
  entry.elements = elementsOf(shape);
};

/** Keeps a key alive while something outside the store references it. */
export const pin = (key: PayloadKey | undefined): void => {
  if (!key) return;
  pins.set(key, (pins.get(key) ?? 0) + 1);
};

export const unpin = (key: PayloadKey | undefined): void => {
  if (!key) return;
  const count = (pins.get(key) ?? 0) - 1;
  if (count > 0) pins.set(key, count);
  else pins.delete(key);
};

/** Every key reachable from a configuration. */
export const keysOf = (configuration: Configuration): PayloadKey[] => {
  const keys: PayloadKey[] = [];
  for (const grid of configuration.dataPlot ?? []) {
    for (const coordinate of grid.coordinates ?? []) {
      if (coordinate.dataRef) keys.push(coordinate.dataRef);
    }
    for (const plot of grid.plot ?? []) {
      if (plot.yDataRef) keys.push(plot.yDataRef);
      for (const band of plot.error_bands ?? []) {
        if (band.yDataRef) keys.push(band.yDataRef);
      }
    }
  }
  return keys;
};

/**
 * Mark and sweep, driven by the store rather than by reference counting.
 *
 * Refcounting would need a matching release at all 24 configuration writers and
 * would leak - or free too early - the first time one was missed. Sweeping from
 * what the store can reach means deleting a grid or a configuration needs no
 * code at all, which is the point.
 *
 * @param reachable Every key the store can still reach.
 * @param audit When true, reports what it would free and frees nothing.
 */
export const sweep = (
  reachable: Set<PayloadKey>,
  audit = false,
): { freed: number; elements: number } => {
  let freed = 0;
  let elements = 0;

  // Reachability is per family, not per key: a payload and every view derived
  // from it live and die together. Keeping the base of a reachable derivation
  // is what makes undoing one free; keeping the derivations of a reachable base
  // is what makes redoing one free. Both are bounded by what the user actually
  // asked for, and a deleted grid takes the whole family with it.
  // A pin is a root like any other, so it keeps its family too: a detached
  // grid that narrows a payload must still find the base to widen it again.
  const liveBases = new Set<PayloadKey>();
  for (const key of reachable) liveBases.add(baseOf(key));
  for (const key of pins.keys()) liveBases.add(baseOf(key));

  for (const [key, entry] of payloads) {
    if (liveBases.has(baseOf(key))) continue;
    freed += 1;
    elements += entry.elements;
    if (!audit) payloads.delete(key);
  }

  if (!audit) stats.swept += freed;
  return { freed, elements };
};

export const payloadStats = () => {
  let elements = 0;
  for (const entry of payloads.values()) elements += entry.elements;
  return { ...stats, entries: payloads.size, pins: pins.size, elements };
};

/** Drops everything. Used between e2e specs, alongside the request cache. */
export const clearPayloads = (): void => {
  payloads.clear();
  pins.clear();
};
