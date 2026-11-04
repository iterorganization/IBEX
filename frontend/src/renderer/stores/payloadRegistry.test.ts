import { expect } from 'chai';
import {
  baseOf,
  clearPayloads,
  derivedKey,
  keysOf,
  payloadKey,
  payloadStats,
  pin,
  readPayload,
  registerPayload,
  rangedKey,
  rangesOf,
  setFreezePayloads,
  stepsOf,
  sweep,
  transposeOf,
  transposedKey,
  unpin,
} from './payloadRegistry';
import { requestCacheKey } from '../utils/requestCache';
import { Configuration } from '../types';

/** A configuration holding one grid with one trace and one coordinate. */
const configurationWith = (
  traceRef?: string,
  coordRef?: string,
  bandRef?: string,
): Configuration =>
  ({
    name: 'c',
    dataURI: [],
    checkedNodeURI: [],
    customDataTree: [],
    dataPlot: [
      {
        i: 'grid-1',
        plot: [
          {
            nodeUri: 'u#a',
            labelUri: 'u',
            yDataRef: traceRef,
            error_bands: bandRef
              ? [
                  {
                    path: 'u#a_error_upper',
                    yData: [],
                    yDataRef: bandRef,
                    array: [],
                  },
                ]
              : undefined,
          },
        ],
        coordinates: [{ name: 'time', dataRef: coordRef }],
        geometries: [],
      },
    ],
  }) as unknown as Configuration;

describe('payloadRegistry', () => {
  beforeEach(() => clearPayloads());

  describe('keys', () => {
    it('names a member of a response', () => {
      expect(payloadKey('/data/plot_data?uri=x', 'value')).to.equal(
        '/data/plot_data?uri=x#value',
      );
    });

    it('canonicalises a relative endpoint exactly as the request cache does', () => {
      // The two layers must agree, or one response ends up under two names.
      const endpoint = '/data/plot_data?downsampled_size=1000&uri=x';
      expect(payloadKey(endpoint, 'value')).to.equal(
        `${requestCacheKey(`http://127.0.0.1:8000${endpoint}`)}#value`,
      );
    });

    it('sorts parameter keys but keeps the order of repeated values', () => {
      // `operations` is an ordered list: two different orders are two different
      // requests and must not collide.
      const a = payloadKey('/d?b=2&a=1&operations=x&operations=y', 'value');
      const b = payloadKey('/d?a=1&b=2&operations=x&operations=y', 'value');
      const reversed = payloadKey(
        '/d?a=1&b=2&operations=y&operations=x',
        'value',
      );
      expect(a).to.equal(b);
      expect(a).to.not.equal(reversed);
    });

    it('separates the members of one response', () => {
      const endpoint = '/data/plot_data?uri=x';
      expect(payloadKey(endpoint, 'value')).to.not.equal(
        payloadKey(endpoint, 'coord:time'),
      );
    });

    it('composes derivations left to right', () => {
      const base = payloadKey('/d?uri=x', 'value');
      expect(
        derivedKey(derivedKey(base, 'transpose:1,0'), 'range:1:4-8'),
      ).to.equal(`${base}|transpose:1,0|range:1:4-8`);
    });

    it('splits a key into the request that produced it and its steps', () => {
      const base = payloadKey('/d?uri=x', 'value');
      const derived = derivedKey(derivedKey(base, 'transpose:1,0'), 'r:2-9');

      expect(baseOf(derived)).to.equal(base);
      expect(stepsOf(derived)).to.deep.equal(['transpose:1,0', 'r:2-9']);
      expect(baseOf(base)).to.equal(base);
      expect(stepsOf(base)).to.deep.equal([]);
    });
  });

  describe('transposition keys', () => {
    const base = payloadKey('/data/plot_data?uri=x', 'value');

    it('names the base itself when the permutation changes nothing', () => {
      expect(transposedKey(base, [0, 1, 2])).to.equal(base);
    });

    it('composes onto the base instead of stacking steps', () => {
      // out.dim[k] = in.dim[p[k]], so applying q to the base under p leaves the
      // base under p[q[k]] - here [1,0,2] then [0,2,1] gives [1,2,0].
      const once = transposedKey(base, [1, 0, 2]);
      expect(transposedKey(once, [0, 2, 1])).to.equal(
        `${base}|transpose:1,2,0`,
      );
    });

    it('names the base again after a swap and a swap back', () => {
      // This is what makes undoing a transposition free.
      const swapped = transposedKey(base, [1, 0, 2]);
      expect(swapped).to.not.equal(base);
      expect(transposedKey(swapped, [1, 0, 2])).to.equal(base);
    });

    it('gives one name to an axis order reached by different routes', () => {
      const viaOneSwap = transposedKey(base, [2, 1, 0]);
      const viaThree = transposedKey(
        transposedKey(transposedKey(base, [1, 0, 2]), [0, 2, 1]),
        [1, 0, 2],
      );
      expect(viaThree).to.equal(viaOneSwap);
    });

    it('leaves the steps it does not understand alone', () => {
      const ranged = derivedKey(base, 'range:1:4-8');
      expect(transposedKey(ranged, [1, 0])).to.equal(`${ranged}|transpose:1,0`);
    });
  });

  describe('range keys', () => {
    const base = payloadKey('/data/plot_data?uri=x', 'value');

    it('names the base itself when there is no window', () => {
      expect(rangedKey(base, {})).to.equal(base);
    });

    it('reads its own bounds back', () => {
      const key = rangedKey(base, { 1: [4, 8], 3: [0, 2] });
      expect(rangesOf(key)).to.deep.equal({ 1: [4, 8], 3: [0, 2] });
    });

    it('orders the axes so one window has one name', () => {
      expect(rangedKey(base, { 3: [0, 2], 1: [4, 8] })).to.equal(
        rangedKey(base, { 1: [4, 8], 3: [0, 2] }),
      );
    });

    it('replaces a window rather than narrowing the one before it', () => {
      // Applying [40,120] and then [50,60] is the same array as applying
      // [50,60] to the untouched payload - which is what makes it reversible.
      const narrow = rangedKey(rangedKey(base, { 1: [40, 120] }), {
        1: [50, 60],
      });
      expect(narrow).to.equal(rangedKey(base, { 1: [50, 60] }));
    });

    it('names the base again once the window is dropped', () => {
      // This is the whole of "restore range": no fetch, no slice, a lookup.
      const windowed = rangedKey(base, { 1: [40, 120] });
      expect(rangedKey(windowed, {})).to.equal(base);
    });

    it('widens without going through the range it is widening from', () => {
      const narrow = rangedKey(base, { 0: [50, 60] });
      expect(rangedKey(narrow, { 0: [40, 120] })).to.equal(
        rangedKey(base, { 0: [40, 120] }),
      );
    });

    it('keeps the axis order a window was taken in', () => {
      const transposed = transposedKey(base, [1, 0, 2]);
      const windowed = rangedKey(transposed, { 2: [1, 5] });
      expect(transposeOf(windowed)).to.deep.equal([1, 0, 2]);
      expect(rangesOf(windowed)).to.deep.equal({ 2: [1, 5] });
    });

    it('lets a window and a transposition be applied in either order', () => {
      const windowThenSwap = transposedKey(
        rangedKey(base, { 1: [2, 6] }),
        [1, 0],
      );
      const swapThenWindow = rangedKey(transposedKey(base, [1, 0]), {
        1: [2, 6],
      });
      expect(windowThenSwap).to.equal(swapThenWindow);
    });

    it('reports no permutation for an untransposed key', () => {
      expect(transposeOf(rangedKey(base, { 0: [1, 2] }))).to.equal(null);
    });
  });

  describe('registration', () => {
    it('reads back what it registered', () => {
      const key = registerPayload(payloadKey('/d?uri=x', 'value'), [1, 2, 3]);
      expect(readPayload(key)).to.deep.equal([1, 2, 3]);
    });

    it('keeps the first array when a key is registered twice', () => {
      // Two callers that computed the same key fetched the same bytes; sharing
      // one copy is the point of the registry.
      const key = payloadKey('/d?uri=x', 'value');
      const first = [1, 2, 3];
      registerPayload(key, first);
      registerPayload(key, [9, 9, 9]);
      expect(readPayload(key)).to.equal(first);
      expect(payloadStats().entries).to.equal(1);
      expect(payloadStats().hits).to.equal(1);
    });

    it('counts elements from the reported shape', () => {
      registerPayload(payloadKey('/d?uri=x', 'value'), [], [2, 3, 4]);
      expect(payloadStats().elements).to.equal(24);
    });

    it('counts an irregular shape as zero rather than guessing', () => {
      registerPayload(payloadKey('/d?uri=x', 'value'), [], 'irregular');
      expect(payloadStats().elements).to.equal(0);
    });

    it('returns undefined for a key it never saw', () => {
      expect(readPayload('nothing')).to.equal(undefined);
      expect(readPayload(undefined)).to.equal(undefined);
    });
  });

  describe('reachability', () => {
    it('collects the refs a configuration can reach', () => {
      const keys = keysOf(configurationWith('trace', 'coord', 'band'));
      expect(keys.sort()).to.deep.equal(['band', 'coord', 'trace']);
    });

    it('skips the refs a configuration does not carry', () => {
      expect(keysOf(configurationWith(undefined, 'coord'))).to.deep.equal([
        'coord',
      ]);
    });
  });

  describe('sweep', () => {
    it('frees what the store can no longer reach', () => {
      const kept = registerPayload('kept', [1]);
      registerPayload('dropped', [2]);

      const result = sweep(new Set([kept]));

      expect(result.freed).to.equal(1);
      expect(readPayload('dropped')).to.equal(undefined);
      expect(readPayload(kept)).to.deep.equal([1]);
    });

    it('frees nothing in audit mode but still reports it', () => {
      registerPayload('dropped', [2]);
      const result = sweep(new Set(), true);
      expect(result.freed).to.equal(1);
      expect(readPayload('dropped')).to.deep.equal([2]);
    });

    it('treats a pin as a root', () => {
      // DataplotCustomization holds a detached copy of a grid that the store
      // cannot see; sweeping it out from under the panel would blank it.
      registerPayload('pinned', [3]);
      pin('pinned');
      sweep(new Set());
      expect(readPayload('pinned')).to.deep.equal([3]);

      unpin('pinned');
      sweep(new Set());
      expect(readPayload('pinned')).to.equal(undefined);
    });

    it('keeps the family of a pinned view, not only the view', () => {
      // The customization panel pins the window its grid shows. Applying the
      // next range there slices the base, so the base must survive too.
      const base = registerPayload(payloadKey('/d?uri=p', 'value'), [1, 2, 3]);
      const view = registerPayload(rangedKey(base, { 0: [1, 2] }), [2, 3]);
      pin(view);
      sweep(new Set());
      expect(readPayload(base)).to.deep.equal([1, 2, 3]);
      expect(readPayload(view)).to.deep.equal([2, 3]);
      unpin(view);
    });

    it('keeps a payload pinned twice alive until both pins are released', () => {
      registerPayload('pinned', [3]);
      pin('pinned');
      pin('pinned');
      unpin('pinned');
      sweep(new Set());
      expect(readPayload('pinned')).to.deep.equal([3]);
    });

    it('keeps the base of a payload the store reaches through a view', () => {
      // The store holds the transposed array; the untransposed one is what
      // swapping back returns to, so freeing it would cost a full transpose.
      const base = registerPayload('base', [1]);
      const view = registerPayload(derivedKey(base, 'transpose:1,0'), [2]);

      sweep(new Set([view]));

      expect(readPayload(base)).to.deep.equal([1]);
      expect(readPayload(view)).to.deep.equal([2]);
    });

    it('keeps the views of a payload the store still reaches', () => {
      const base = registerPayload('base', [1]);
      const view = registerPayload(derivedKey(base, 'transpose:1,0'), [2]);

      sweep(new Set([base]));

      expect(readPayload(view)).to.deep.equal([2]);
    });

    it('frees a whole family once nothing in it is reachable', () => {
      const base = registerPayload('base', [1]);
      registerPayload(derivedKey(base, 'transpose:1,0'), [2]);
      registerPayload(derivedKey(base, 'range:1:4-8'), [3]);
      const other = registerPayload('other', [4]);

      const result = sweep(new Set([other]));

      expect(result.freed).to.equal(3);
      expect(readPayload(base)).to.equal(undefined);
    });

    it('counts a derivation apart from a fetched payload', () => {
      const before = payloadStats().derivations;
      const base = registerPayload('base', [1]);
      registerPayload(derivedKey(base, 'transpose:1,0'), [2]);

      expect(payloadStats().derivations).to.equal(before + 1);
    });
  });
});

describe('freezing on registration', () => {
  beforeEach(() => clearPayloads());
  afterEach(() => setFreezePayloads(false));

  it('turns a write into a registered array into an error', () => {
    setFreezePayloads(true);
    const rows = [
      [1, 2],
      [3, 4],
    ];
    registerPayload(payloadKey('/d?uri=x', 'value'), rows);

    expect(() => {
      rows[1][0] = 9;
    }).to.throw(TypeError);
    expect(() => rows.push([5, 6])).to.throw(TypeError);
    expect(rows[1][0]).to.equal(3);
  });

  it('leaves arrays writable when it is off', () => {
    const rows = [[1, 2]];
    registerPayload(payloadKey('/d?uri=x', 'value'), rows);

    rows[0][0] = 9;
    expect(rows[0][0]).to.equal(9);
  });
});
