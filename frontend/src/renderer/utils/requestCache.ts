/**
 * Session-scoped cache for backend GET requests.
 *
 * A data entry does not change while IBEX is open, so a response is valid for
 * the whole session and identical requests can be served without another round
 * trip.
 *
 * What is retained is the response *as the fetch layer finished it*: parsed,
 * and for `plot_data` also renamed, tensorised and cleaned of nulls. That work
 * therefore runs once per request rather than once per caller, and a hit costs
 * a copy of the small objects around the arrays - never a `JSON.parse` of a
 * multi-megabyte body.
 *
 * Handing the same arrays to every caller is sound because nothing writes into
 * a payload: transforms assign a new array under a new registry key. Callers
 * still get their own copy of everything that is not a payload array (see
 * `fetchFromApi`'s `share`), since those objects are assigned on freely.
 *
 * Sizes are the length of the body the entry was parsed from, which keeps the
 * byte budgets below meaningful without walking the parsed graph.
 */

/** Total budget for retained entries, in body bytes. */
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

/**
 * Entries above this are never retained. They are still de-duplicated while in
 * flight, they just do not get to evict everything else: a single 2-D payload
 * can be larger than the sum of every 1-D payload in the session.
 */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** A retained response and the length of the body it was parsed from. */
export interface CachedResponse<T = unknown> {
  value: T;
  bytes: number;
}

/** Insertion-ordered, which is what makes plain `Map` usable as an LRU. */
const entries = new Map<string, CachedResponse>();
const inFlight = new Map<string, Promise<CachedResponse>>();
let totalBytes = 0;

const stats = {
  hits: 0,
  dedup: 0,
  misses: 0,
  evictions: 0,
  skipped: 0,
};

/**
 * Canonical key for a request URL: path plus query, with parameter *keys*
 * sorted but the order of repeated values preserved.
 *
 * Repeated parameters are semantic here — `operations`, `signal_operations` and
 * `interpolate_over` are ordered lists — so only the key order may be
 * normalised. The origin is dropped so a backend port change cannot look like a
 * different request.
 *
 * A relative endpoint canonicalises to the same key as the absolute URL it
 * becomes, so callers that only hold the endpoint — the payload registry —
 * name a response exactly as this cache does.
 */
const RELATIVE_BASE = 'http://ibex.invalid';

export const requestCacheKey = (url: string): string => {
  try {
    const parsed = new URL(url, RELATIVE_BASE);
    const grouped = new Map<string, string[]>();
    for (const [key, value] of parsed.searchParams) {
      const values = grouped.get(key);
      if (values) values.push(value);
      else grouped.set(key, [value]);
    }
    const query = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) =>
        values.map((value) => `${key}=${encodeURIComponent(value)}`).join('&'),
      )
      .join('&');
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    // Not an absolute URL: the raw string is still a stable key.
    return url;
  }
};

/** Returns a retained entry, refreshing its recency. */
const takeCached = (key: string): CachedResponse | undefined => {
  const entry = entries.get(key);
  if (entry === undefined) return undefined;
  entries.delete(key);
  entries.set(key, entry);
  return entry;
};

/** Retains an entry, evicting least-recently-used ones to stay in budget. */
const retain = (key: string, entry: CachedResponse): void => {
  if (entry.bytes > MAX_ENTRY_BYTES) {
    stats.skipped += 1;
    return;
  }
  const existing = entries.get(key);
  if (existing !== undefined) {
    totalBytes -= existing.bytes;
    entries.delete(key);
  }
  while (entries.size > 0 && totalBytes + entry.bytes > MAX_TOTAL_BYTES) {
    const oldest = entries.keys().next().value as string;
    totalBytes -= entries.get(oldest).bytes;
    entries.delete(oldest);
    stats.evictions += 1;
  }
  entries.set(key, entry);
  totalBytes += entry.bytes;
};

/**
 * Runs `request` unless an identical one is cached or already in flight.
 *
 * The value resolved is the retained one, shared with every other caller of
 * the same request: callers that modify what they get must copy it first.
 *
 * @param key Cache key, from `requestCacheKey` - plus a suffix when the same
 *   request is finished in more than one way.
 * @param request Performs the request and resolves to the finished response
 *   and the length of the body it came from.
 * @param cacheable `false` for probes such as `/info/version`, which must stay
 *   live. Those are still de-duplicated while in flight.
 */
export const cachedRequest = async <T>(
  key: string,
  request: () => Promise<CachedResponse<T>>,
  cacheable = true,
): Promise<T> => {
  if (cacheable) {
    const cached = takeCached(key);
    if (cached !== undefined) {
      stats.hits += 1;
      return cached.value as T;
    }
  }

  const pending = inFlight.get(key);
  if (pending) {
    stats.dedup += 1;
    return (await pending).value as T;
  }

  stats.misses += 1;
  const promise = request()
    .then((entry) => {
      if (cacheable) retain(key, entry);
      return entry;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return (await promise).value;
};

/**
 * Drops every retained entry. Called when the selected data entries change,
 * and by the tests so one spec cannot warm the cache for the next.
 */
export const clearRequestCache = (): void => {
  entries.clear();
  totalBytes = 0;
};

/** Counters for the reactivity benchmark. */
export const getRequestCacheStats = () => ({
  ...stats,
  entries: entries.size,
  bytes: totalBytes,
});
