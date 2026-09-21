import { expect } from 'chai';
import {
  clearPayloads,
  derivedKey,
  keysOf,
  payloadKey,
  payloadStats,
  pin,
  readPayload,
  registerPayload,
  sweep,
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

    it('keeps a payload pinned twice alive until both pins are released', () => {
      registerPayload('pinned', [3]);
      pin('pinned');
      pin('pinned');
      unpin('pinned');
      sweep(new Set());
      expect(readPayload('pinned')).to.deep.equal([3]);
    });
  });
});
