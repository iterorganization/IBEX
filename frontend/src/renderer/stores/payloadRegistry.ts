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
 * - A registered array is not written to. That is not yet enforced: the
 *   transforms that still rewrite payloads in place are converted in the stages
 *   that follow, and only then is it safe to freeze on registration and to hand
 *   the same array to two grids.
 */

/** A registry key. Opaque: build it with `payloadKey` or `derivedKey`. */
export type PayloadKey = string;

interface PayloadEntry {
  value: AxisData;
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

/** Product of a shape, or 0 when the backend reported an irregular one. */
const elementsOf = (shape: number[] | 'irregular' | undefined): number =>
  Array.isArray(shape) ? shape.reduce((total, dim) => total * dim, 1) : 0;

/**
 * Names one member of a response. A single `plot_data` call yields the trace's
 * values and one array per coordinate, so the request key alone is not enough.
 */
export const payloadKey = (endpoint: string, member: string): PayloadKey =>
  `${requestCacheKey(endpoint)}#${member}`;

/** Names the result of applying one derivation step to another payload. */
export const derivedKey = (base: PayloadKey, step: string): PayloadKey =>
  `${base}|${step}`;

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
  payloads.set(key, { value, elements: elementsOf(shape) });
  stats.registered += 1;
  return key;
};

/** The array behind a key, or `undefined` if it was never registered or swept. */
export const readPayload = (
  key: PayloadKey | undefined,
): AxisData | undefined =>
  key === undefined ? undefined : payloads.get(key)?.value;

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

  for (const [key, entry] of payloads) {
    if (reachable.has(key) || pins.has(key)) continue;
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
