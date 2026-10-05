import { expect } from 'chai';
import {
  cachedRequest,
  clearRequestCache,
  getRequestCacheStats,
} from './requestCache';

const MB = 1024 * 1024;

/** A request that counts its runs and resolves to a fresh object each time. */
const counting = (bytes = 10) => {
  const request = async () => {
    request.runs += 1;
    return { value: { run: request.runs, rows: [[1, 2]] }, bytes };
  };
  request.runs = 0;
  return request;
};

describe('cachedRequest', () => {
  beforeEach(() => clearRequestCache());

  it('hands every caller the retained value, finished once', async () => {
    const request = counting();
    const first = await cachedRequest('/a', request);
    const second = await cachedRequest('/a', request);

    expect(request.runs).to.equal(1);
    expect(second).to.equal(first);
    expect(second.rows).to.equal(first.rows);
  });

  it('joins a request already in flight', async () => {
    const request = counting();
    const [first, second] = await Promise.all([
      cachedRequest('/a', request),
      cachedRequest('/a', request),
    ]);

    expect(request.runs).to.equal(1);
    expect(second).to.equal(first);
  });

  it('keeps entries under different keys apart', async () => {
    const request = counting();
    const real = await cachedRequest('/a', request);
    const complex = await cachedRequest('/a#cpx', request);

    expect(request.runs).to.equal(2);
    expect(complex).to.not.equal(real);
  });

  it('does not retain a failure', async () => {
    let runs = 0;
    const failing = async () => {
      runs += 1;
      throw new Error('boom');
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await cachedRequest('/a', failing);
        expect.fail('should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('boom');
      }
    }
    expect(runs).to.equal(2);
  });

  it('runs a non-cacheable request every time', async () => {
    const request = counting();
    await cachedRequest('/info/version', request, false);
    await cachedRequest('/info/version', request, false);

    expect(request.runs).to.equal(2);
  });

  it('accounts in body bytes and evicts the least recently used', async () => {
    const request = counting(60 * MB);
    await cachedRequest('/a', request);
    await cachedRequest('/b', request);
    await cachedRequest('/c', request);
    await cachedRequest('/d', request);
    await cachedRequest('/a', request); // refresh /a: /b is now the oldest
    expect(getRequestCacheStats().bytes).to.equal(240 * MB);

    await cachedRequest('/e', request);
    expect(getRequestCacheStats().bytes).to.equal(240 * MB);

    const runs = request.runs;
    await cachedRequest('/a', request);
    expect(request.runs).to.equal(runs);
    await cachedRequest('/b', request);
    expect(request.runs).to.equal(runs + 1);
  });

  it('never retains an entry over the per-entry budget', async () => {
    const request = counting(65 * MB);
    await cachedRequest('/a', request);
    await cachedRequest('/a', request);

    expect(request.runs).to.equal(2);
    expect(getRequestCacheStats().entries).to.equal(0);
  });
});
